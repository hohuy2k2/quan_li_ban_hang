namespace InventoryApp;

// Một hồ sơ dùng cho khách hàng hoặc nhà cung cấp; công nợ luôn gắn với hồ sơ này.
public sealed class BusinessParty
{
    public int Id { get; set; }
    public int? AppUserId { get; set; }
    public string Kind { get; set; } = "customer";
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Address { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

// Principal là số tiền còn phải thu/trả ban đầu; thanh toán lưu riêng để giữ lịch sử.
public sealed class DebtAccount
{
    public int Id { get; set; }
    public int PartyId { get; set; }
    public BusinessParty Party { get; set; } = null!;
    public string SourceType { get; set; } = "opening";
    public int? SourceId { get; set; }
    public string Reference { get; set; } = "";
    public long Principal { get; set; }
    public string DueDate { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<DebtPayment> Payments { get; set; } = [];
}

public sealed class DebtPayment
{
    public int Id { get; set; }
    public int DebtAccountId { get; set; }
    public long Amount { get; set; }
    public DateTime PaidAt { get; set; }
    public string Note { get; set; } = "";
}
