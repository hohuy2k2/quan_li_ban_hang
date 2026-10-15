using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class RevenueEndpoints
{
    public static void MapRevenueEndpoints(this WebApplication app)
    {
        // Doanh thu theo ngày/tháng = tiền bán - tiền hoàn trong khoảng đã chọn.
        app.MapGet("/api/revenue", async (InventoryDb db, string? from, string? to) =>
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
            var first = today.AddDays(-29);
            if (!string.IsNullOrWhiteSpace(from) &&
                !DateOnly.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out first))
                return Results.BadRequest(new { message = "Ngày bắt đầu không hợp lệ." });
            var last = today;
            if (!string.IsNullOrWhiteSpace(to) &&
                !DateOnly.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out last))
                return Results.BadRequest(new { message = "Ngày kết thúc không hợp lệ." });
            if (last < first || last.DayNumber - first.DayNumber > 3650)
                return Results.BadRequest(new { message = "Khoảng ngày phải hợp lệ và không quá 10 năm." });

            var fromUtc = TimeZoneInfo.ConvertTimeToUtc(first.ToDateTime(TimeOnly.MinValue), zone);
            var toUtc = TimeZoneInfo.ConvertTimeToUtc(last.AddDays(1).ToDateTime(TimeOnly.MinValue), zone);
            var sales = await db.Sales.AsNoTracking().Where(s => !s.IsDeleted && s.SoldAt >= fromUtc && s.SoldAt < toUtc)
                .Select(s => new { s.SoldAt, s.Total }).ToListAsync();
            var refunds = await db.SaleReturns.AsNoTracking().Where(r => r.ReturnedAt >= fromUtc && r.ReturnedAt < toUtc)
                .Select(r => new { r.ReturnedAt, r.TotalRefund }).ToListAsync();
            var days = new SortedDictionary<string, RevenueRow>();
            foreach (var sale in sales)
            {
                var date = LocalDate(sale.SoldAt, zone);
                var row = GetRow(days, date);
                row.Sales += sale.Total;
                row.Orders++;
            }
            foreach (var refund in refunds)
            {
                var date = LocalDate(refund.ReturnedAt, zone);
                GetRow(days, date).Refunds += refund.TotalRefund;
            }
            var months = days.Values.GroupBy(row => row.Period[..7]).OrderBy(group => group.Key)
                .Select(group => new RevenueRow
                {
                    Period = group.Key, Sales = group.Sum(row => row.Sales),
                    Refunds = group.Sum(row => row.Refunds), Orders = group.Sum(row => row.Orders)
                }).ToList();
            return Results.Ok(new
            {
                from = first.ToString("yyyy-MM-dd"), to = last.ToString("yyyy-MM-dd"),
                sales = sales.Sum(s => s.Total), refunds = refunds.Sum(r => r.TotalRefund),
                revenue = sales.Sum(s => s.Total) - refunds.Sum(r => r.TotalRefund),
                orders = sales.Count,
                days = days.Values.Reverse().ToList(), months = months.AsEnumerable().Reverse().ToList()
            });
        });
    }

    private static string LocalDate(DateTime utc, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString("yyyy-MM-dd");

    private static RevenueRow GetRow(SortedDictionary<string, RevenueRow> rows, string period)
    {
        if (!rows.TryGetValue(period, out var row)) rows[period] = row = new RevenueRow { Period = period };
        return row;
    }

    private sealed class RevenueRow
    {
        public string Period { get; set; } = "";
        public long Sales { get; set; }
        public long Refunds { get; set; }
        public long Revenue => Sales - Refunds;
        public int Orders { get; set; }
    }
}
