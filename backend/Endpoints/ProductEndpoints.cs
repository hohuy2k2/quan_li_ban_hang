using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
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
    }

    private static string? ValidateProduct(ProductInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Code) || input.Code.Trim().Length > 40)
            return "Mã sản phẩm cần có từ 1 đến 40 ký tự.";
        if (input.Code.Any(c => c > 127 || char.IsWhiteSpace(c)))
            return "Mã sản phẩm chỉ dùng chữ, số và ký hiệu không dấu; không có khoảng trắng.";
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160)
            return "Tên sản phẩm cần có từ 1 đến 160 ký tự.";
        if (input.Brand is null || input.Category is null || input.Brand.Length > 80 || input.Category.Length > 80)
            return "Hãng hoặc loại sản phẩm quá dài.";
        if (input.Unit is null || string.IsNullOrWhiteSpace(input.Unit) || input.Unit.Trim().Length > 20)
            return "Đơn vị tính cần có từ 1 đến 20 ký tự.";
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

    private static void Apply(Product product, ProductInput input)
    {
        product.Code = input.Code.Trim().ToUpperInvariant();
        product.Name = input.Name.Trim();
        product.Brand = input.Brand.Trim();
        product.Category = input.Category.Trim();
        product.Unit = input.Unit!.Trim();
        product.PurchasePrice = input.PurchasePrice;
        product.PurchasePriceIncludesTax = input.PurchasePriceIncludesTax;
        product.SalePrice = input.SalePrice;
        product.ImageUrl = input.ImageUrl ?? "";
        product.SpecificationsJson = JsonSerializer.Serialize(input.Specifications ?? []);
        product.Quantity = input.Quantity;
        product.LowStockThreshold = input.LowStockThreshold;
        product.SearchText = SearchKey($"{product.Code} {product.Name} {product.Brand} {product.Category}");
    }

    private static string SearchKey(string value)
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

    private static object Snapshot(Product p) => new
    {
        p.Code, p.Name, p.Brand, p.Category, p.Unit, p.PurchasePrice,
        p.PurchasePriceIncludesTax, p.SalePrice, p.Quantity, p.LowStockThreshold,
        p.ImageUrl, p.SpecificationsJson
    };

    private static ProductAudit Audit(Product p, string action, string summary, object? before, object? after) => new()
    {
        ProductId = p.Id,
        ProductCode = p.Code,
        ProductName = p.Name,
        Action = action,
        Summary = summary,
        ChangesJson = JsonSerializer.Serialize(new { before, after }),
        At = DateTime.UtcNow
    };

    internal static StockMovement Movement(Product p, int change, string reason, string reference) => new()
    {
        ProductId = p.Id,
        ProductCode = p.Code,
        Change = change,
        Reason = reason,
        Reference = reference,
        At = DateTime.UtcNow
    };
}
