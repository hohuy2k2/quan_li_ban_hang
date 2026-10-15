using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class WarrantyEndpoints
{
    public static void MapWarrantyEndpoints(this WebApplication app)
    {
        app.MapGet("/api/warranties", async (InventoryDb db) =>
            Results.Ok(await db.WarrantyCases.AsNoTracking().Include(w => w.Events).Include(w => w.Units)
                .AsSplitQuery().OrderByDescending(w => w.CreatedAt).ToListAsync()));

        app.MapPost("/api/warranties/internal", CreateInternal);
        app.MapPost("/api/warranties/customer", CreateCustomer);
        app.MapPatch("/api/warranties/{id:int}", UpdateStatus);
        app.MapPut("/api/warranties/{id:int}/details", UpdateDetails);
    }

    // Hàng khách gửi trực tiếp không ảnh hưởng tới tồn kho bán được.
    private static async Task<IResult> CreateCustomer(InventoryDb db, CustomerWarrantyInput input)
    {
        if (input.Quantity <= 0 || string.IsNullOrWhiteSpace(input.Issue) || input.Issue.Length > 500 ||
            (string.IsNullOrWhiteSpace(input.CustomerName) && string.IsNullOrWhiteSpace(input.CustomerPhone)) ||
            input.CustomerName?.Length > 120 || input.CustomerPhone?.Length > 30 || input.SaleNumber?.Length > 60 ||
            !ValidDetails(input.Units, input.Quantity, input.ExpectedReturnOn, input.Partner))
            return Results.BadRequest(new { message = "Thông tin bảo hành của khách không hợp lệ." });

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == input.ProductId && !p.IsDeleted);
        if (product is null)
            return Results.NotFound(new { message = "Không tìm thấy sản phẩm." });

        var now = DateTime.UtcNow;
        var warranty = new WarrantyCase
        {
            Number = NewNumber(),
            Source = "customer",
            SaleNumber = input.SaleNumber?.Trim() ?? "",
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            Quantity = input.Quantity,
            CustomerName = input.CustomerName?.Trim() ?? "",
            CustomerPhone = input.CustomerPhone?.Trim() ?? "",
            Issue = input.Issue.Trim(),
            Partner = input.Partner?.Trim() ?? "",
            Units = BuildUnits(input.Units),
            ExpectedReturnOn = input.ExpectedReturnOn?.Trim() ?? "",
            Status = "received",
            CreatedAt = now,
            UpdatedAt = now,
            Events = [new WarrantyEvent { Status = "received", Note = input.Issue.Trim(), At = now }]
        };
        db.WarrantyCases.Add(warranty);
        await db.SaveChangesAsync();
        return Results.Created($"/api/warranties/{warranty.Id}", warranty);
    }

    // Hàng lỗi nội bộ được tách khỏi tồn kho cho đến khi sửa xong và nhập lại.
    private static async Task<IResult> CreateInternal(InventoryDb db, InternalWarrantyInput input)
    {
        if (input.Quantity <= 0 || string.IsNullOrWhiteSpace(input.Issue) || input.Issue.Length > 500 ||
            !ValidDetails(input.Units, input.Quantity, input.ExpectedReturnOn, input.Partner))
            return Results.BadRequest(new { message = "Chọn số lượng và mô tả lỗi (tối đa 500 ký tự)." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == input.ProductId && !p.IsDeleted);
        if (product is null)
            return Results.NotFound(new { message = "Không tìm thấy sản phẩm." });

        var now = DateTime.UtcNow;
        var changed = await db.Products.Where(p => p.Id == product.Id && !p.IsDeleted && p.Quantity >= input.Quantity)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Quantity, p => p.Quantity - input.Quantity)
                .SetProperty(p => p.UpdatedAt, now));
        if (changed != 1)
            return Results.BadRequest(new { message = "Không đủ hàng trong kho để chuyển sang bảo hành." });

        var warranty = new WarrantyCase
        {
            Number = NewNumber(),
            Source = "internal",
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            Quantity = input.Quantity,
            Issue = input.Issue.Trim(),
            Partner = input.Partner?.Trim() ?? "",
            Units = BuildUnits(input.Units),
            ExpectedReturnOn = input.ExpectedReturnOn?.Trim() ?? "",
            Status = "received",
            CreatedAt = now,
            UpdatedAt = now,
            Events = [new WarrantyEvent { Status = "received", Note = input.Issue.Trim(), At = now }]
        };
        db.WarrantyCases.Add(warranty);
        db.StockMovements.Add(new StockMovement
        {
            ProductId = product.Id, ProductCode = product.Code, Change = -input.Quantity,
            Reason = "Hàng lỗi chuyển bảo hành", Reference = warranty.Number, At = now
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Created($"/api/warranties/{warranty.Id}", warranty);
    }

    // Chỉ cho chuyển trạng thái hợp lệ; nhập lại kho tối đa một lần.
    private static async Task<IResult> UpdateStatus(InventoryDb db, int id, WarrantyUpdateInput input)
    {
        if (input.Note?.Length > 500 || input.Partner?.Length > 120)
            return Results.BadRequest(new { message = "Ghi chú hoặc nơi bảo hành quá dài." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        var warranty = await db.WarrantyCases.FirstOrDefaultAsync(w => w.Id == id);
        if (warranty is null)
            return Results.NotFound(new { message = "Không tìm thấy phiếu bảo hành." });

        var next = input.Status;
        var allowed = warranty.Status switch
        {
            "received" => next is "sent" or "ready" or "discarded",
            "sent" => next is "ready" or "discarded",
            "ready" => next is "returned_to_customer" or "restocked" or "discarded",
            _ => false
        };
        if (!allowed || (next == "returned_to_customer" && warranty.Source != "customer") ||
            (next == "restocked" && warranty.Source != "internal"))
            return Results.Conflict(new { message = "Chuyển trạng thái bảo hành không hợp lệ." });

        var now = DateTime.UtcNow;
        if (next == "restocked")
        {
            var changed = await db.Products.Where(p => p.Id == warranty.ProductId && !p.IsDeleted)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.Quantity, p => p.Quantity + warranty.Quantity)
                    .SetProperty(p => p.UpdatedAt, now));
            if (changed != 1)
                return Results.Conflict(new { message = "Sản phẩm đã xoá. Không thể nhập lại kho." });
            db.StockMovements.Add(new StockMovement
            {
                ProductId = warranty.ProductId, ProductCode = warranty.ProductCode,
                Change = warranty.Quantity, Reason = "Bảo hành xong nhập kho",
                Reference = warranty.Number, At = now
            });
        }

        if (warranty.SaleReturnItemId.HasValue && next is ("returned_to_customer" or "discarded"))
        {
            var returnItem = await db.SaleReturnItems
                .FirstOrDefaultAsync(i => i.Id == warranty.SaleReturnItemId);
            if (returnItem is null || returnItem.WarrantyResolution != "")
                return Results.Conflict(new { message = "Trạng thái hàng bảo hành trong hoá đơn đã thay đổi." });
            returnItem.WarrantyResolution = next == "discarded" ? "discard" : next;
            returnItem.WarrantyResolvedAt = now;
        }

        warranty.Status = next;
        warranty.Partner = input.Partner?.Trim() ?? warranty.Partner;
        warranty.UpdatedAt = now;
        if (next is "returned_to_customer" or "restocked" or "discarded")
            warranty.CompletedAt = now;
        db.WarrantyEvents.Add(new WarrantyEvent
        {
            WarrantyCaseId = warranty.Id, Status = next,
            Note = input.Note?.Trim() ?? "", At = now
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(warranty);
    }

    // Có thể bổ sung serial/ngày hẹn cho phiếu cũ mà không đổi trạng thái hay số lượng.
    private static async Task<IResult> UpdateDetails(InventoryDb db, int id, WarrantyDetailsInput input)
    {
        var warranty = await db.WarrantyCases.Include(w => w.Events).Include(w => w.Units).AsSplitQuery()
            .FirstOrDefaultAsync(w => w.Id == id);
        if (warranty is null)
            return Results.NotFound(new { message = "Không tìm thấy phiếu bảo hành." });
        if (!ValidDetails(input.Units, warranty.Quantity, input.ExpectedReturnOn, input.Partner))
            return Results.BadRequest(new { message = "Serial, hạn bảo hành, ngày hẹn hoặc nơi bảo hành không hợp lệ." });

        var units = BuildUnits(input.Units);
        var expected = input.ExpectedReturnOn?.Trim() ?? "";
        var partner = input.Partner?.Trim() ?? "";
        var oldUnits = warranty.Units.OrderBy(u => u.Id).Select(u => (u.SerialNumber, u.WarrantyExpiresOn));
        var newUnits = units.Select(u => (u.SerialNumber, u.WarrantyExpiresOn));
        if (oldUnits.SequenceEqual(newUnits) && warranty.ExpectedReturnOn == expected &&
            warranty.Partner == partner)
            return Results.Ok(warranty);

        db.WarrantyUnits.RemoveRange(warranty.Units);
        warranty.Units.Clear();
        warranty.Units.AddRange(units);
        warranty.ExpectedReturnOn = expected;
        warranty.Partner = partner;
        warranty.UpdatedAt = DateTime.UtcNow;
        warranty.Events.Add(new WarrantyEvent
        {
            Status = warranty.Status, Note = "Đã cập nhật serial, hạn bảo hành, ngày hẹn hoặc nơi bảo hành.",
            At = warranty.UpdatedAt
        });
        await db.SaveChangesAsync();
        return Results.Ok(warranty);
    }

    private static List<WarrantyUnit> BuildUnits(List<WarrantyUnitInput>? units) =>
        (units ?? []).Select(u => new WarrantyUnit
        {
            SerialNumber = u.SerialNumber?.Trim() ?? "",
            WarrantyExpiresOn = u.WarrantyExpiresOn?.Trim() ?? ""
        }).ToList();

    private static bool ValidDetails(List<WarrantyUnitInput>? units, int quantity, string? expected, string? partner)
    {
        if (units?.Count > quantity || (partner?.Length ?? 0) > 120 || !ValidDate(expected))
            return false;
        var serials = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var unit in units ?? [])
        {
            var serial = unit.SerialNumber?.Trim();
            if (string.IsNullOrEmpty(serial) || serial.Length > 100 ||
                !ValidDate(unit.WarrantyExpiresOn) || !serials.Add(serial))
                return false;
        }
        return true;
    }

    private static bool ValidDate(string? value) =>
        string.IsNullOrWhiteSpace(value) ||
        DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    public static string NewNumber() =>
        $"BH-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
}