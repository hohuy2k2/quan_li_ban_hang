using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public sealed class Product
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Brand { get; set; } = "";
    public string Category { get; set; } = "";
    public string SearchText { get; set; } = "";
    public long PurchasePrice { get; set; }
    public bool PurchasePriceIncludesTax { get; set; }
    public long SalePrice { get; set; }
    public string ImageUrl { get; set; } = "";
    public string SpecificationsJson { get; set; } = "{}";
    public int Quantity { get; set; }
    public int LowStockThreshold { get; set; } = 5;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class ProductAudit
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public string Action { get; set; } = "";
    public string Summary { get; set; } = "";
    public string ChangesJson { get; set; } = "";
    public DateTime At { get; set; }
}

public sealed class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public int Change { get; set; }
    public string Reason { get; set; } = "";
    public string Reference { get; set; } = "";
    public DateTime At { get; set; }
}

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
public sealed class Sale
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public int? PartyId { get; set; }
    public DateTime SoldAt { get; set; }
    public long Total { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public List<SaleItem> Items { get; set; } = [];
    public List<SaleReturn> Returns { get; set; } = [];
}

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

public sealed class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public long UnitPrice { get; set; }
    public long DiscountPerUnit { get; set; }
    public int Quantity { get; set; }
    public long LineTotal { get; set; }
}

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

// Một bảng tài khoản dùng cho quản trị viên và khách, phân quyền bằng Role.
public sealed class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string SecurityStamp { get; set; } = "";
    public string Role { get; set; } = "customer";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public string ResetCodeProtected { get; set; } = "";
    public DateTime? ResetCodeExpiresAt { get; set; }
    public DateTime? ResetCodeRequestedAt { get; set; }
    public int ResetCodeAttempts { get; set; }
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

public sealed class InventoryDb(DbContextOptions<InventoryDb> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductAudit> ProductAudits => Set<ProductAudit>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockDocument> StockDocuments => Set<StockDocument>();
    public DbSet<StockDocumentLine> StockDocumentLines => Set<StockDocumentLine>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<OnlineOrder> OnlineOrders => Set<OnlineOrder>();
    public DbSet<OnlineOrderItem> OnlineOrderItems => Set<OnlineOrderItem>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<SaleReturn> SaleReturns => Set<SaleReturn>();
    public DbSet<SaleReturnItem> SaleReturnItems => Set<SaleReturnItem>();
    public DbSet<WarrantyCase> WarrantyCases => Set<WarrantyCase>();
    public DbSet<WarrantyEvent> WarrantyEvents => Set<WarrantyEvent>();
    public DbSet<WarrantyUnit> WarrantyUnits => Set<WarrantyUnit>();
    public DbSet<BusinessParty> BusinessParties => Set<BusinessParty>();
    public DbSet<DebtAccount> DebtAccounts => Set<DebtAccount>();
    public DbSet<DebtPayment> DebtPayments => Set<DebtPayment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>().HasIndex(p => p.Code).IsUnique();
        modelBuilder.Entity<Product>().HasIndex(p => p.SearchText);
        modelBuilder.Entity<StockDocument>().HasIndex(d => d.Number).IsUnique();
        modelBuilder.Entity<StockDocument>().HasMany(d => d.Lines).WithOne().HasForeignKey(l => l.StockDocumentId);
        modelBuilder.Entity<Sale>().HasIndex(s => s.Number).IsUnique();
        modelBuilder.Entity<Sale>().HasMany(s => s.Items).WithOne().HasForeignKey(i => i.SaleId);
        modelBuilder.Entity<OnlineOrder>().HasIndex(o => o.Number).IsUnique();
        modelBuilder.Entity<OnlineOrder>().HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OnlineOrderId);
        modelBuilder.Entity<OnlineOrder>().HasIndex(o => o.CustomerUserId);
        modelBuilder.Entity<AppUser>().HasIndex(u => u.NormalizedEmail).IsUnique();
        modelBuilder.Entity<Sale>().HasMany(s => s.Returns).WithOne().HasForeignKey(r => r.SaleId);
        modelBuilder.Entity<SaleReturn>().HasIndex(r => r.Number).IsUnique();
        modelBuilder.Entity<SaleReturn>().HasMany(r => r.Items).WithOne().HasForeignKey(i => i.SaleReturnId);
        modelBuilder.Entity<SaleReturnItem>().HasIndex(i => i.SaleItemId);
        modelBuilder.Entity<WarrantyCase>().HasIndex(w => w.Number).IsUnique();
        modelBuilder.Entity<WarrantyCase>().HasIndex(w => w.SaleReturnItemId).IsUnique();
        modelBuilder.Entity<WarrantyCase>().HasMany(w => w.Events).WithOne().HasForeignKey(e => e.WarrantyCaseId);
        modelBuilder.Entity<WarrantyCase>().HasMany(w => w.Units).WithOne().HasForeignKey(u => u.WarrantyCaseId);
        modelBuilder.Entity<ProductAudit>().HasIndex(a => a.ProductId);
        modelBuilder.Entity<StockMovement>().HasIndex(m => m.ProductId);
        modelBuilder.Entity<BusinessParty>().HasIndex(p => new { p.Kind, p.Phone });
        modelBuilder.Entity<BusinessParty>().HasIndex(p => p.AppUserId);
        modelBuilder.Entity<DebtAccount>().HasIndex(d => new { d.SourceType, d.SourceId }).IsUnique();
        modelBuilder.Entity<DebtAccount>().HasOne(d => d.Party).WithMany().HasForeignKey(d => d.PartyId);
        modelBuilder.Entity<DebtAccount>().HasMany(d => d.Payments).WithOne().HasForeignKey(p => p.DebtAccountId);
    }
}

