namespace InventoryApp;

public sealed class Sale
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public int? PartyId { get; set; }
    public DateTime SoldAt { get; set; }
    public long Total { get; set; }
    // null chỉ dành cho hoá đơn cũ, trước khi phần mềm lưu số đã thu lúc bán.
    public long? PaidAtSale { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public List<SaleItem> Items { get; set; } = [];
    public List<SaleReturn> Returns { get; set; } = [];
}

public sealed class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public string Unit { get; set; } = "cái";
    public long UnitPrice { get; set; }
    public long DiscountPerUnit { get; set; }
    public int Quantity { get; set; }
    public long LineTotal { get; set; }
}

public sealed class SaleReturn
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public string Number { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTime ReturnedAt { get; set; }
    public long TotalRefund { get; set; }
    public List<SaleReturnItem> Items { get; set; } = [];
}

public sealed class SaleReturnItem
{
    public int Id { get; set; }
    public int SaleReturnId { get; set; }
    public int SaleItemId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public long UnitPrice { get; set; }
    public int Quantity { get; set; }
    public string Disposition { get; set; } = "";
    public long RefundAmount { get; set; }
    public string WarrantyResolution { get; set; } = "";
    public DateTime? WarrantyResolvedAt { get; set; }
}

public sealed record SaleLineInput(int ProductId, int Quantity, long DiscountPerUnit = 0);

public sealed record SaleInput(string? CustomerName, string? CustomerPhone, List<SaleLineInput> Items, int? CustomerId = null, long? PaidAmount = null, string? DueDate = null);

public sealed record ReturnLineInput(int SaleItemId, int Quantity, string Disposition, bool Refund);

public sealed record SaleReturnInput(string? Reason, List<ReturnLineInput> Items);
