using System.Security.Claims;
using System.Threading.RateLimiting;
using InventoryApp;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
// Tải cấu hình email trong thư mục backend (hoặc release) trước khi tạo dịch vụ gửi thư.
var mailConfigPath = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, "mailsettings.local.json"),
    Path.Combine(builder.Environment.ContentRootPath, "backend", "mailsettings.local.json")
}.FirstOrDefault(File.Exists);
if (mailConfigPath is not null)
    builder.Configuration.AddJsonFile(mailConfigPath, optional: false, reloadOnChange: false);
// Giữ tương thích với các máy đã cấu hình qua biến môi trường.
builder.Configuration.AddEnvironmentVariables();
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
var dataDirectory = Environment.GetEnvironmentVariable("INVENTORY_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDirectory))
{
    dataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "QuanLyBanHang");
}
Directory.CreateDirectory(dataDirectory);
var databasePath = Path.Combine(dataDirectory, "inventory.db");
builder.Services.AddDbContext<InventoryDb>(options =>
    options.UseSqlite($"Data Source={databasePath}"));
builder.Services.AddSingleton<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.AddSingleton<ResetEmailSender>();
builder.Services.AddSingleton<OnlineOrderNotifier>();
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDirectory, "auth-keys")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "QuanLyBanHang.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(12);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
        options.Events.OnValidatePrincipal = async context =>
        {
            var value = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var stamp = context.Principal?.FindFirstValue("stamp");
            using var scope = context.HttpContext.RequestServices.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<InventoryDb>();
            var user = int.TryParse(value, out var id)
                ? await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id) : null;
            if (user is null || !user.IsActive || user.SecurityStamp != stamp ||
                user.Role != context.Principal?.FindFirstValue(ClaimTypes.Role))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync();
            }
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Customer", policy => policy.RequireAuthenticatedUser().RequireRole("customer"));
    options.AddPolicy("Admin", policy => policy.RequireAuthenticatedUser().RequireRole("admin"));
});
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-TOKEN");
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = 3 * 1024 * 1024);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
        }));
});

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InventoryDb>();
    // Tạo DB mới, rồi bổ sung cột/bảng còn thiếu cho DB đã dùng từ phiên bản trước.
    db.Database.EnsureCreated();
    DatabaseSchema.EnsureReturnTables(db);
    DatabaseUpgrades.Apply(db);
    db.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
}
if (args.Contains("--create-admin"))
{
    using var scope = app.Services.CreateScope();
    await AdminSetup.Run(scope.ServiceProvider.GetRequiredService<InventoryDb>(),
        scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>());
    return;
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException)
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new { message = "Phiên bảo mật hết hạn. Hãy tải lại trang." });
                return;
            }
        }
        var isPublic = context.Request.Path.StartsWithSegments("/api/store") ||
            context.Request.Path.StartsWithSegments("/api/auth") ||
            context.Request.Path == "/api/health";
        if (!isPublic && !context.User.IsInRole("admin"))
        {
            context.Response.StatusCode = context.User.Identity?.IsAuthenticated == true ? 403 : 401;
            return;
        }
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    }
    await next();
});
app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapProductMediaEndpoints(dataDirectory);
app.MapRevenueEndpoints();
app.MapDebtEndpoints();
app.MapGet("/store", () =>
{
    var index = Path.Combine(app.Environment.WebRootPath ?? "", "store", "index.html");
    return File.Exists(index) ? Results.File(index, "text/html") : Results.NotFound();
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", apiVersion = 2 }));

app.MapProductEndpoints();
app.MapSalesEndpoints();
app.MapSaleManagementEndpoints();
app.MapOnlineOrderEndpoints();
app.MapWarrantyEndpoints();
app.MapStockDocumentEndpoints();

app.MapSummaryEndpoints();
app.MapBackupEndpoints(dataDirectory, databasePath);

// API sai đường dẫn phải trả JSON 404, không để trang React dự phòng biến lỗi thành HTML 200.
app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    () => Results.NotFound(new { message = "API không tồn tại trên backend đang chạy. Hãy kiểm tra phiên bản backend và cổng 5000." }));
if (File.Exists(Path.Combine(app.Environment.WebRootPath ?? "", "index.html")))
    app.MapFallbackToFile("index.html");

app.Run();
