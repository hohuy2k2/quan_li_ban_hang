using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

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
