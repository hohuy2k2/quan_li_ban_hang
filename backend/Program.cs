using System.Globalization;
using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using InventoryApp;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.Sqlite;
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

app.MapGet("/api/products/next-code", async (InventoryDb db) =>
{
    var codes = await db.Products.AsNoTracking().Select(p => p.Code).ToListAsync();
    var highest = codes.Where(c => c.StartsWith("SP") && int.TryParse(c[2..], out _))
        .Select(c => int.Parse(c[2..])).DefaultIfEmpty(0).Max();
    return Results.Ok(new { code = $"SP{highest + 1:D6}" });
});

app.MapGet("/api/products", async (InventoryDb db, string? query, string? brand, string? category) =>
{
    var products = db.Products.AsNoTracking().Where(p => !p.IsDeleted);
    if (!string.IsNullOrWhiteSpace(query))
    {
        var term = SearchKey(query);
        products = products.Where(p => p.SearchText.Contains(term));
    }
    if (!string.IsNullOrWhiteSpace(brand))
        products = products.Where(p => p.Brand == brand);
    if (!string.IsNullOrWhiteSpace(category))
        products = products.Where(p => p.Category == category);
    return Results.Ok(await products.OrderBy(p => p.Name).ThenBy(p => p.Code).ToListAsync());
});

app.MapGet("/api/products/lookup/{code}", async (InventoryDb db, string code) =>
{
    var normalizedCode = code.Trim().ToUpperInvariant();
    var product = await db.Products.AsNoTracking()
        .FirstOrDefaultAsync(p => p.Code == normalizedCode && !p.IsDeleted);
    return product is null ? Results.NotFound(new { message = "Không tìm thấy sản phẩm với mã này." }) : Results.Ok(product);
});

app.MapPost("/api/products", async (InventoryDb db, ProductInput input) =>
{
    var error = ValidateProduct(input);
    if (error is not null) return Results.BadRequest(new { message = error });
    var code = input.Code.Trim().ToUpperInvariant();
    if (await db.Products.AnyAsync(p => p.Code == code))
        return Results.Conflict(new { message = "Mã sản phẩm đã tồn tại." });

    if (input.Quantity != 0)
        return Results.BadRequest(new { message = "Tạo sản phẩm với tồn kho 0, sau đó lập phiếu nhập kho." });
    var now = DateTime.UtcNow;
    var product = new Product { CreatedAt = now, UpdatedAt = now };
    Apply(product, input);
    await using var transaction = await db.Database.BeginTransactionAsync();
    db.Products.Add(product);
    await db.SaveChangesAsync();
    db.ProductAudits.Add(Audit(product, "created", "Đã thêm sản phẩm", null, Snapshot(product)));
    if (product.Quantity != 0)
        db.StockMovements.Add(Movement(product, product.Quantity, "Tồn đầu", ""));
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Created($"/api/products/{product.Id}", product);
});

app.MapPut("/api/products/{id:int}", async (InventoryDb db, int id, ProductInput input) =>
{
    var error = ValidateProduct(input);
    if (error is not null) return Results.BadRequest(new { message = error });
    var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
    if (product is null) return Results.NotFound(new { message = "Không tìm thấy sản phẩm." });
    var code = input.Code.Trim().ToUpperInvariant();
    if (await db.Products.AnyAsync(p => p.Code == code && p.Id != id))
        return Results.Conflict(new { message = "Mã sản phẩm đã tồn tại." });

    if (input.Quantity != product.Quantity)
        return Results.BadRequest(new { message = "Hãy dùng phiếu nhập kho hoặc kiểm kê để thay đổi số lượng." });
    var before = Snapshot(product);
    Apply(product, input);
    product.UpdatedAt = DateTime.UtcNow;
    db.ProductAudits.Add(Audit(product, "updated", "Đã chỉnh sửa sản phẩm", before, Snapshot(product)));
    await db.SaveChangesAsync();
    return Results.Ok(product);
});

