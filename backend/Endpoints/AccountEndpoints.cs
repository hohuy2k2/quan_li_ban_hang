using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public sealed record ProfileInput(string? DisplayName, string? Email, string? Phone);
public sealed record ChangePasswordInput(string? CurrentPassword, string? NewPassword);
public sealed record CreateAccountInput(string? DisplayName, string? Email, string? Phone, string? Role, string? Password);
public sealed record UpdateAccountInput(string? DisplayName, string? Email, string? Phone, string? Role, bool IsActive);
public sealed record ResetPasswordInput(string? NewPassword);

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this WebApplication app)
    {
        app.MapPut("/api/auth/profile", UpdateOwnProfile).RequireAuthorization();
        app.MapPost("/api/auth/password", ChangeOwnPassword).RequireAuthorization().RequireRateLimiting("auth");

        // Chỉ admin được xem và quản lý tài khoản; không xuất mật khẩu băm ra API.
        app.MapGet("/api/accounts", async (InventoryDb db) =>
            Results.Ok(await db.AppUsers.AsNoTracking().OrderByDescending(u => u.CreatedAt)
                .Select(u => new { u.Id, u.DisplayName, u.Email, u.Phone, u.Role, u.IsActive, u.CreatedAt })
                .ToListAsync())).RequireAuthorization("Admin");
        app.MapPost("/api/accounts", CreateAccount).RequireAuthorization("Admin");
        app.MapPut("/api/accounts/{id:int}", UpdateAccount).RequireAuthorization("Admin");
        app.MapPost("/api/accounts/{id:int}/password", ResetPassword).RequireAuthorization("Admin");
    }

    /** Người dùng sửa thông tin của mình; cấp lại cookie khi email hoặc tên thay đổi. */
    private static async Task<IResult> UpdateOwnProfile(
        InventoryDb db, HttpContext context, ClaimsPrincipal principal, ProfileInput input)
    {
        if (!ValidProfile(input.DisplayName, input.Email, input.Phone, out var name, out var email, out var phone))
            return Results.BadRequest(new { message = "Tên, email hoặc số điện thoại không hợp lệ." });
        var id = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.AppUsers.FindAsync(id);
        if (user is null || !user.IsActive) return Results.Unauthorized();
        var normalized = email.ToUpperInvariant();
        if (await db.AppUsers.AnyAsync(u => u.Id != id && u.NormalizedEmail == normalized))
            return Results.Conflict(new { message = "Email này đã được sử dụng." });
        user.DisplayName = name;
        user.Email = email;
        user.NormalizedEmail = normalized;
        user.Phone = phone;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Results.Conflict(new { message = "Email này đã được sử dụng." }); }
        await DebtEndpoints.SyncCustomerAccount(db, user);
        await AuthEndpoints.SignIn(context, user);
        return Results.Ok(AuthEndpoints.PublicUser(user));
    }

    /** Đổi mật khẩu phải biết mật khẩu hiện tại; các phiên cũ bị vô hiệu hóa. */
    private static async Task<IResult> ChangeOwnPassword(
        InventoryDb db, HttpContext context, ClaimsPrincipal principal,
        IPasswordHasher<AppUser> hasher, ChangePasswordInput input)
    {
        var id = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.AppUsers.FindAsync(id);
        if (user is null || !user.IsActive) return Results.Unauthorized();
        if (input.CurrentPassword?.Length > 128 ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, input.CurrentPassword ?? "") == PasswordVerificationResult.Failed)
            return Results.BadRequest(new { message = "Mật khẩu hiện tại không đúng." });
        if (!ValidPassword(input.NewPassword))
            return Results.BadRequest(new { message = "Mật khẩu mới cần từ 8 đến 128 ký tự." });
        user.PasswordHash = hasher.HashPassword(user, input.NewPassword!);
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync();
        await AuthEndpoints.SignIn(context, user);
        return Results.NoContent();
    }

    /** Admin tạo tài khoản cho nhân viên quản trị hoặc khách khi cần. */
    private static async Task<IResult> CreateAccount(
        InventoryDb db, IPasswordHasher<AppUser> hasher, CreateAccountInput input)
    {
        if (!ValidProfile(input.DisplayName, input.Email, input.Phone, out var name, out var email, out var phone) ||
            !ValidRole(input.Role) || !ValidPassword(input.Password))
            return Results.BadRequest(new { message = "Thông tin tài khoản không hợp lệ; mật khẩu cần ít nhất 8 ký tự." });
        var normalized = email.ToUpperInvariant();
        if (await db.AppUsers.AnyAsync(u => u.NormalizedEmail == normalized))
            return Results.Conflict(new { message = "Email này đã được sử dụng." });
        var user = new AppUser
        {
            DisplayName = name, Email = email, NormalizedEmail = normalized, Phone = phone,
            Role = input.Role!, IsActive = true, CreatedAt = DateTime.UtcNow,
            SecurityStamp = Guid.NewGuid().ToString("N")
        };
        user.PasswordHash = hasher.HashPassword(user, input.Password!);
        db.AppUsers.Add(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Results.Conflict(new { message = "Email này đã được sử dụng." }); }
        await DebtEndpoints.SyncCustomerAccount(db, user);
        return Results.Created($"/api/accounts/{user.Id}", PublicAccount(user));
    }

    /** Khóa tài khoản thay cho xóa để đơn hàng cũ vẫn gắn đúng người mua. */
    private static async Task<IResult> UpdateAccount(
        InventoryDb db, ClaimsPrincipal principal, int id, UpdateAccountInput input)
    {
        var selfId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == selfId)
            return Results.BadRequest(new { message = "Hãy sửa tài khoản của bạn trong phần Hồ sơ." });
        if (!ValidProfile(input.DisplayName, input.Email, input.Phone, out var name, out var email, out var phone) ||
            !ValidRole(input.Role))
            return Results.BadRequest(new { message = "Thông tin tài khoản không hợp lệ." });
        var user = await db.AppUsers.FindAsync(id);
        if (user is null) return Results.NotFound(new { message = "Không tìm thấy tài khoản." });
        if (user.Role == "admin" && user.IsActive && (input.Role != "admin" || !input.IsActive) &&
            !await db.AppUsers.AnyAsync(u => u.Id != id && u.Role == "admin" && u.IsActive))
            return Results.BadRequest(new { message = "Cần giữ ít nhất một admin đang hoạt động." });
        var normalized = email.ToUpperInvariant();
        if (await db.AppUsers.AnyAsync(u => u.Id != id && u.NormalizedEmail == normalized))
            return Results.Conflict(new { message = "Email này đã được sử dụng." });
        user.DisplayName = name;
        user.Email = email;
        user.NormalizedEmail = normalized;
        user.Phone = phone;
        user.Role = input.Role!;
        user.IsActive = input.IsActive;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { return Results.Conflict(new { message = "Email này đã được sử dụng." }); }
        await DebtEndpoints.SyncCustomerAccount(db, user);
        return Results.Ok(PublicAccount(user));
    }

    /** Admin đặt mật khẩu mới cho tài khoản khác; cookie cũ của họ hết hiệu lực. */
    private static async Task<IResult> ResetPassword(
        InventoryDb db, ClaimsPrincipal principal, IPasswordHasher<AppUser> hasher,
        int id, ResetPasswordInput input)
    {
        if (id == int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!))
            return Results.BadRequest(new { message = "Hãy đổi mật khẩu của bạn trong phần Hồ sơ." });
        if (!ValidPassword(input.NewPassword))
            return Results.BadRequest(new { message = "Mật khẩu mới cần từ 8 đến 128 ký tự." });
        var user = await db.AppUsers.FindAsync(id);
        if (user is null) return Results.NotFound(new { message = "Không tìm thấy tài khoản." });
        user.PasswordHash = hasher.HashPassword(user, input.NewPassword!);
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static bool ValidProfile(string? displayName, string? emailValue, string? phoneValue,
        out string name, out string email, out string phone)
    {
        name = displayName?.Trim() ?? "";
        email = emailValue?.Trim() ?? "";
        phone = phoneValue?.Trim() ?? "";
        return name.Length is >= 2 and <= 120 && AuthEndpoints.ValidEmail(email) && phone.Length <= 30;
    }

    private static bool ValidPassword(string? value) => value?.Length is >= 8 and <= 128;
    private static bool ValidRole(string? role) => role is "admin" or "customer";

    private static object PublicAccount(AppUser user) => new
    {
        user.Id, user.DisplayName, user.Email, user.Phone, user.Role, user.IsActive, user.CreatedAt
    };
}
