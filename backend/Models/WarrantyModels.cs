namespace InventoryApp;

public sealed class WarrantyCase
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string Source { get; set; } = "";
    public string SaleNumber { get; set; } = "";
    public int? SaleReturnItemId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public int Quantity { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Issue { get; set; } = "";
    public string Partner { get; set; } = "";
    public string ExpectedReturnOn { get; set; } = "";
    public string Status { get; set; } = "received";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<WarrantyEvent> Events { get; set; } = [];
    public List<WarrantyUnit> Units { get; set; } = [];
}

// Mỗi món trong một phiếu có serial và hạn bảo hành riêng.
public sealed class WarrantyUnit
{
    public int Id { get; set; }
    public int WarrantyCaseId { get; set; }
    public string SerialNumber { get; set; } = "";
    public string WarrantyExpiresOn { get; set; } = "";
}

public sealed class WarrantyEvent
{
    public int Id { get; set; }
    public int WarrantyCaseId { get; set; }
    public string Status { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed record WarrantyResolutionInput(string Outcome);

public sealed record WarrantyUnitInput(string? SerialNumber, string? WarrantyExpiresOn);

public sealed record InternalWarrantyInput(int ProductId, int Quantity, string? Issue, List<WarrantyUnitInput>? Units = null, string? ExpectedReturnOn = null, string? Partner = null);

public sealed record CustomerWarrantyInput(int ProductId, int Quantity, string? CustomerName, string? CustomerPhone, string? SaleNumber, string? Issue, List<WarrantyUnitInput>? Units = null, string? ExpectedReturnOn = null, string? Partner = null);

public sealed record WarrantyUpdateInput(string Status, string? Note, string? Partner);

public sealed record WarrantyDetailsInput(List<WarrantyUnitInput>? Units, string? ExpectedReturnOn, string? Partner);