app.MapDelete("/api/products/{id:int}", async (InventoryDb db, int id) =>
{
    var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
    if (product is null) return Results.NotFound(new { message = "Không tìm thấy sản phẩm." });
    var before = Snapshot(product);
    product.IsDeleted = true;
    product.UpdatedAt = DateTime.UtcNow;
    db.ProductAudits.Add(Audit(product, "deleted", "Đã xoá sản phẩm khỏi danh mục", before, null));
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/api/history", async (InventoryDb db, int? productId, string? action, string? query) =>
{
    var history = db.ProductAudits.AsNoTracking().AsQueryable();
    if (productId.HasValue) history = history.Where(h => h.ProductId == productId.Value);
    if (!string.IsNullOrWhiteSpace(action)) history = history.Where(h => h.Action == action);
    if (string.IsNullOrWhiteSpace(query))
        return Results.Ok(await history.OrderByDescending(h => h.At).ToListAsync());
    var term = SearchKey(query);
    var matches = (await history.OrderByDescending(h => h.At).ToListAsync())
        .Where(h => SearchKey($"{h.ProductCode} {h.ProductName} {h.Summary}").Contains(term));
    return Results.Ok(matches);
});

app.MapGet("/api/movements", async (InventoryDb db, int? productId, string? direction, string? query) =>
{
    var movements = db.StockMovements.AsNoTracking().AsQueryable();
    if (productId.HasValue) movements = movements.Where(m => m.ProductId == productId.Value);
    if (direction == "in") movements = movements.Where(m => m.Change > 0);
    if (direction == "out") movements = movements.Where(m => m.Change < 0);
    if (string.IsNullOrWhiteSpace(query))
        return Results.Ok(await movements.OrderByDescending(m => m.At).ToListAsync());
    var term = SearchKey(query);
    var matches = (await movements.OrderByDescending(m => m.At).ToListAsync())
        .Where(m => SearchKey($"{m.ProductCode} {m.Reason} {m.Reference}").Contains(term));
    return Results.Ok(matches);
});

// Thanh toán: trừ tồn kho và lưu giá/giảm giá tại thời điểm bán trong một giao dịch.
app.MapPost("/api/sales", async (InventoryDb db, SaleInput input) =>
{
    if (input.Items is null || input.Items.Count == 0)
        return Results.BadRequest(new { message = "Đơn hàng chưa có sản phẩm." });
    if (input.Items.Any(i => i.Quantity <= 0 || i.DiscountPerUnit < 0) || input.Items.Select(i => i.ProductId).Distinct().Count() != input.Items.Count)
        return Results.BadRequest(new { message = "Số lượng bán phải lớn hơn 0." });
    if (input.CustomerName?.Length > 120 || input.CustomerPhone?.Length > 30)
        return Results.BadRequest(new { message = "Thông tin khách hàng quá dài." });
    if (input.PaidAmount < 0 || (input.DueDate is not null && input.DueDate != "" &&
        !DateOnly.TryParseExact(input.DueDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)))
        return Results.BadRequest(new { message = "Số tiền đã trả hoặc hạn thanh toán không hợp lệ." });

    var lines = input.Items;
    await using var transaction = await db.Database.BeginTransactionAsync();
    var now = DateTime.UtcNow;
    var sale = new Sale
    {
        Number = $"HD-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
        CustomerName = input.CustomerName?.Trim() ?? "",
        CustomerPhone = input.CustomerPhone?.Trim() ?? "",
        SoldAt = now
    };
    var party = await DebtEndpoints.ResolveParty(db, "customer", input.CustomerId, sale.CustomerName, sale.CustomerPhone);
    if (input.CustomerId.HasValue && party is null)
        return Results.BadRequest(new { message = "Không tìm thấy khách hàng đã chọn." });
    if (party is not null)
    {
        sale.PartyId = party.Id;
        sale.CustomerName = party.Name;
        sale.CustomerPhone = party.Phone;
    }

    foreach (var line in lines)
    {
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == line.ProductId && !p.IsDeleted);
        if (product is null)
            return Results.BadRequest(new { message = "Có sản phẩm không còn trong danh mục." });
        var changed = await db.Products
            .Where(p => p.Id == product.Id && !p.IsDeleted && p.Quantity >= line.Quantity)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Quantity, p => p.Quantity - line.Quantity)
                .SetProperty(p => p.UpdatedAt, now));
        if (changed != 1)
            return Results.BadRequest(new { message = $"Sản phẩm {product.Name} không đủ tồn kho." });

        if (line.DiscountPerUnit > product.SalePrice)
            return Results.BadRequest(new { message = $"Giảm giá của {product.Name} vượt giá bán." });
        var lineTotal = checked((product.SalePrice - line.DiscountPerUnit) * line.Quantity);
        sale.Items.Add(new SaleItem
        {
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            UnitPrice = product.SalePrice,
            DiscountPerUnit = line.DiscountPerUnit,
            Quantity = line.Quantity,
            LineTotal = lineTotal
        });
        db.StockMovements.Add(Movement(product, -line.Quantity, "Bán hàng", sale.Number));
        sale.Total = checked(sale.Total + lineTotal);
    }

    var paid = input.PaidAmount ?? sale.Total;
    if (paid > sale.Total) return Results.BadRequest(new { message = "Số tiền đã trả vượt tổng hoá đơn." });
    if (paid < sale.Total && party is null)
        return Results.BadRequest(new { message = "Bán chịu cần chọn hoặc nhập thông tin khách hàng." });
    db.Sales.Add(sale);
    await db.SaveChangesAsync();
    if (paid < sale.Total)
    {
        db.DebtAccounts.Add(new DebtAccount
        {
            PartyId = party!.Id, SourceType = "sale", SourceId = sale.Id,
            Reference = sale.Number, Principal = sale.Total - paid,
            DueDate = input.DueDate ?? "", CreatedAt = now
        });
        await db.SaveChangesAsync();
    }
    await transaction.CommitAsync();
    return Results.Created($"/api/sales/{sale.Id}", sale);
});

