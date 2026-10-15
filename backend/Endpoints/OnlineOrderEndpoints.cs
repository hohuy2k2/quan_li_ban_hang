using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class OnlineOrderEndpoints
{
    public static void MapOnlineOrderEndpoints(this WebApplication app)
    {
        // Chỉ trả dữ liệu bán hàng; không đưa giá nhập hay tồn kho chính xác ra website.
        app.MapGet("/api/store/products", async (InventoryDb db) =>
        {
            var products = await db.Products.AsNoTracking().Where(p => !p.IsDeleted)
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    p.Id, p.Code, p.Name, p.Brand, p.Category, p.SalePrice, p.ImageUrl, p.SpecificationsJson,
                    Available = p.Quantity > 0
                }).ToListAsync();
            return Results.Ok(products.Select(p => new
            {
                p.Id, p.Code, p.Name, p.Brand, p.Category, p.SalePrice, p.ImageUrl, p.Available,
                specifications = JsonSerializer.Deserialize<Dictionary<string, string>>(p.SpecificationsJson) ?? []
            }));
        });

        app.MapPost("/api/store/orders", CreateOrder).RequireAuthorization("Customer");
        app.MapGet("/api/store/orders/mine", async (InventoryDb db, ClaimsPrincipal principal) =>
        {
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.Ok(await db.OnlineOrders.AsNoTracking().Include(o => o.Items)
                .Where(o => o.CustomerUserId == userId)
                .OrderByDescending(o => o.CreatedAt).ToListAsync());
        }).RequireAuthorization("Customer");
        app.MapGet("/api/online-orders", async (InventoryDb db) =>
            Results.Ok(await db.OnlineOrders.AsNoTracking().Include(o => o.Items)
                .OrderByDescending(o => o.CreatedAt).ToListAsync()));
        app.MapGet("/api/online-orders/stream", async (HttpContext context, OnlineOrderNotifier notifier) =>
        {
            context.Response.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers["X-Accel-Buffering"] = "no";
            var (id, reader) = notifier.Subscribe();
            try
            {
                await context.Response.WriteAsync(": connected\n\n", context.RequestAborted);
                await context.Response.Body.FlushAsync(context.RequestAborted);
                await foreach (var _ in reader.ReadAllAsync(context.RequestAborted))
                {
                    await context.Response.WriteAsync("event: orders\ndata: updated\n\n", context.RequestAborted);
                    await context.Response.Body.FlushAsync(context.RequestAborted);
                }
            }
            catch (OperationCanceledException) { }
            finally { notifier.Unsubscribe(id); }
        });
        app.MapPost("/api/online-orders/{id:int}/confirm", ConfirmOrder);
        app.MapPost("/api/online-orders/{id:int}/cancel", CancelOrder);
    }

    private static async Task<IResult> CreateOrder(InventoryDb db, ClaimsPrincipal principal, OnlineOrderNotifier notifier, OnlineOrderInput input)
    {
        var name = input.CustomerName?.Trim() ?? "";
        var phone = input.CustomerPhone?.Trim() ?? "";
        var fulfillment = input.Fulfillment?.Trim() ?? "";
        var address = input.Address?.Trim() ?? "";
        var note = input.Note?.Trim() ?? "";
        if (name.Length is < 2 or > 120 || phone.Length is < 9 or > 20 ||
            phone.Count(char.IsDigit) < 9 || phone.Any(c => !char.IsDigit(c) && c is not ('+' or ' ' or '-' or '.')))
            return Results.BadRequest(new { message = "Hãy nhập tên và số điện thoại hợp lệ." });
        if (fulfillment is not ("pickup" or "delivery") || address.Length > 300 ||
            (fulfillment == "delivery" && address.Length < 10) || note.Length > 500)
            return Results.BadRequest(new { message = "Thông tin nhận hàng chưa hợp lệ." });
        if (input.Items is null || input.Items.Count is < 1 or > 50 ||
            input.Items.Any(i => i.Quantity is < 1 or > 99) ||
            input.Items.Select(i => i.ProductId).Distinct().Count() != input.Items.Count)
            return Results.BadRequest(new { message = "Giỏ hàng chưa hợp lệ." });

        var ids = input.Items.Select(i => i.ProductId).ToArray();
        var products = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id) && !p.IsDeleted)
            .ToDictionaryAsync(p => p.Id);
        if (products.Count != ids.Length)
            return Results.BadRequest(new { message = "Có sản phẩm không còn bán." });
        var order = new OnlineOrder
        {
            Number = $"OD-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            CustomerName = name, CustomerPhone = phone,
            CustomerUserId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!),
            Fulfillment = fulfillment, Address = address, Note = note,
            CreatedAt = DateTime.UtcNow
        };
        foreach (var line in input.Items)
        {
            var product = products[line.ProductId];
            if (product.Quantity < line.Quantity)
                return Results.BadRequest(new { message = $"{product.Name} không đủ hàng. Hãy cập nhật giỏ hàng." });
            var lineTotal = checked(product.SalePrice * line.Quantity);
            order.Items.Add(new OnlineOrderItem
            {
                ProductId = product.Id, ProductCode = product.Code, ProductName = product.Name,
                UnitPrice = product.SalePrice, Quantity = line.Quantity, LineTotal = lineTotal
            });
            order.Total = checked(order.Total + lineTotal);
        }
        db.OnlineOrders.Add(order);
        await db.SaveChangesAsync();
        notifier.Publish();
        return Results.Created($"/api/store/orders/{order.Id}", new { order.Number, order.Total });
    }

    private static async Task<IResult> ConfirmOrder(InventoryDb db, OnlineOrderNotifier notifier, int id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var order = await db.OnlineOrders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null) return Results.NotFound(new { message = "Không tìm thấy đơn online." });
        if (order.Status != "pending")
            return Results.Conflict(new { message = "Đơn này đã được xử lý." });

        var now = DateTime.UtcNow;
        // Khoá trạng thái đơn trong cùng giao dịch để thao tác huỷ không chạy đồng thời.
        var claimed = await db.OnlineOrders.Where(o => o.Id == id && o.Status == "pending")
            .ExecuteUpdateAsync(setters => setters.SetProperty(o => o.Status, "processing"));
        if (claimed != 1)
            return Results.Conflict(new { message = "Đơn này đã được xử lý." });
        var sale = new Sale
        {
            Number = $"HD-{DateTime.Now:yyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            CustomerName = order.CustomerName, CustomerPhone = order.CustomerPhone,
            SoldAt = now, Total = order.Total, PaidAtSale = 0
        };
        var party = await DebtEndpoints.ResolveParty(db, "customer", null, order.CustomerName, order.CustomerPhone);
        if (party is not null) sale.PartyId = party.Id;
        foreach (var line in order.Items)
        {
            var changed = await db.Products.Where(p => p.Id == line.ProductId && !p.IsDeleted && p.Quantity >= line.Quantity)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.Quantity, p => p.Quantity - line.Quantity)
                    .SetProperty(p => p.UpdatedAt, now));
            if (changed != 1)
                return Results.Conflict(new { message = $"{line.ProductName} không đủ tồn kho. Đơn vẫn chờ xử lý." });
            sale.Items.Add(new SaleItem
            {
                ProductId = line.ProductId, ProductCode = line.ProductCode,
                ProductName = line.ProductName, UnitPrice = line.UnitPrice,
                Unit = (await db.Products.AsNoTracking().FirstAsync(p => p.Id == line.ProductId)).Unit,
                Quantity = line.Quantity, LineTotal = line.LineTotal
            });
            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId, ProductCode = line.ProductCode,
                Change = -line.Quantity, Reason = "Bán từ website",
                Reference = sale.Number, At = now
            });
        }
        db.Sales.Add(sale);
        await db.SaveChangesAsync();
        // Xác nhận đơn online chưa đồng nghĩa đã nhận tiền; ghi công nợ để thu khi giao/nhận.
        if (party is not null && sale.Total > 0)
        {
            db.DebtAccounts.Add(new DebtAccount
            {
                PartyId = party.Id, SourceType = "sale", SourceId = sale.Id,
                Reference = sale.Number, Principal = sale.Total, CreatedAt = now,
                Note = "Đơn online chưa ghi nhận thanh toán"
            });
            await db.SaveChangesAsync();
        }
        order.Status = "confirmed";
        order.ProcessedAt = now;
        order.SaleId = sale.Id;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        notifier.Publish();
        return Results.Ok(order);
    }

    private static async Task<IResult> CancelOrder(InventoryDb db, OnlineOrderNotifier notifier, int id)
    {
        var now = DateTime.UtcNow;
        var changed = await db.OnlineOrders.Where(o => o.Id == id && o.Status == "pending")
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(o => o.Status, "cancelled")
                .SetProperty(o => o.ProcessedAt, now));
        if (changed != 1)
            return await db.OnlineOrders.AnyAsync(o => o.Id == id)
                ? Results.Conflict(new { message = "Chỉ huỷ được đơn chưa xác nhận." })
                : Results.NotFound(new { message = "Không tìm thấy đơn online." });
        notifier.Publish();
        return Results.Ok(await db.OnlineOrders.Include(o => o.Items).FirstAsync(o => o.Id == id));
    }
}
