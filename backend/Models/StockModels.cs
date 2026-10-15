namespace InventoryApp;

// Phiếu kho lưu số lượng trước/sau để đối chiếu.
public sealed class StockDocument
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string Kind { get; set; } = "";
    public string DocumentDate { get; set; } = "";
    public string Supplier { get; set; } = "";
    public int? PartyId { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<StockDocumentLine> Lines { get; set; } = [];
}

public sealed class StockDocumentLine
{
    public int Id { get; set; }
    public int StockDocumentId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public int QuantityBefore { get; set; }
    public int QuantityChange { get; set; }
    public int QuantityAfter { get; set; }
    public long? PurchasePrice { get; set; }
    public bool? PurchasePriceIncludesTax { get; set; }
}

public sealed record StockDocumentLineInput(int ProductId, int Quantity, long? PurchasePrice, bool? PurchasePriceIncludesTax);

public sealed record StockDocumentInput(string Kind, string DocumentDate, string? Supplier, string? Reason, List<StockDocumentLineInput> Items, int? SupplierId = null, long? PaidAmount = null, string? DueDate = null);
