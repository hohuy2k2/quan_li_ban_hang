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
        if (input.PaidAmount < 0 || (input.DueDate is not null && input.DueDate != "" &&
            !DateOnly.TryParseExact(input.DueDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)))
            return Results.BadRequest(new { message = "Số tiền đã trả hoặc hạn thanh toán không hợp lệ." });

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
        var party = input.Kind == "receipt"
            ? await DebtEndpoints.ResolveParty(db, "supplier", input.SupplierId, document.Supplier, null) : null;
        if (input.Kind == "receipt" && input.SupplierId.HasValue && party is null)
            return Results.BadRequest(new { message = "Không tìm thấy nhà cung cấp đã chọn." });
        if (party is not null) { document.PartyId = party.Id; document.Supplier = party.Name; }

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
        var total = document.Lines.Sum(line => checked((line.PurchasePrice ?? 0) * (long)line.QuantityChange));
        var paid = input.PaidAmount ?? total;
        if (input.Kind == "receipt" && paid > total)
            return Results.BadRequest(new { message = "Số tiền đã trả vượt giá trị phiếu nhập." });
        if (input.Kind == "receipt" && paid < total && party is null)
            return Results.BadRequest(new { message = "Nhập hàng chưa trả đủ tiền cần ghi nhà cung cấp." });
        await db.SaveChangesAsync();
        if (input.Kind == "receipt" && paid < total)
        {
            db.DebtAccounts.Add(new DebtAccount
            {
                PartyId = party!.Id, SourceType = "receipt", SourceId = document.Id,
                Reference = document.Number, Principal = total - paid,
                DueDate = input.DueDate ?? "", CreatedAt = now
            });
            await db.SaveChangesAsync();
        }
        await transaction.CommitAsync();
        return Results.Created($"/api/stock-documents/{document.Id}", document);
    }
}

