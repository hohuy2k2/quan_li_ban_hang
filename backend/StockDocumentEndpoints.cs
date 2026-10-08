using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class StockDocumentEndpoints
{
    public static void MapStockDocumentEndpoints(this WebApplication app)
    {
        app.MapGet("/api/stock-documents", async (InventoryDb db) =>
            Results.Ok(await db.StockDocuments.AsNoTracking().Include(d => d.Lines)
                .AsSplitQuery().OrderByDescending(d => d.CreatedAt).ToListAsync()));
        app.MapPost("/api/stock-documents", Create);
    }

    // Cả phiếu và biến động kho được lưu trong một giao dịch.
    private static async Task<IResult> Create(InventoryDb db, StockDocumentInput input)
    {
        if (input.Kind is not ("receipt" or "count") ||
            !DateOnly.TryParseExact(input.DocumentDate, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out _) ||
            input.Supplier?.Length > 160 || input.Reason?.Length > 500 ||
            (input.Kind == "count" && string.IsNullOrWhiteSpace(input.Reason)) ||
            input.Items is null || input.Items.Count is < 1 or > 100 ||
            input.Items.Any(i => i.ProductId <= 0 || i.Quantity < (input.Kind == "receipt" ? 1 : 0) ||
                (input.Kind == "receipt" && (!i.PurchasePrice.HasValue || i.PurchasePrice < 0))) ||
            input.Items.Select(i => i.ProductId).Distinct().Count() != input.Items.Count)
            return Results.BadRequest(new { message = "Thông tin phiếu kho không hợp lệ. Kiểm tra ngày, sản phẩm, số lượng, giá nhập và lý do kiểm kê." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;
        var document = new StockDocument
        {
            Number = $"{(input.Kind == "receipt" ? "NK" : "KK")}-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            Kind = input.Kind,
            DocumentDate = input.DocumentDate,
            Supplier = input.Kind == "receipt" ? input.Supplier?.Trim() ?? "" : "",
            Reason = input.Reason?.Trim() ?? "",
            CreatedAt = now
        };
        db.StockDocuments.Add(document);

        foreach (var line in input.Items)
        {
            var product = await db.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId && !p.IsDeleted);
            if (product is null)
                return Results.BadRequest(new { message = "Một sản phẩm trong phiếu đã bị xoá." });

            var before = product.Quantity;
            var afterLong = input.Kind == "receipt" ? (long)before + line.Quantity : line.Quantity;
            if (afterLong > int.MaxValue)
                return Results.BadRequest(new { message = "Số lượng vượt giới hạn cho phép." });
            var after = (int)afterLong;
            var change = after - before;
            product.Quantity = after;
            product.UpdatedAt = now;

            if (input.Kind == "receipt")
            {
                var oldPrice = product.PurchasePrice;
                var oldTax = product.PurchasePriceIncludesTax;
                product.PurchasePrice = line.PurchasePrice!.Value;
                product.PurchasePriceIncludesTax = line.PurchasePriceIncludesTax ?? false;
                if (oldPrice != product.PurchasePrice || oldTax != product.PurchasePriceIncludesTax)
                    db.ProductAudits.Add(new ProductAudit
                    {
                        ProductId = product.Id, ProductCode = product.Code, ProductName = product.Name,
                        Action = "updated", Summary = $"Cập nhật giá nhập từ phiếu {document.Number}", At = now,
                        ChangesJson = JsonSerializer.Serialize(new
                        {
                            before = new { PurchasePrice = oldPrice, PurchasePriceIncludesTax = oldTax },
                            after = new { product.PurchasePrice, product.PurchasePriceIncludesTax }
                        })
                    });
            }

            document.Lines.Add(new StockDocumentLine
            {
                ProductId = product.Id, ProductCode = product.Code, ProductName = product.Name,
                QuantityBefore = before, QuantityChange = change, QuantityAfter = after,
                PurchasePrice = input.Kind == "receipt" ? line.PurchasePrice : null,
                PurchasePriceIncludesTax = input.Kind == "receipt" ? line.PurchasePriceIncludesTax ?? false : null
            });
            db.StockMovements.Add(new StockMovement
            {
                ProductId = product.Id, ProductCode = product.Code, Change = change,
                Reason = input.Kind == "receipt" ? "Nhập kho" : "Kiểm kê",
                Reference = document.Number, At = now
            });
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Created($"/api/stock-documents/{document.Id}", document);
    }
}

