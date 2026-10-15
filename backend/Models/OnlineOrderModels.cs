namespace InventoryApp;

// Đơn khách gửi từ website chỉ thành hoá đơn sau khi cửa hàng xác nhận.
public sealed class OnlineOrder
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Fulfillment { get; set; } = "pickup";
    public string Address { get; set; } = "";
    public string Note { get; set; } = "";
    public string Status { get; set; } = "pending";
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public int? SaleId { get; set; }
    public int? CustomerUserId { get; set; }
    public long Total { get; set; }
    public List<OnlineOrderItem> Items { get; set; } = [];
}

public sealed class OnlineOrderItem
{
    public int Id { get; set; }
    public int OnlineOrderId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public long UnitPrice { get; set; }
    public int Quantity { get; set; }
    public long LineTotal { get; set; }
}

public sealed record OnlineOrderLineInput(int ProductId, int Quantity);

public sealed record OnlineOrderInput(string? CustomerName, string? CustomerPhone, string? Fulfillment, string? Address, string? Note, List<OnlineOrderLineInput>? Items);
