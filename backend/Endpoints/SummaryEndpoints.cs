using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class SummaryEndpoints
{
    public static void MapSummaryEndpoints(this WebApplication app)
    {
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
    }
}
