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

public sealed class Sale
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public DateTime SoldAt { get; set; }
    public long Total { get; set; }
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
    public string Status { get; set; } = "received";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<WarrantyEvent> Events { get; set; } = [];
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
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SaleReturn> SaleReturns => Set<SaleReturn>();
    public DbSet<SaleReturnItem> SaleReturnItems => Set<SaleReturnItem>();
    public DbSet<WarrantyCase> WarrantyCases => Set<WarrantyCase>();
    public DbSet<WarrantyEvent> WarrantyEvents => Set<WarrantyEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>().HasIndex(p => p.Code).IsUnique();
        modelBuilder.Entity<Product>().HasIndex(p => p.SearchText);
        modelBuilder.Entity<Sale>().HasIndex(s => s.Number).IsUnique();
        modelBuilder.Entity<Sale>().HasMany(s => s.Items).WithOne().HasForeignKey(i => i.SaleId);
        modelBuilder.Entity<Sale>().HasMany(s => s.Returns).WithOne().HasForeignKey(r => r.SaleId);
        modelBuilder.Entity<SaleReturn>().HasIndex(r => r.Number).IsUnique();
        modelBuilder.Entity<SaleReturn>().HasMany(r => r.Items).WithOne().HasForeignKey(i => i.SaleReturnId);
        modelBuilder.Entity<SaleReturnItem>().HasIndex(i => i.SaleItemId);
        modelBuilder.Entity<WarrantyCase>().HasIndex(w => w.Number).IsUnique();
        modelBuilder.Entity<WarrantyCase>().HasIndex(w => w.SaleReturnItemId).IsUnique();
        modelBuilder.Entity<WarrantyCase>().HasMany(w => w.Events).WithOne().HasForeignKey(e => e.WarrantyCaseId);
        modelBuilder.Entity<ProductAudit>().HasIndex(a => a.ProductId);
        modelBuilder.Entity<StockMovement>().HasIndex(m => m.ProductId);
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
    int LowStockThreshold);

public sealed record SaleLineInput(int ProductId, int Quantity, long DiscountPerUnit = 0);
public sealed record SaleInput(string? CustomerName, string? CustomerPhone, List<SaleLineInput> Items);
public sealed record ReturnLineInput(int SaleItemId, int Quantity, string Disposition, bool Refund);
public sealed record SaleReturnInput(string? Reason, List<ReturnLineInput> Items);
public sealed record WarrantyResolutionInput(string Outcome);
public sealed record InternalWarrantyInput(int ProductId, int Quantity, string? Issue);
public sealed record CustomerWarrantyInput(int ProductId, int Quantity, string? CustomerName, string? CustomerPhone, string? SaleNumber, string? Issue);
public sealed record WarrantyUpdateInput(string Status, string? Note, string? Partner);
