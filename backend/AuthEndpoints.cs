using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public sealed record LoginInput(string? Email, string? Password);
public sealed record RegisterInput(string? Email, string? Password, string? DisplayName, string? Phone);
public sealed record ForgotPasswordInput(string? Email);
public sealed record ResetForgottenPasswordInput(string? Email, string? Code, string? NewPassword);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapGet("/api/auth/csrf", (HttpContext context, IAntiforgery antiforgery) =>
            Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken }));

        app.MapGet("/api/auth/me", (ClaimsPrincipal principal) =>
            principal.Identity?.IsAuthenticated == true
                ? Results.Ok(Identity(principal)) : Results.Unauthorized());

        app.MapPost("/api/auth/register", Register).RequireRateLimiting("auth");
        app.MapPost("/api/auth/login", Login).RequireRateLimiting("auth");
        app.MapPost("/api/auth/password/forgot", ForgotPassword).RequireRateLimiting("auth");
        app.MapPost("/api/auth/password/reset", ResetForgottenPassword).RequireRateLimiting("auth");
        app.MapPost("/api/auth/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });
    }

    private static async Task<IResult> Register(
        InventoryDb db, HttpContext context, IPasswordHasher<AppUser> hasher, RegisterInput input)
    {
        var email = input.Email?.Trim() ?? "";
        var name = input.DisplayName?.Trim() ?? "";
        var phone = input.Phone?.Trim() ?? "";
        var password = input.Password ?? "";
        if (!ValidEmail(email) || name.Length is < 2 or > 120 ||
            phone.Length > 30 || password.Length is < 8 or > 128)
            return Results.BadRequest(new { message = "Hãy nhập email, tên và mật khẩu từ 8 ký tự hợp lệ." });
        var normalized = email.ToUpperInvariant();
        if (await db.AppUsers.AnyAsync(u => u.NormalizedEmail == normalized))
            return Results.Conflict(new { message = "Email này đã được đăng ký." });

        var user = new AppUser
        {
            Email = email, NormalizedEmail = normalized, DisplayName = name,
            Phone = phone, Role = "customer", CreatedAt = DateTime.UtcNow,
            SecurityStamp = Guid.NewGuid().ToString("N")
        };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.AppUsers.Add(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Results.Conflict(new { message = "Email này đã được đăng ký." }); }
        await SignIn(context, user);
        return Results.Created("/api/auth/me", PublicUser(user));
    }

    private static async Task<IResult> Login(
        InventoryDb db, HttpContext context, IPasswordHasher<AppUser> hasher, LoginInput input)
    {
        var normalized = input.Email?.Trim().ToUpperInvariant() ?? "";
        var password = input.Password ?? "";
        if (!ValidEmail(input.Email?.Trim() ?? "") || password.Length > 128)
            return Results.BadRequest(new { message = "Thông tin đăng nhập không hợp lệ." });
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized);
        if (user is null)
            return Results.NotFound(new { message = "Email này chưa có tài khoản. Hãy đăng ký trước." });
        if (!user.IsActive)
            return Results.Json(new { message = "Tài khoản đã bị khóa. Hãy liên hệ cửa hàng." }, statusCode: 403);
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, password) == PasswordVerificationResult.Failed)
            return Results.Json(new { message = "Mật khẩu không đúng. Bạn có thể dùng Quên mật khẩu." }, statusCode: 401);
        await SignIn(context, user);
        return Results.Ok(PublicUser(user));
    }

    /** Gửi mã 6 chữ số cho email khách đã đăng ký, không tiết lộ email nào tồn tại. */
    private static async Task<IResult> ForgotPassword(
        InventoryDb db, ResetEmailSender sender, IDataProtectionProvider protection,
        ILogger<ResetEmailSender> logger, ForgotPasswordInput input, CancellationToken cancellationToken)
    {
        var email = input.Email?.Trim() ?? "";
        if (!ValidEmail(email)) return Results.BadRequest(new { message = "Email không hợp lệ." });
        if (!sender.IsConfigured)
            return Results.Json(new { message = sender.ConfigurationError }, statusCode: 503);

        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.NormalizedEmail == email.ToUpperInvariant() && u.Role == "customer" && u.IsActive, cancellationToken);
        if (user is null) return Results.BadRequest(new { message = "Email chưa đăng kí tài khoản" });

        var now = DateTime.UtcNow;
        if (user.ResetCodeRequestedAt > now.AddMinutes(-1))
            return Results.Ok(new { message = "Mã đã được gửi đến hòm thư của bạn ( hãy kiểm tra mục thư rác)" });

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var protectedCode = protection.CreateProtector("InventoryApp.CustomerPasswordReset.v1").Protect(code);
        var earliestResend = now.AddMinutes(-1);
        var claimed = await db.AppUsers.Where(u => u.Id == user.Id &&
            (u.ResetCodeRequestedAt == null || u.ResetCodeRequestedAt <= earliestResend))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(u => u.ResetCodeProtected, protectedCode)
                .SetProperty(u => u.ResetCodeRequestedAt, now)
                .SetProperty(u => u.ResetCodeExpiresAt, now.AddMinutes(10))
                .SetProperty(u => u.ResetCodeAttempts, 0), cancellationToken);
        if (claimed != 1)
            return Results.Ok(new { message = "Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư của bạn." });
        try { await sender.SendResetCode(user.Email, code, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            logger.LogError(error, "Không gửi được email khôi phục mật khẩu.");
            await db.AppUsers.Where(u => u.Id == user.Id && u.ResetCodeProtected == protectedCode)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(u => u.ResetCodeProtected, "")
                    .SetProperty(u => u.ResetCodeExpiresAt, (DateTime?)null)
                    .SetProperty(u => u.ResetCodeRequestedAt, (DateTime?)null)
                    .SetProperty(u => u.ResetCodeAttempts, 0), cancellationToken);
            return Results.Json(new { message = "Chưa gửi được email. Hãy thử lại sau hoặc liên hệ cửa hàng." }, statusCode: 503);
        }
        return Results.Ok(new { message = "Nếu email đã đăng ký, mã khôi phục sẽ được gửi đến hộp thư của bạn." });
    }

    /** Chỉ đổi mật khẩu khi mã chưa hết hạn và còn lượt nhập; vô hiệu hóa cookie cũ. */
    private static async Task<IResult> ResetForgottenPassword(
        InventoryDb db, IPasswordHasher<AppUser> hasher, IDataProtectionProvider protection,
        ResetForgottenPasswordInput input, CancellationToken cancellationToken)
    {
        var email = input.Email?.Trim() ?? "";
        var code = input.Code?.Trim() ?? "";
        if (!ValidEmail(email) || code.Length != 6 || !code.All(char.IsAsciiDigit))
            return Results.BadRequest(new { message = "Email hoặc mã xác nhận không hợp lệ." });
        if (input.NewPassword?.Length is not (>= 8 and <= 128))
            return Results.BadRequest(new { message = "Mật khẩu mới cần từ 8 đến 128 ký tự." });

        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.NormalizedEmail == email.ToUpperInvariant() && u.Role == "customer" && u.IsActive, cancellationToken);
        if (user is null || string.IsNullOrEmpty(user.ResetCodeProtected) ||
            user.ResetCodeExpiresAt is null || user.ResetCodeExpiresAt <= DateTime.UtcNow || user.ResetCodeAttempts >= 5)
            return Results.BadRequest(new { message = "Mã không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới." });

        string expected;
        try { expected = protection.CreateProtector("InventoryApp.CustomerPasswordReset.v1").Unprotect(user.ResetCodeProtected); }
        catch (CryptographicException) { expected = ""; }
        // Điều kiện cập nhật trong DB chặn nhiều yêu cầu đồng thời vượt giới hạn hoặc dùng lại mã.
        var checkedAt = DateTime.UtcNow;
        var availableCode = db.AppUsers.Where(u => u.Id == user.Id &&
            u.ResetCodeProtected == user.ResetCodeProtected &&
            u.ResetCodeExpiresAt > checkedAt && u.ResetCodeAttempts < 5);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(code)))
        {
            await availableCode.ExecuteUpdateAsync(setters => setters
                .SetProperty(u => u.ResetCodeAttempts, u => u.ResetCodeAttempts + 1)
                .SetProperty(u => u.ResetCodeProtected, u => u.ResetCodeAttempts >= 4 ? "" : u.ResetCodeProtected), cancellationToken);
            return Results.BadRequest(new { message = "Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại email." });
        }

        var hash = hasher.HashPassword(user, input.NewPassword!);
        var stamp = Guid.NewGuid().ToString("N");
        var changed = await availableCode.ExecuteUpdateAsync(setters => setters
            .SetProperty(u => u.PasswordHash, hash)
            .SetProperty(u => u.SecurityStamp, stamp)
            .SetProperty(u => u.ResetCodeProtected, "")
            .SetProperty(u => u.ResetCodeExpiresAt, (DateTime?)null)
            .SetProperty(u => u.ResetCodeRequestedAt, (DateTime?)null)
            .SetProperty(u => u.ResetCodeAttempts, 0), cancellationToken);
        if (changed != 1)
            return Results.BadRequest(new { message = "Mã không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới." });
        return Results.NoContent();
    }

    internal static bool ValidEmail(string email) =>
        email.Length is >= 5 and <= 254 &&
        System.Net.Mail.MailAddress.TryCreate(email, out var parsed) &&
        parsed.Address.Equals(email, StringComparison.OrdinalIgnoreCase);

    internal static async Task SignIn(HttpContext context, AppUser user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("phone", user.Phone),
            new Claim("stamp", user.SecurityStamp)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
    }

    private static object Identity(ClaimsPrincipal principal) => new
    {
        id = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!),
        displayName = principal.Identity!.Name,
        email = principal.FindFirstValue(ClaimTypes.Email),
        phone = principal.FindFirstValue("phone"),
        role = principal.FindFirstValue(ClaimTypes.Role)
    };

    internal static object PublicUser(AppUser user) => new
    {
        user.Id, user.DisplayName, user.Email, user.Phone, user.Role
    };
}
