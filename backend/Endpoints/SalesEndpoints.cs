using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class SalesEndpoints
{
    public static void MapSalesEndpoints(this WebApplication app)
    {
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
                    Unit = product.Unit,
                    UnitPrice = product.SalePrice,
                    DiscountPerUnit = line.DiscountPerUnit,
                    Quantity = line.Quantity,
                    LineTotal = lineTotal
                });
                db.StockMovements.Add(ProductEndpoints.Movement(product, -line.Quantity, "Bán hàng", sale.Number));
                sale.Total = checked(sale.Total + lineTotal);
            }

            var paid = input.PaidAmount ?? sale.Total;
            if (paid > sale.Total) return Results.BadRequest(new { message = "Số tiền đã trả vượt tổng hoá đơn." });
            if (paid < sale.Total && party is null)
                return Results.BadRequest(new { message = "Bán chịu cần chọn hoặc nhập thông tin khách hàng." });
            sale.PaidAtSale = paid;
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
    }
}