public sealed record ProductInput(
    string Code,
    string Name,
    string Brand,
    string Category,
    long PurchasePrice,
    bool PurchasePriceIncludesTax,
    long SalePrice,
    int Quantity,
    int LowStockThreshold,
    string? ImageUrl = null,
    Dictionary<string, string>? Specifications = null);

public sealed record StockDocumentLineInput(int ProductId, int Quantity, long? PurchasePrice, bool? PurchasePriceIncludesTax);
public sealed record StockDocumentInput(string Kind, string DocumentDate, string? Supplier, string? Reason, List<StockDocumentLineInput> Items, int? SupplierId = null, long? PaidAmount = null, string? DueDate = null);
public sealed record SaleLineInput(int ProductId, int Quantity, long DiscountPerUnit = 0);
public sealed record SaleInput(string? CustomerName, string? CustomerPhone, List<SaleLineInput> Items, int? CustomerId = null, long? PaidAmount = null, string? DueDate = null);
public sealed record OnlineOrderLineInput(int ProductId, int Quantity);
public sealed record OnlineOrderInput(string? CustomerName, string? CustomerPhone, string? Fulfillment, string? Address, string? Note, List<OnlineOrderLineInput>? Items);
public sealed record ReturnLineInput(int SaleItemId, int Quantity, string Disposition, bool Refund);
public sealed record SaleReturnInput(string? Reason, List<ReturnLineInput> Items);
public sealed record WarrantyResolutionInput(string Outcome);
public sealed record WarrantyUnitInput(string? SerialNumber, string? WarrantyExpiresOn);
public sealed record InternalWarrantyInput(int ProductId, int Quantity, string? Issue, List<WarrantyUnitInput>? Units = null, string? ExpectedReturnOn = null, string? Partner = null);
public sealed record CustomerWarrantyInput(int ProductId, int Quantity, string? CustomerName, string? CustomerPhone, string? SaleNumber, string? Issue, List<WarrantyUnitInput>? Units = null, string? ExpectedReturnOn = null, string? Partner = null);
public sealed record WarrantyUpdateInput(string Status, string? Note, string? Partner);
public sealed record WarrantyDetailsInput(List<WarrantyUnitInput>? Units, string? ExpectedReturnOn, string? Partner);
