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
        AddColumnIfMissing(db, "Products", "ImageUrl", "TEXT NOT NULL DEFAULT ''");
        AddColumnIfMissing(db, "Products", "SpecificationsJson", "TEXT NOT NULL DEFAULT '{}'");

        // Đơn website được thêm vào DB cũ mà không cần xoá dữ liệu đang có.
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "OnlineOrders" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_OnlineOrders" PRIMARY KEY AUTOINCREMENT,
                "Number" TEXT NOT NULL, "CustomerName" TEXT NOT NULL,
                "CustomerPhone" TEXT NOT NULL, "Fulfillment" TEXT NOT NULL,
                "Address" TEXT NOT NULL, "Note" TEXT NOT NULL,
                "Status" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL,
                "ProcessedAt" TEXT NULL, "SaleId" INTEGER NULL, "Total" INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "OnlineOrderItems" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_OnlineOrderItems" PRIMARY KEY AUTOINCREMENT,
                "OnlineOrderId" INTEGER NOT NULL, "ProductId" INTEGER NOT NULL,
                "ProductCode" TEXT NOT NULL, "ProductName" TEXT NOT NULL,
                "UnitPrice" INTEGER NOT NULL, "Quantity" INTEGER NOT NULL,
                "LineTotal" INTEGER NOT NULL,
                CONSTRAINT "FK_OnlineOrderItems_OnlineOrders_OnlineOrderId"
                    FOREIGN KEY ("OnlineOrderId") REFERENCES "OnlineOrders" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_OnlineOrders_Number" ON "OnlineOrders" ("Number");
            CREATE INDEX IF NOT EXISTS "IX_OnlineOrderItems_OnlineOrderId" ON "OnlineOrderItems" ("OnlineOrderId");
            """);
        AddColumnIfMissing(db, "OnlineOrders", "CustomerUserId", "INTEGER NULL");
        db.Database.ExecuteSqlRaw("""
            CREATE INDEX IF NOT EXISTS "IX_OnlineOrders_CustomerUserId" ON "OnlineOrders" ("CustomerUserId");
            CREATE TABLE IF NOT EXISTS "AppUsers" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_AppUsers" PRIMARY KEY AUTOINCREMENT,
                "Email" TEXT NOT NULL, "NormalizedEmail" TEXT NOT NULL,
                "DisplayName" TEXT NOT NULL, "Phone" TEXT NOT NULL,
                "PasswordHash" TEXT NOT NULL, "SecurityStamp" TEXT NOT NULL,
                "Role" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_AppUsers_NormalizedEmail" ON "AppUsers" ("NormalizedEmail");
            """);
        AddColumnIfMissing(db, "AppUsers", "IsActive", "INTEGER NOT NULL DEFAULT 1");
        AddColumnIfMissing(db, "AppUsers", "ResetCodeProtected", "TEXT NOT NULL DEFAULT ''");
        AddColumnIfMissing(db, "AppUsers", "ResetCodeExpiresAt", "TEXT NULL");
        AddColumnIfMissing(db, "AppUsers", "ResetCodeRequestedAt", "TEXT NULL");
        AddColumnIfMissing(db, "AppUsers", "ResetCodeAttempts", "INTEGER NOT NULL DEFAULT 0");

        // Hồ sơ CRM và công nợ được thêm vào DB đang dùng, không thay đổi các hoá đơn cũ.
        AddColumnIfMissing(db, "Sales", "PartyId", "INTEGER NULL");
        AddColumnIfMissing(db, "StockDocuments", "PartyId", "INTEGER NULL");
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "BusinessParties" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_BusinessParties" PRIMARY KEY AUTOINCREMENT,
                "Kind" TEXT NOT NULL, "Name" TEXT NOT NULL, "Phone" TEXT NOT NULL,
                "Email" TEXT NOT NULL, "Address" TEXT NOT NULL, "Note" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_BusinessParties_Kind_Phone" ON "BusinessParties" ("Kind", "Phone");
            CREATE TABLE IF NOT EXISTS "DebtAccounts" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_DebtAccounts" PRIMARY KEY AUTOINCREMENT,
                "PartyId" INTEGER NOT NULL, "SourceType" TEXT NOT NULL, "SourceId" INTEGER NULL,
                "Reference" TEXT NOT NULL, "Principal" INTEGER NOT NULL,
                "DueDate" TEXT NOT NULL, "Note" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_DebtAccounts_BusinessParties_PartyId"
                    FOREIGN KEY ("PartyId") REFERENCES "BusinessParties" ("Id") ON DELETE RESTRICT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DebtAccounts_SourceType_SourceId" ON "DebtAccounts" ("SourceType", "SourceId");
            CREATE INDEX IF NOT EXISTS "IX_DebtAccounts_PartyId" ON "DebtAccounts" ("PartyId");
            CREATE TABLE IF NOT EXISTS "DebtPayments" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_DebtPayments" PRIMARY KEY AUTOINCREMENT,
                "DebtAccountId" INTEGER NOT NULL, "Amount" INTEGER NOT NULL,
                "PaidAt" TEXT NOT NULL, "Note" TEXT NOT NULL,
                CONSTRAINT "FK_DebtPayments_DebtAccounts_DebtAccountId"
                    FOREIGN KEY ("DebtAccountId") REFERENCES "DebtAccounts" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_DebtPayments_DebtAccountId" ON "DebtPayments" ("DebtAccountId");
            """);
        AddColumnIfMissing(db, "BusinessParties", "AppUserId", "INTEGER NULL");
        db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_BusinessParties_AppUserId\" ON \"BusinessParties\" (\"AppUserId\");");
        // Các hoá đơn/phiếu nhập cũ chỉ vào danh bạ để tra lịch sử, không phát sinh nợ hồi tố.
        db.Database.ExecuteSqlRaw("""
            INSERT INTO "BusinessParties" ("Kind", "Name", "Phone", "Email", "Address", "Note", "CreatedAt")
            SELECT 'customer', COALESCE(NULLIF(MAX(TRIM(s."CustomerName")), ''), s."CustomerPhone"),
                   TRIM(s."CustomerPhone"), '', '', '', MIN(s."SoldAt")
            FROM "Sales" s WHERE TRIM(s."CustomerPhone") <> ''
            GROUP BY TRIM(s."CustomerPhone")
            HAVING NOT EXISTS (SELECT 1 FROM "BusinessParties" p
                WHERE p."Kind" = 'customer' AND p."Phone" = TRIM(s."CustomerPhone"));
            INSERT INTO "BusinessParties" ("Kind", "Name", "Phone", "Email", "Address", "Note", "CreatedAt")
            SELECT 'supplier', TRIM(d."Supplier"), '', '', '', '', MIN(d."CreatedAt")
            FROM "StockDocuments" d WHERE TRIM(d."Supplier") <> ''
            GROUP BY TRIM(d."Supplier")
            HAVING NOT EXISTS (SELECT 1 FROM "BusinessParties" p
                WHERE p."Kind" = 'supplier' AND p."Name" = TRIM(d."Supplier"));
            UPDATE "Sales" SET "PartyId" = (SELECT p."Id" FROM "BusinessParties" p
                WHERE p."Kind" = 'customer' AND p."Phone" = TRIM("Sales"."CustomerPhone") LIMIT 1)
            WHERE "PartyId" IS NULL AND TRIM("CustomerPhone") <> '';
            UPDATE "StockDocuments" SET "PartyId" = (SELECT p."Id" FROM "BusinessParties" p
                WHERE p."Kind" = 'supplier' AND p."Name" = TRIM("StockDocuments"."Supplier") LIMIT 1)
            WHERE "PartyId" IS NULL AND TRIM("Supplier") <> '';
            UPDATE "BusinessParties" SET "AppUserId" = (
                SELECT u."Id" FROM "AppUsers" u WHERE u."Role" = 'customer'
                  AND (u."NormalizedEmail" = UPPER("BusinessParties"."Email")
                    OR (TRIM(u."Phone") <> '' AND TRIM(u."Phone") = "BusinessParties"."Phone"))
                ORDER BY u."Id" LIMIT 1)
            WHERE "Kind" = 'customer' AND "AppUserId" IS NULL;
            INSERT INTO "BusinessParties"
                ("AppUserId", "Kind", "Name", "Phone", "Email", "Address", "Note", "CreatedAt")
            SELECT u."Id", 'customer', u."DisplayName", u."Phone", u."Email", '', '', u."CreatedAt"
            FROM "AppUsers" u WHERE u."Role" = 'customer'
              AND NOT EXISTS (SELECT 1 FROM "BusinessParties" p WHERE p."AppUserId" = u."Id");
            """);

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

    private static void AddColumnIfMissing(InventoryDb db, string table, string column, string definition)
    {
        var connection = db.Database.GetDbConnection();
        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere) connection.Open();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{table}\");";
            using var reader = command.ExecuteReader();
            var exists = false;
            while (reader.Read())
                if (reader.GetString(1) == column) exists = true;
            reader.Close();
            if (!exists)
            {
                // ExecuteSqlRaw coi dấu { } trong DEFAULT '{}' là chỗ định dạng tham số.
                // Các tên bảng/cột/kiểu chỉ đến từ hằng số nội bộ nên chạy trực tiếp trên kết nối.
                command.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition};";
                command.ExecuteNonQuery();
            }
        }
        finally
        {
            if (openedHere) connection.Close();
        }
    }
}
