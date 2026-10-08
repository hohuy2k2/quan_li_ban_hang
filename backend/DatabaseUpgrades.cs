using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class DatabaseUpgrades
{
    public static void Apply(InventoryDb db)
    {
        var connection = db.Database.GetDbConnection();
        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere) connection.Open();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info('SaleItems');";
            using var reader = command.ExecuteReader();
            var hasDiscount = false;
            while (reader.Read())
                if (reader.GetString(1) == "DiscountPerUnit") hasDiscount = true;
            reader.Close();
            if (!hasDiscount)
                db.Database.ExecuteSqlRaw(
                    "ALTER TABLE \"SaleItems\" ADD COLUMN \"DiscountPerUnit\" INTEGER NOT NULL DEFAULT 0;");

            // EnsureCreated does not alter existing SQLite tables when the model grows.
            command.CommandText = "PRAGMA table_info('Sales');";
            using var saleReader = command.ExecuteReader();
            var hasIsDeleted = false;
            var hasDeletedAt = false;
            while (saleReader.Read())
            {
                if (saleReader.GetString(1) == "IsDeleted") hasIsDeleted = true;
                if (saleReader.GetString(1) == "DeletedAt") hasDeletedAt = true;
            }
            saleReader.Close();
            if (!hasIsDeleted)
                db.Database.ExecuteSqlRaw(
                    "ALTER TABLE \"Sales\" ADD COLUMN \"IsDeleted\" INTEGER NOT NULL DEFAULT 0;");
            if (!hasDeletedAt)
                db.Database.ExecuteSqlRaw(
                    "ALTER TABLE \"Sales\" ADD COLUMN \"DeletedAt\" TEXT NULL;");
        }
        finally
        {
            if (openedHere) connection.Close();
        }

        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "WarrantyCases" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_WarrantyCases" PRIMARY KEY AUTOINCREMENT,
                "Number" TEXT NOT NULL,
                "Source" TEXT NOT NULL,
                "SaleNumber" TEXT NOT NULL,
                "SaleReturnItemId" INTEGER NULL,
                "ProductId" INTEGER NOT NULL,
                "ProductCode" TEXT NOT NULL,
                "ProductName" TEXT NOT NULL,
                "Quantity" INTEGER NOT NULL,
                "CustomerName" TEXT NOT NULL,
                "CustomerPhone" TEXT NOT NULL,
                "Issue" TEXT NOT NULL,
                "Partner" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                "CompletedAt" TEXT NULL
            );
            CREATE TABLE IF NOT EXISTS "WarrantyEvents" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_WarrantyEvents" PRIMARY KEY AUTOINCREMENT,
                "WarrantyCaseId" INTEGER NOT NULL,
                "Status" TEXT NOT NULL,
                "Note" TEXT NOT NULL,
                "At" TEXT NOT NULL,
                CONSTRAINT "FK_WarrantyEvents_WarrantyCases_WarrantyCaseId"
                    FOREIGN KEY ("WarrantyCaseId") REFERENCES "WarrantyCases" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_WarrantyCases_Number" ON "WarrantyCases" ("Number");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_WarrantyCases_SaleReturnItemId"
                ON "WarrantyCases" ("SaleReturnItemId");
            CREATE INDEX IF NOT EXISTS "IX_WarrantyEvents_WarrantyCaseId"
                ON "WarrantyEvents" ("WarrantyCaseId");
            """);

        // DB cũ cần thêm bảng; DB mới đã có sau EnsureCreated.
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "StockDocuments" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_StockDocuments" PRIMARY KEY AUTOINCREMENT,
                "Number" TEXT NOT NULL, "Kind" TEXT NOT NULL, "DocumentDate" TEXT NOT NULL,
                "Supplier" TEXT NOT NULL, "Reason" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "StockDocumentLines" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_StockDocumentLines" PRIMARY KEY AUTOINCREMENT,
                "StockDocumentId" INTEGER NOT NULL, "ProductId" INTEGER NOT NULL,
                "ProductCode" TEXT NOT NULL, "ProductName" TEXT NOT NULL,
                "QuantityBefore" INTEGER NOT NULL, "QuantityChange" INTEGER NOT NULL,
                "QuantityAfter" INTEGER NOT NULL, "PurchasePrice" INTEGER NULL,
                "PurchasePriceIncludesTax" INTEGER NULL,
                CONSTRAINT "FK_StockDocumentLines_StockDocuments_StockDocumentId"
                    FOREIGN KEY ("StockDocumentId") REFERENCES "StockDocuments" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_StockDocuments_Number" ON "StockDocuments" ("Number");
            CREATE INDEX IF NOT EXISTS "IX_StockDocumentLines_StockDocumentId" ON "StockDocumentLines" ("StockDocumentId");
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "WarrantyUnits" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_WarrantyUnits" PRIMARY KEY AUTOINCREMENT,
                "WarrantyCaseId" INTEGER NOT NULL, "SerialNumber" TEXT NOT NULL,
                "WarrantyExpiresOn" TEXT NOT NULL,
                CONSTRAINT "FK_WarrantyUnits_WarrantyCases_WarrantyCaseId"
                    FOREIGN KEY ("WarrantyCaseId") REFERENCES "WarrantyCases" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_WarrantyUnits_WarrantyCaseId" ON "WarrantyUnits" ("WarrantyCaseId");
            """);
        AddWarrantyColumn(db, "ExpectedReturnOn");

        // Existing warranty returns become visible in the new warranty page.
        db.Database.ExecuteSqlRaw("""
            INSERT INTO "WarrantyCases"
                ("Number", "Source", "SaleNumber", "SaleReturnItemId", "ProductId", "ProductCode",
                 "ProductName", "Quantity", "CustomerName", "CustomerPhone", "Issue",
                 "Partner", "Status", "CreatedAt", "UpdatedAt", "CompletedAt")
            SELECT printf('BH-CU-%06d', i."Id"), 'customer', s."Number", i."Id", i."ProductId",
                   i."ProductCode", i."ProductName", i."Quantity",
                   s."CustomerName", s."CustomerPhone", r."Reason", '',
                   CASE i."WarrantyResolution"
                     WHEN 'returned_to_customer' THEN 'returned_to_customer'
                     WHEN 'discard' THEN 'discarded'
                     ELSE 'received' END,
                   r."ReturnedAt", COALESCE(i."WarrantyResolvedAt", r."ReturnedAt"),
                   i."WarrantyResolvedAt"
            FROM "SaleReturnItems" i
            JOIN "SaleReturns" r ON r."Id" = i."SaleReturnId"
            JOIN "Sales" s ON s."Id" = r."SaleId"
            WHERE i."Disposition" = 'warranty'
              AND NOT EXISTS (
                SELECT 1 FROM "WarrantyCases" w WHERE w."SaleReturnItemId" = i."Id"
              );
            """);
    }

    private static void AddWarrantyColumn(InventoryDb db, string name)
    {
        var connection = db.Database.GetDbConnection();
        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere) connection.Open();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info('WarrantyCases');";
            using var reader = command.ExecuteReader();
            var exists = false;
            while (reader.Read())
                if (reader.GetString(1) == name) exists = true;
            reader.Close();
            if (!exists)
            {
                if (name != "ExpectedReturnOn") throw new ArgumentOutOfRangeException(nameof(name));
                db.Database.ExecuteSqlRaw("ALTER TABLE \"WarrantyCases\" ADD COLUMN \"ExpectedReturnOn\" TEXT NOT NULL DEFAULT '';");
            }
        }
        finally
        {
            if (openedHere) connection.Close();
        }
    }
}