app.MapGet("/api/sales", async (InventoryDb db, string? from, string? to) =>
{
    var sales = db.Sales.AsNoTracking().Where(s => !s.IsDeleted);
    if (!string.IsNullOrWhiteSpace(from))
    {
        if (!DateOnly.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var startDate))
            return Results.BadRequest(new { message = "Ngày bắt đầu không hợp lệ." });
        var start = startDate.ToDateTime(TimeOnly.MinValue).ToUniversalTime();
        sales = sales.Where(s => s.SoldAt >= start);
    }
    if (!string.IsNullOrWhiteSpace(to))
    {
        if (!DateOnly.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var endDate))
            return Results.BadRequest(new { message = "Ngày kết thúc không hợp lệ." });
        var end = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue).ToUniversalTime();
        sales = sales.Where(s => s.SoldAt < end);
    }
    var ordered = sales.Include(s => s.Items)
        .Include(s => s.Returns).ThenInclude(r => r.Items).AsSplitQuery()
        .OrderByDescending(s => s.SoldAt);
    var result = await ordered.ToListAsync();
    return Results.Ok(result);
});

app.MapSaleManagementEndpoints();
app.MapOnlineOrderEndpoints();
app.MapWarrantyEndpoints();
app.MapStockDocumentEndpoints();

// Thống kê ngày: bỏ hóa đơn đã xóa và trừ số tiền hoàn hàng.
app.MapGet("/api/summary", async (InventoryDb db) =>
{
    var today = DateTime.Today.ToUniversalTime();
    var tomorrow = DateTime.Today.AddDays(1).ToUniversalTime();
    var salesToday = await db.Sales.AsNoTracking()
        .Where(s => !s.IsDeleted && s.SoldAt >= today && s.SoldAt < tomorrow).ToListAsync();
    var refundsToday = await db.SaleReturns.AsNoTracking()
        .Where(r => r.ReturnedAt >= today && r.ReturnedAt < tomorrow).ToListAsync();
    var active = await db.Products.AsNoTracking().Where(p => !p.IsDeleted).ToListAsync();
    return Results.Ok(new
    {
        productCount = active.Count,
        stockUnits = active.Sum(p => p.Quantity),
        lowStockCount = active.Count(p => p.Quantity <= p.LowStockThreshold),
        salesToday = salesToday.Count,
        revenueToday = salesToday.Sum(s => s.Total) - refundsToday.Sum(r => r.TotalRefund)
    });
});

app.MapGet("/api/backup", async () =>
{
    var temporaryFile = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.db");
    try
    {
        await using (var source = new SqliteConnection($"Data Source={databasePath};Pooling=False"))
        await using (var destination = new SqliteConnection($"Data Source={temporaryFile};Pooling=False"))
        {
            await source.OpenAsync();
            await destination.OpenAsync();
            source.BackupDatabase(destination);
        }
        var bytes = await File.ReadAllBytesAsync(temporaryFile);
        return Results.File(bytes, "application/octet-stream", $"quan-ly-ban-hang-{DateTime.Now:yyyyMMdd-HHmm}.db");
    }
    finally
    {
        if (File.Exists(temporaryFile)) File.Delete(temporaryFile);
    }
});

// Bản ZIP giữ cả SQLite và ảnh sản phẩm để có thể khôi phục website sau sự cố máy.
app.MapGet("/api/backup/full", async () =>
{
    var temporaryDb = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.db");
    var temporaryZip = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.zip");
    try
    {
        await using (var source = new SqliteConnection($"Data Source={databasePath};Pooling=False"))
        await using (var destination = new SqliteConnection($"Data Source={temporaryDb};Pooling=False"))
        {
            await source.OpenAsync();
            await destination.OpenAsync();
            source.BackupDatabase(destination);
        }
        await using (var output = File.Create(temporaryZip))
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create))
        {
            archive.CreateEntryFromFile(temporaryDb, "inventory.db", CompressionLevel.Optimal);
            var imageDirectory = Path.Combine(dataDirectory, "product-images");
            if (Directory.Exists(imageDirectory))
                foreach (var image in Directory.EnumerateFiles(imageDirectory))
                    archive.CreateEntryFromFile(image, $"product-images/{Path.GetFileName(image)}", CompressionLevel.Optimal);
        }
        return Results.File(await File.ReadAllBytesAsync(temporaryZip), "application/zip",
            $"quan-ly-ban-hang-{DateTime.Now:yyyyMMdd-HHmm}.zip");
    }
    finally
    {
        if (File.Exists(temporaryDb)) File.Delete(temporaryDb);
        if (File.Exists(temporaryZip)) File.Delete(temporaryZip);
    }
});

