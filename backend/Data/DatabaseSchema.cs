using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class DatabaseSchema
{
    // EnsureCreated does not add new tables to a database that already exists.
    public static void EnsureReturnTables(InventoryDb db)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "SaleReturns" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_SaleReturns" PRIMARY KEY AUTOINCREMENT,
                "SaleId" INTEGER NOT NULL,
                "Number" TEXT NOT NULL,
                "Reason" TEXT NOT NULL,
                "ReturnedAt" TEXT NOT NULL,
                "TotalRefund" INTEGER NOT NULL,
                CONSTRAINT "FK_SaleReturns_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales" ("Id") ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS "SaleReturnItems" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_SaleReturnItems" PRIMARY KEY AUTOINCREMENT,
                "SaleReturnId" INTEGER NOT NULL,
                "SaleItemId" INTEGER NOT NULL,
                "ProductId" INTEGER NOT NULL,
                "ProductCode" TEXT NOT NULL,
                "ProductName" TEXT NOT NULL,
                "UnitPrice" INTEGER NOT NULL,
                "Quantity" INTEGER NOT NULL,
                "Disposition" TEXT NOT NULL,
                "RefundAmount" INTEGER NOT NULL,
                "WarrantyResolution" TEXT NOT NULL,
                "WarrantyResolvedAt" TEXT NULL,
                CONSTRAINT "FK_SaleReturnItems_SaleReturns_SaleReturnId" FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_SaleReturns_SaleId" ON "SaleReturns" ("SaleId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SaleReturns_Number" ON "SaleReturns" ("Number");
            CREATE INDEX IF NOT EXISTS "IX_SaleReturnItems_SaleReturnId" ON "SaleReturnItems" ("SaleReturnId");
            CREATE INDEX IF NOT EXISTS "IX_SaleReturnItems_SaleItemId" ON "SaleReturnItems" ("SaleItemId");
            """);
    }
}
