using System.Globalization;
using System.Text;
using System.Text.Json;
using InventoryApp;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
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

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InventoryDb>();
    db.Database.EnsureCreated();
    DatabaseSchema.EnsureReturnTables(db);
    db.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

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

    var before = Snapshot(product);
    var quantityChange = input.Quantity - product.Quantity;
    Apply(product, input);
    product.UpdatedAt = DateTime.UtcNow;
    db.ProductAudits.Add(Audit(product, "updated", "Đã chỉnh sửa sản phẩm", before, Snapshot(product)));
    if (quantityChange != 0)
        db.StockMovements.Add(Movement(product, quantityChange, "Điều chỉnh thủ công", ""));
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
        return Results.Ok(await history.OrderByDescending(h => h.At).Take(300).ToListAsync());
    var term = SearchKey(query);
    var matches = (await history.OrderByDescending(h => h.At).ToListAsync())
        .Where(h => SearchKey($"{h.ProductCode} {h.ProductName} {h.Summary}").Contains(term)).Take(300);
    return Results.Ok(matches);
});

app.MapGet("/api/movements", async (InventoryDb db, int? productId, string? direction, string? query) =>
{
    var movements = db.StockMovements.AsNoTracking().AsQueryable();
    if (productId.HasValue) movements = movements.Where(m => m.ProductId == productId.Value);
    if (direction == "in") movements = movements.Where(m => m.Change > 0);
    if (direction == "out") movements = movements.Where(m => m.Change < 0);
    if (string.IsNullOrWhiteSpace(query))
        return Results.Ok(await movements.OrderByDescending(m => m.At).Take(300).ToListAsync());
    var term = SearchKey(query);
    var matches = (await movements.OrderByDescending(m => m.At).ToListAsync())
        .Where(m => SearchKey($"{m.ProductCode} {m.Reason} {m.Reference}").Contains(term)).Take(300);
    return Results.Ok(matches);
});

app.MapPost("/api/sales", async (InventoryDb db, SaleInput input) =>
{
    if (input.Items is null || input.Items.Count == 0)
        return Results.BadRequest(new { message = "Đơn hàng chưa có sản phẩm." });
    if (input.Items.Any(i => i.Quantity <= 0))
        return Results.BadRequest(new { message = "Số lượng bán phải lớn hơn 0." });
    if (input.CustomerName?.Length > 120 || input.CustomerPhone?.Length > 30)
        return Results.BadRequest(new { message = "Thông tin khách hàng quá dài." });

    var lines = input.Items.GroupBy(i => i.ProductId)
        .Select(g => new SaleLineInput(g.Key, g.Sum(i => i.Quantity))).ToList();
    await using var transaction = await db.Database.BeginTransactionAsync();
    var now = DateTime.UtcNow;
    var sale = new Sale
    {
        Number = $"HD-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
        CustomerName = input.CustomerName?.Trim() ?? "",
        CustomerPhone = input.CustomerPhone?.Trim() ?? "",
        SoldAt = now
    };

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

        var lineTotal = checked(product.SalePrice * line.Quantity);
        sale.Items.Add(new SaleItem
        {
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            UnitPrice = product.SalePrice,
            Quantity = line.Quantity,
            LineTotal = lineTotal
        });
        db.StockMovements.Add(Movement(product, -line.Quantity, "Bán hàng", sale.Number));
        sale.Total = checked(sale.Total + lineTotal);
    }

    db.Sales.Add(sale);
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Created($"/api/sales/{sale.Id}", sale);
});

app.MapGet("/api/sales", async (InventoryDb db, string? from, string? to) =>
{
    var sales = db.Sales.AsNoTracking().AsQueryable();
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
    var result = string.IsNullOrWhiteSpace(from) && string.IsNullOrWhiteSpace(to)
        ? await ordered.Take(200).ToListAsync()
        : await ordered.ToListAsync();
    return Results.Ok(result);
});

app.MapSaleManagementEndpoints();

app.MapGet("/api/summary", async (InventoryDb db) =>
{
    var today = DateTime.Today.ToUniversalTime();
    var tomorrow = DateTime.Today.AddDays(1).ToUniversalTime();
    var salesToday = await db.Sales.AsNoTracking()
        .Where(s => s.SoldAt >= today && s.SoldAt < tomorrow).ToListAsync();
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
    p.PurchasePriceIncludesTax, p.SalePrice, p.Quantity, p.LowStockThreshold
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