// API sai đường dẫn phải trả JSON 404, không để trang React dự phòng biến lỗi thành HTML 200.
app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    () => Results.NotFound(new { message = "API không tồn tại trên backend đang chạy. Hãy kiểm tra phiên bản backend và cổng 5000." }));
if (File.Exists(Path.Combine(app.Environment.WebRootPath ?? "", "index.html")))
    app.MapFallbackToFile("index.html");

app.Run();

static string? ValidateProduct(ProductInput input)
{
    if (string.IsNullOrWhiteSpace(input.Code) || input.Code.Trim().Length > 40)
        return "Mã sản phẩm cần có từ 1 đến 40 ký tự.";
    if (input.Code.Any(c => c > 127 || char.IsWhiteSpace(c)))
        return "Mã sản phẩm chỉ dùng chữ, số và ký hiệu không dấu; không có khoảng trắng.";
    if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160)
        return "Tên sản phẩm cần có từ 1 đến 160 ký tự.";
    if (input.Brand is null || input.Category is null || input.Brand.Length > 80 || input.Category.Length > 80)
        return "Hãng hoặc loại sản phẩm quá dài.";
    if (input.PurchasePrice < 0 || input.SalePrice < 0 || input.Quantity < 0 || input.LowStockThreshold < 0)
        return "Giá và số lượng không được âm.";
    if (!string.IsNullOrEmpty(input.ImageUrl) &&
        !System.Text.RegularExpressions.Regex.IsMatch(input.ImageUrl, "^/api/store/images/[a-f0-9]{32}\\.(jpg|png|webp)$"))
        return "Đường dẫn ảnh không hợp lệ. Hãy tải ảnh bằng biểu mẫu sản phẩm.";
    if (input.Specifications is { Count: > 30 } || input.Specifications?.Any(pair =>
        string.IsNullOrWhiteSpace(pair.Key) || pair.Key.Length > 80 ||
        string.IsNullOrWhiteSpace(pair.Value) || pair.Value.Length > 300) == true)
        return "Thông số sản phẩm không hợp lệ (tối đa 30 mục).";
    return null;
}

static void Apply(Product product, ProductInput input)
{
    product.Code = input.Code.Trim().ToUpperInvariant();
    product.Name = input.Name.Trim();
    product.Brand = input.Brand.Trim();
    product.Category = input.Category.Trim();
    product.PurchasePrice = input.PurchasePrice;
    product.PurchasePriceIncludesTax = input.PurchasePriceIncludesTax;
    product.SalePrice = input.SalePrice;
    product.ImageUrl = input.ImageUrl ?? "";
    product.SpecificationsJson = JsonSerializer.Serialize(input.Specifications ?? []);
    product.Quantity = input.Quantity;
    product.LowStockThreshold = input.LowStockThreshold;
    product.SearchText = SearchKey($"{product.Code} {product.Name} {product.Brand} {product.Category}");
}

static string SearchKey(string value)
{
    var decomposed = value.ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
    var result = new StringBuilder();
    foreach (var c in decomposed)
    {
        if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            result.Append(c);
    }
    return result.ToString().Normalize(NormalizationForm.FormC).Trim();
}

static object Snapshot(Product p) => new
{
    p.Code, p.Name, p.Brand, p.Category, p.PurchasePrice,
    p.PurchasePriceIncludesTax, p.SalePrice, p.Quantity, p.LowStockThreshold,
    p.ImageUrl, p.SpecificationsJson
};

static ProductAudit Audit(Product p, string action, string summary, object? before, object? after) => new()
{
    ProductId = p.Id,
    ProductCode = p.Code,
    ProductName = p.Name,
    Action = action,
    Summary = summary,
    ChangesJson = JsonSerializer.Serialize(new { before, after }),
    At = DateTime.UtcNow
};

static StockMovement Movement(Product p, int change, string reason, string reference) => new()
{
    ProductId = p.Id,
    ProductCode = p.Code,
    Change = change,
    Reason = reason,
    Reference = reference,
    At = DateTime.UtcNow
};
