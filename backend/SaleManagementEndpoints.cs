using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class SaleManagementEndpoints
{
    public static void MapSaleManagementEndpoints(this WebApplication app)
    {
        app.MapGet("/api/sales/by-number/{number}", async (InventoryDb db, string number) =>
        {
            var sale = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Include(s => s.Returns).ThenInclude(r => r.Items).AsSplitQuery()
                .FirstOrDefaultAsync(s => s.Number == number);
            return sale is null
                ? Results.NotFound(new { message = "Không tìm thấy hoá đơn." })
                : Results.Ok(sale);
        });

        app.MapPut("/api/sales/{id:int}", UpdateSale);
        app.MapDelete("/api/sales/{id:int}", DeleteSale);
        app.MapPost("/api/sales/{id:int}/returns", ReturnItems);
        app.MapPatch("/api/returns/items/{id:int}/warranty", ResolveWarranty);
    }

    // Hide an unused invoice but retain its record for stock-history lookup.
    // Returns or warranties must be handled through their own records, so those invoices cannot be deleted.
    private static async Task<IResult> DeleteSale(InventoryDb db, int id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var sale = await db.Sales.Include(s => s.Items).Include(s => s.Returns)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null || sale.IsDeleted)
            return Results.NotFound(new { message = "Không tìm thấy hoá đơn cần xoá." });
        if (sale.Returns.Count > 0 ||
            await db.WarrantyCases.AnyAsync(w => w.Source == "customer" && w.SaleNumber == sale.Number))
            return Results.Conflict(new { message = "Hoá đơn đã có hàng trả hoặc bảo hành, không thể xoá. Hãy giữ lại để đối chiếu." });
        var debt = await db.DebtAccounts.Include(d => d.Payments)
            .FirstOrDefaultAsync(d => d.SourceType == "sale" && d.SourceId == id);
        if (debt is not null && debt.Payments.Count > 0)
            return Results.Conflict(new { message = "Hoá đơn đã có lịch sử trả công nợ, không thể xoá." });

        var now = DateTime.UtcNow;
        foreach (var line in sale.Items.GroupBy(i => i.ProductId))
        {
            var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == line.Key);
            if (product is null)
                return Results.Conflict(new { message = "Sản phẩm trong hoá đơn không còn tồn tại." });
            var quantity = line.Sum(i => i.Quantity);
            await db.Products.Where(p => p.Id == product.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.Quantity, p => p.Quantity + quantity)
                    .SetProperty(p => p.UpdatedAt, now));
            db.StockMovements.Add(NewMovement(product, quantity, "Xoá hoá đơn", sale.Number));
        }

        sale.IsDeleted = true;
        sale.DeletedAt = now;
        if (debt is not null) db.DebtAccounts.Remove(debt);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.NoContent();
    }

    // Sửa hóa đơn: điều chỉnh chênh lệch tồn kho; khóa sửa nếu đã có hàng trả.
    private static async Task<IResult> UpdateSale(InventoryDb db, int id, SaleInput input)
    {
        if (input.Items is null || input.Items.Count == 0 || input.Items.Any(i => i.Quantity <= 0 || i.DiscountPerUnit < 0) || input.Items.Select(i => i.ProductId).Distinct().Count() != input.Items.Count)
            return Results.BadRequest(new { message = "Hoá đơn cần có sản phẩm với số lượng lớn hơn 0." });
        if (input.CustomerName?.Length > 120 || input.CustomerPhone?.Length > 30)
            return Results.BadRequest(new { message = "Thông tin khách hàng quá dài." });

        var lines = input.Items;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var sale = await db.Sales.Include(s => s.Items).Include(s => s.Returns)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return Results.NotFound(new { message = "Không tìm thấy hoá đơn." });
        if (sale.IsDeleted) return Results.Conflict(new { message = "Hoá đơn đã xoá, không thể thay đổi." });
        if (sale.Returns.Count > 0)
            return Results.Conflict(new { message = "Hoá đơn đã có hàng trả. Không thể sửa sản phẩm hoặc thông tin khách của hoá đơn này." });
        var debt = await db.DebtAccounts.Include(d => d.Payments)
            .FirstOrDefaultAsync(d => d.SourceType == "sale" && d.SourceId == id);
        var oldTotal = sale.Total;

        var oldItems = sale.Items.ToDictionary(i => i.ProductId);
        var newQuantities = lines.ToDictionary(i => i.ProductId, i => i.Quantity);
        var productIds = oldItems.Keys.Union(newQuantities.Keys).ToList();
        var products = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);
        if (products.Count != productIds.Count)
            return Results.BadRequest(new { message = "Có sản phẩm không còn tồn tại." });

        var now = DateTime.UtcNow;
        foreach (var productId in productIds)
        {
            var product = products[productId];
            var oldQuantity = oldItems.GetValueOrDefault(productId)?.Quantity ?? 0;
            var newQuantity = newQuantities.GetValueOrDefault(productId);
            var stockChange = oldQuantity - newQuantity;
            if (stockChange == 0) continue;
            if (stockChange < 0 && product.IsDeleted)
                return Results.BadRequest(new { message = $"Sản phẩm {product.Name} đã xoá khỏi danh mục." });

            var changed = await db.Products.Where(p => p.Id == productId &&
                    (stockChange >= 0 || (!p.IsDeleted && p.Quantity >= -stockChange)))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.Quantity, p => p.Quantity + stockChange)
                    .SetProperty(p => p.UpdatedAt, now));
            if (changed != 1)
                return Results.BadRequest(new { message = $"Sản phẩm {product.Name} không đủ tồn kho để sửa hoá đơn." });
            db.StockMovements.Add(NewMovement(product, stockChange, "Sửa hoá đơn", sale.Number));
        }

        db.SaleItems.RemoveRange(sale.Items);
        sale.Items.Clear();
        sale.Total = 0;
        foreach (var line in lines)
        {
            var product = products[line.ProductId];
            var original = oldItems.GetValueOrDefault(line.ProductId);
            var unitPrice = original?.UnitPrice ?? product.SalePrice;
            if (line.DiscountPerUnit > unitPrice)
                return Results.BadRequest(new { message = $"Giảm giá của {product.Name} vượt giá bán." });
            var lineTotal = checked((unitPrice - line.DiscountPerUnit) * line.Quantity);
            sale.Items.Add(new SaleItem
            {
                ProductId = line.ProductId,
                ProductCode = original?.ProductCode ?? product.Code,
                ProductName = original?.ProductName ?? product.Name,
                Unit = original?.Unit ?? product.Unit,
                UnitPrice = unitPrice,
                DiscountPerUnit = line.DiscountPerUnit,
                Quantity = line.Quantity,
                LineTotal = lineTotal
            });
            sale.Total = checked(sale.Total + lineTotal);
        }
        var nextName = input.CustomerName?.Trim() ?? "";
        var nextPhone = input.CustomerPhone?.Trim() ?? "";
        var party = sale.PartyId.HasValue && !input.CustomerId.HasValue &&
            sale.CustomerName == nextName && sale.CustomerPhone == nextPhone
            ? await db.BusinessParties.FirstOrDefaultAsync(p => p.Id == sale.PartyId.Value)
            : await DebtEndpoints.ResolveParty(db, "customer", input.CustomerId, nextName, nextPhone);
        if (input.CustomerId.HasValue && party is null)
            return Results.BadRequest(new { message = "Không tìm thấy khách hàng đã chọn." });
        sale.CustomerName = nextName;
        sale.CustomerPhone = nextPhone;
        if (debt is not null)
        {
            if (party is null) return Results.BadRequest(new { message = "Hoá đơn có công nợ cần thông tin khách hàng." });
            var nextPrincipal = debt.Principal + sale.Total - oldTotal;
            if (nextPrincipal < debt.Payments.Sum(p => p.Amount))
                return Results.Conflict(new { message = "Tổng hoá đơn mới nhỏ hơn phần công nợ đã được thanh toán." });
            debt.Principal = nextPrincipal;
            debt.PartyId = party.Id;
        }
        else
        {
            // Hoá đơn đã trả đủ vẫn phải cân bằng sau khi sửa giá/số lượng.
            sale.PaidAtSale = sale.Total;
        }
        if (party is not null)
        {
            sale.PartyId = party.Id;
            sale.CustomerName = party.Name;
            sale.CustomerPhone = party.Phone;
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(sale);
    }

    // Trả hàng: chỉ món nhập lại kho được hoàn tiền theo giá sau giảm.
    private static async Task<IResult> ReturnItems(InventoryDb db, int id, SaleReturnInput input)
    {
        if (input.Items is null || input.Items.Count == 0 || input.Items.Any(i => i.Quantity <= 0))
            return Results.BadRequest(new { message = "Chọn ít nhất một sản phẩm và số lượng trả hợp lệ." });
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 500)
            return Results.BadRequest(new { message = "Hãy nhập lý do trả hàng (tối đa 500 ký tự)." });
        if (input.Items.Any(i => i.Disposition is not ("restock" or "warranty" or "discard")))
            return Results.BadRequest(new { message = "Cách xử lý hàng trả không hợp lệ." });
        if (input.Items.Any(i => i.Refund != (i.Disposition == "restock")))
            return Results.BadRequest(new { message = "Chỉ hàng trả lại kho mới hoàn tiền; hàng bảo hành hoặc bỏ đi không hoàn tiền." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        var sale = await db.Sales.Include(s => s.Items)
            .Include(s => s.Returns).ThenInclude(r => r.Items).AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null) return Results.NotFound(new { message = "Không tìm thấy hoá đơn." });
        if (sale.IsDeleted) return Results.Conflict(new { message = "Hoá đơn đã xoá, không thể thay đổi." });

        var saleItems = sale.Items.ToDictionary(i => i.Id);
        var alreadyReturned = sale.Returns.SelectMany(r => r.Items)
            .GroupBy(i => i.SaleItemId).ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));
        foreach (var group in input.Items.GroupBy(i => i.SaleItemId))
        {
            if (!saleItems.TryGetValue(group.Key, out var original))
                return Results.BadRequest(new { message = "Sản phẩm trả không thuộc hoá đơn này." });
            if (group.Sum(i => i.Quantity) > original.Quantity - alreadyReturned.GetValueOrDefault(group.Key))
                return Results.BadRequest(new { message = $"Số lượng trả của {original.ProductName} vượt quá số đã bán." });
        }

        var saleReturn = new SaleReturn
        {
            SaleId = sale.Id,
            Number = $"TH-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            Reason = input.Reason.Trim(),
            ReturnedAt = DateTime.UtcNow
        };
        foreach (var line in input.Items)
        {
            var original = saleItems[line.SaleItemId];
            var refundAmount = line.Refund ? checked((original.UnitPrice - original.DiscountPerUnit) * line.Quantity) : 0;
            saleReturn.Items.Add(new SaleReturnItem
            {
                SaleItemId = original.Id,
                ProductId = original.ProductId,
                ProductCode = original.ProductCode,
                ProductName = original.ProductName,
                UnitPrice = original.UnitPrice,
                Quantity = line.Quantity,
                Disposition = line.Disposition,
                RefundAmount = refundAmount
            });
            saleReturn.TotalRefund = checked(saleReturn.TotalRefund + refundAmount);

            if (line.Disposition != "restock") continue;
            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == original.ProductId && !p.IsDeleted);
            if (product is null)
                return Results.BadRequest(new { message = $"Sản phẩm {original.ProductName} đã xoá, không thể nhập lại kho." });
            await db.Products.Where(p => p.Id == product.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.Quantity, p => p.Quantity + line.Quantity)
                    .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));
            db.StockMovements.Add(NewMovement(product, line.Quantity, "Trả hàng nhập kho", sale.Number));
        }
        db.SaleReturns.Add(saleReturn);
        var debt = await db.DebtAccounts.Include(d => d.Payments)
            .FirstOrDefaultAsync(d => d.SourceType == "sale" && d.SourceId == id);
        if (debt is not null)
            debt.Principal = Math.Max(debt.Payments.Sum(p => p.Amount), debt.Principal - saleReturn.TotalRefund);
        await db.SaveChangesAsync();
        foreach (var item in saleReturn.Items.Where(i => i.Disposition == "warranty"))
        {
            db.WarrantyCases.Add(new WarrantyCase
            {
                Number = WarrantyEndpoints.NewNumber(),
                Source = "customer",
                SaleNumber = sale.Number,
                SaleReturnItemId = item.Id,
                ProductId = item.ProductId,
                ProductCode = item.ProductCode,
                ProductName = item.ProductName,
                Quantity = item.Quantity,
                CustomerName = sale.CustomerName,
                CustomerPhone = sale.CustomerPhone,
                Issue = saleReturn.Reason,
                Status = "received",
                CreatedAt = saleReturn.ReturnedAt,
                UpdatedAt = saleReturn.ReturnedAt,
                Events = [new WarrantyEvent
                {
                    Status = "received", Note = saleReturn.Reason, At = saleReturn.ReturnedAt
                }]
            });
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Created($"/api/sales/by-number/{Uri.EscapeDataString(sale.Number)}", saleReturn);
    }

    // Giữ trạng thái bảo hành trong hóa đơn đồng bộ với trang Bảo hành.
    private static async Task<IResult> ResolveWarranty(InventoryDb db, int id, WarrantyResolutionInput input)
    {
        if (input.Outcome is not ("returned_to_customer" or "discard"))
            return Results.BadRequest(new { message = "Chọn đã trả lại khách hoặc bỏ đi." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        var item = await db.SaleReturnItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null) return Results.NotFound(new { message = "Không tìm thấy hàng bảo hành." });
        if (item.Disposition != "warranty" || item.WarrantyResolution != "")
            return Results.Conflict(new { message = "Món hàng này không còn chờ xử lý bảo hành." });

        var now = DateTime.UtcNow;
        item.WarrantyResolution = input.Outcome;
        item.WarrantyResolvedAt = now;
        var warranty = await db.WarrantyCases.FirstOrDefaultAsync(w => w.SaleReturnItemId == id);
        if (warranty is not null)
        {
            warranty.Status = input.Outcome == "discard" ? "discarded" : input.Outcome;
            warranty.UpdatedAt = now;
            warranty.CompletedAt = now;
            db.WarrantyEvents.Add(new WarrantyEvent
            {
                WarrantyCaseId = warranty.Id, Status = warranty.Status,
                Note = "Cập nhật từ hoá đơn", At = now
            });
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(item);
    }

    private static StockMovement NewMovement(Product product, int change, string reason, string reference) => new()
    {
        ProductId = product.Id,
        ProductCode = product.Code,
        Change = change,
        Reason = reason,
        Reference = reference,
        At = DateTime.UtcNow
    };
}
