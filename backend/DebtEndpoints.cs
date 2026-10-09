using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public sealed record PartyInput(string Kind, string Name, string? Phone, string? Email, string? Address, string? Note);
public sealed record OpeningDebtInput(int PartyId, long Amount, string? DueDate, string? Note);
public sealed record DebtPaymentInput(long Amount, string? PaidOn, string? Note);

public static class DebtEndpoints
{
    public static void MapDebtEndpoints(this WebApplication app)
    {
        app.MapGet("/api/parties", async (InventoryDb db, string? kind) =>
        {
            if (!ValidKind(kind, true)) return Results.BadRequest(new { message = "Loại hồ sơ không hợp lệ." });
            var parties = await db.BusinessParties.AsNoTracking()
                .Where(p => kind == null || p.Kind == kind).OrderBy(p => p.Name).ToListAsync();
            var debts = await db.DebtAccounts.AsNoTracking().Include(d => d.Payments).ToListAsync();
            return Results.Ok(parties.Select(p => new
            {
                p.Id, p.Kind, p.Name, p.Phone, p.Email, p.Address, p.Note, p.CreatedAt,
                Balance = debts.Where(d => d.PartyId == p.Id).Sum(d => d.Principal - d.Payments.Sum(x => x.Amount))
            }));
        });
        app.MapPost("/api/parties", async (InventoryDb db, PartyInput input) =>
        {
            var error = ValidateParty(input);
            if (error is not null) return Results.BadRequest(new { message = error });
            if (await DuplicateParty(db, input, null))
                return Results.Conflict(new { message = "Đã có hồ sơ cùng số điện thoại hoặc tên nhà cung cấp." });
            var party = new BusinessParty
            {
                Kind = input.Kind, Name = input.Name.Trim(), Phone = input.Phone?.Trim() ?? "",
                Email = input.Email?.Trim() ?? "", Address = input.Address?.Trim() ?? "",
                Note = input.Note?.Trim() ?? "", CreatedAt = DateTime.UtcNow
            };
            db.BusinessParties.Add(party);
            await db.SaveChangesAsync();
            return Results.Created($"/api/parties/{party.Id}", party);
        });
        app.MapPut("/api/parties/{id:int}", async (InventoryDb db, int id, PartyInput input) =>
        {
            var error = ValidateParty(input);
            if (error is not null) return Results.BadRequest(new { message = error });
            var party = await db.BusinessParties.FindAsync(id);
            if (party is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ." });
            if (party.Kind != input.Kind) return Results.BadRequest(new { message = "Không thể đổi loại khách hàng/nhà cung cấp." });
            if (await DuplicateParty(db, input, id))
                return Results.Conflict(new { message = "Đã có hồ sơ cùng số điện thoại hoặc tên nhà cung cấp." });
            party.Name = input.Name.Trim(); party.Phone = input.Phone?.Trim() ?? "";
            party.Email = input.Email?.Trim() ?? ""; party.Address = input.Address?.Trim() ?? "";
            party.Note = input.Note?.Trim() ?? "";
            await db.SaveChangesAsync();
            return Results.Ok(party);
        });
        app.MapGet("/api/parties/{id:int}/history", async (InventoryDb db, int id) =>
        {
            var party = await db.BusinessParties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (party is null) return Results.NotFound(new { message = "Không tìm thấy hồ sơ." });
            if (party.Kind != "customer") return Results.BadRequest(new { message = "Chỉ khách hàng có lịch sử mua." });
            var sales = await db.Sales.AsNoTracking().Include(s => s.Returns)
                .Where(s => !s.IsDeleted && s.PartyId == id)
                .OrderByDescending(s => s.SoldAt).ToListAsync();
            return Results.Ok(new
            {
                Party = party,
                Sales = sales.Select(s => new
                {
                    s.Id, s.Number, s.SoldAt, s.Total,
                    Refunded = s.Returns.Sum(r => r.TotalRefund),
                    NetTotal = s.Total - s.Returns.Sum(r => r.TotalRefund)
                }),
                TotalSpent = sales.Sum(s => s.Total - s.Returns.Sum(r => r.TotalRefund))
            });
        });
        app.MapGet("/api/debts", async (InventoryDb db, string? kind) =>
        {
            if (!ValidKind(kind, true)) return Results.BadRequest(new { message = "Loại công nợ không hợp lệ." });
            var accounts = await db.DebtAccounts.AsNoTracking().Include(d => d.Party)
                .Include(d => d.Payments).AsSplitQuery()
                .Where(d => kind == null || d.Party.Kind == kind)
                .OrderByDescending(d => d.CreatedAt).ToListAsync();
            return Results.Ok(accounts.Select(ProjectDebt));
        });
        app.MapPost("/api/debts/opening", async (InventoryDb db, OpeningDebtInput input) =>
        {
            if (input.Amount <= 0 || input.Amount > 1_000_000_000_000 ||
                !ValidDate(input.DueDate) || input.Note?.Length > 500)
                return Results.BadRequest(new { message = "Số tiền, hạn thanh toán hoặc ghi chú không hợp lệ." });
            var party = await db.BusinessParties.FindAsync(input.PartyId);
            if (party is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng/nhà cung cấp." });
            var debt = new DebtAccount
            {
                PartyId = party.Id, Party = party, SourceType = "opening", Reference = $"CN-{DateTime.Now:yyMMdd}-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
                Principal = input.Amount, DueDate = input.DueDate ?? "", Note = input.Note?.Trim() ?? "", CreatedAt = DateTime.UtcNow
            };
            db.DebtAccounts.Add(debt);
            await db.SaveChangesAsync();
            return Results.Created($"/api/debts/{debt.Id}", ProjectDebt(debt));
        });
        app.MapPost("/api/debts/{id:int}/payments", async (InventoryDb db, int id, DebtPaymentInput input) =>
        {
            if (input.Amount <= 0 || input.Amount > 1_000_000_000_000 || !ValidDate(input.PaidOn) || input.Note?.Length > 500)
                return Results.BadRequest(new { message = "Số tiền, ngày trả hoặc ghi chú không hợp lệ." });
            await using var transaction = await db.Database.BeginTransactionAsync();
            var debt = await db.DebtAccounts.Include(d => d.Payments).FirstOrDefaultAsync(d => d.Id == id);
            if (debt is null) return Results.NotFound(new { message = "Không tìm thấy khoản công nợ." });
            var balance = debt.Principal - debt.Payments.Sum(p => p.Amount);
            if (input.Amount > balance) return Results.Conflict(new { message = "Số tiền trả vượt công nợ còn lại." });
            var paidAt = string.IsNullOrWhiteSpace(input.PaidOn)
                ? DateTime.UtcNow
                : DateOnly.ParseExact(input.PaidOn, "yyyy-MM-dd", CultureInfo.InvariantCulture).ToDateTime(TimeOnly.MinValue).ToUniversalTime();
            var payment = new DebtPayment { DebtAccountId = id, Amount = input.Amount, PaidAt = paidAt, Note = input.Note?.Trim() ?? "" };
            db.DebtPayments.Add(payment);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Results.Created($"/api/debts/{id}/payments/{payment.Id}", payment);
        });
        app.MapGet("/api/debts/export.xlsx", async (InventoryDb db, string? kind) =>
        {
            if (!ValidKind(kind, true)) return Results.BadRequest(new { message = "Loại công nợ không hợp lệ." });
            var debts = await db.DebtAccounts.AsNoTracking().Include(d => d.Party)
                .Include(d => d.Payments).AsSplitQuery()
                .Where(d => kind == null || d.Party.Kind == kind).OrderBy(d => d.Party.Name)
                .ThenBy(d => d.CreatedAt).ToListAsync();
            var bytes = DebtExcel.Export(debts);
            return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"cong-no-{DateTime.Now:yyyy-MM-dd}.xlsx");
        });
        // Sổ chi tiết riêng cho khách: từng hàng bán, tiền thu và số dư theo tháng.
        app.MapGet("/api/parties/{id:int}/statement.xlsx", async (InventoryDb db, int id, int? year) =>
        {
            var selectedYear = year ?? DateTime.Today.Year;
            if (selectedYear is < 2000 or > 2100)
                return Results.BadRequest(new { message = "Năm báo cáo không hợp lệ." });
            var party = await db.BusinessParties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id && p.Kind == "customer");
            if (party is null) return Results.NotFound(new { message = "Không tìm thấy khách hàng." });
            var sales = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Include(s => s.Returns).ThenInclude(r => r.Items).AsSplitQuery()
                .Where(s => !s.IsDeleted && s.PartyId == id).ToListAsync();
            var debts = await db.DebtAccounts.AsNoTracking().Include(d => d.Payments)
                .Where(d => d.PartyId == id).ToListAsync();
            var bytes = CustomerStatementExcel.Export(party, selectedYear, sales, debts);
            return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"cong-no-khach-{id}-{selectedYear}.xlsx");
        });
    }

    /** Ghép giao dịch với hồ sơ có sẵn hoặc lập hồ sơ khi có tên/số điện thoại. */
    public static async Task<BusinessParty?> ResolveParty(InventoryDb db, string kind, int? id, string? name, string? phone)
    {
        if (id.HasValue) return await db.BusinessParties.FirstOrDefaultAsync(p => p.Id == id && p.Kind == kind);
        var trimmedName = name?.Trim() ?? "";
        var trimmedPhone = phone?.Trim() ?? "";
        if (trimmedName == "" && trimmedPhone == "") return null;
        var existing = kind == "customer"
            ? trimmedPhone == "" ? null : await db.BusinessParties.FirstOrDefaultAsync(p => p.Kind == kind && p.Phone == trimmedPhone)
            : await db.BusinessParties.FirstOrDefaultAsync(p => p.Kind == kind && p.Name == trimmedName);
        if (existing is not null) return existing;
        var party = new BusinessParty
        {
            Kind = kind, Name = trimmedName == "" ? trimmedPhone : trimmedName,
            Phone = trimmedPhone, CreatedAt = DateTime.UtcNow
        };
        db.BusinessParties.Add(party);
        await db.SaveChangesAsync();
        return party;
    }

    /** Đồng bộ tài khoản khách đăng ký trên web với danh bạ quản lý. */
    public static async Task SyncCustomerAccount(InventoryDb db, AppUser user)
    {
        if (user.Role != "customer") return;
        var party = await db.BusinessParties.FirstOrDefaultAsync(p => p.AppUserId == user.Id);
        if (party is null)
            party = await db.BusinessParties.FirstOrDefaultAsync(p => p.Kind == "customer" &&
                (p.Email.ToUpper() == user.NormalizedEmail || (user.Phone != "" && p.Phone == user.Phone)));
        if (party is null)
        {
            party = new BusinessParty { Kind = "customer", CreatedAt = DateTime.UtcNow };
            db.BusinessParties.Add(party);
        }
        party.AppUserId = user.Id;
        party.Name = user.DisplayName;
        party.Phone = user.Phone;
        party.Email = user.Email;
        await db.SaveChangesAsync();
    }

    private static object ProjectDebt(DebtAccount d) => new
    {
        d.Id, d.PartyId, PartyName = d.Party?.Name ?? "", PartyKind = d.Party?.Kind ?? "",
        d.SourceType, d.SourceId, d.Reference, d.Principal, d.DueDate, d.Note, d.CreatedAt,
        Paid = d.Payments.Sum(p => p.Amount), Balance = d.Principal - d.Payments.Sum(p => p.Amount),
        Payments = d.Payments.OrderByDescending(p => p.PaidAt).ToList()
    };

    private static bool ValidKind(string? kind, bool optional = false) =>
        (optional && string.IsNullOrWhiteSpace(kind)) || kind is "customer" or "supplier";
    private static bool ValidDate(string? value) => string.IsNullOrWhiteSpace(value) ||
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static string? ValidateParty(PartyInput input)
    {
        if (!ValidKind(input.Kind) || string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 160 ||
            input.Phone?.Length > 30 || input.Email?.Length > 254 ||
            input.Address?.Length > 300 || input.Note?.Length > 500)
            return "Thông tin hồ sơ không hợp lệ.";
        return null;
    }

    private static Task<bool> DuplicateParty(InventoryDb db, PartyInput input, int? exceptId)
    {
        var phone = input.Phone?.Trim() ?? "";
        var name = input.Name.Trim().ToUpperInvariant();
        return input.Kind == "customer"
            ? phone == "" ? Task.FromResult(false) : db.BusinessParties.AnyAsync(p => p.Kind == "customer" && p.Phone == phone && p.Id != exceptId)
            : db.BusinessParties.AnyAsync(p => p.Kind == "supplier" && p.Name.ToUpper() == name && p.Id != exceptId);
    }
}

// XLSX tối giản gồm hai sheet: chứng từ công nợ và từng lần thanh toán.
internal static class DebtExcel
{
    public static byte[] Export(List<DebtAccount> debts)
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            Add(zip, "[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""");
            Add(zip, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            Add(zip, "xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cong no" sheetId="1" r:id="rId1"/><sheet name="Thanh toan" sheetId="2" r:id="rId2"/></sheets></workbook>""");
            Add(zip, "xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>""");
            var debtRows = new List<object[]> { new object[] { "Loại", "Tên", "Số điện thoại", "Chứng từ", "Ngày", "Hạn trả", "Nợ ban đầu", "Đã trả", "Còn nợ", "Ghi chú" } };
            var paymentRows = new List<object[]> { new object[] { "Loại", "Tên", "Chứng từ", "Ngày thanh toán", "Số tiền", "Ghi chú" } };
            foreach (var debt in debts)
            {
                var paid = debt.Payments.Sum(p => p.Amount);
                debtRows.Add([debt.Party.Kind == "customer" ? "Khách hàng" : "Nhà cung cấp", debt.Party.Name,
                    debt.Party.Phone, debt.Reference, debt.CreatedAt.ToString("yyyy-MM-dd"), debt.DueDate,
                    debt.Principal, paid, debt.Principal - paid, debt.Note]);
                foreach (var payment in debt.Payments.OrderBy(p => p.PaidAt))
                    paymentRows.Add([debt.Party.Kind == "customer" ? "Khách hàng" : "Nhà cung cấp", debt.Party.Name,
                        debt.Reference, payment.PaidAt.ToString("yyyy-MM-dd"), payment.Amount, payment.Note]);
            }
            AddSheet(zip, "xl/worksheets/sheet1.xml", debtRows);
            AddSheet(zip, "xl/worksheets/sheet2.xml", paymentRows);
        }
        return stream.ToArray();
    }

    private static void Add(ZipArchive zip, string path, string xml)
    {
        using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(xml);
    }

    private static void AddSheet(ZipArchive zip, string path, List<object[]> rows)
    {
        using var writer = XmlWriter.Create(zip.CreateEntry(path).Open(), new XmlWriterSettings { Encoding = new UTF8Encoding(false), CloseOutput = true });
        const string ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        writer.WriteStartDocument(); writer.WriteStartElement("worksheet", ns); writer.WriteStartElement("sheetData", ns);
        for (var row = 0; row < rows.Count; row++)
        {
            writer.WriteStartElement("row", ns); writer.WriteAttributeString("r", (row + 1).ToString());
            foreach (var value in rows[row])
            {
                writer.WriteStartElement("c", ns);
                if (value is long number)
                    writer.WriteElementString("v", ns, number.ToString(CultureInfo.InvariantCulture));
                else
                {
                    writer.WriteAttributeString("t", "inlineStr"); writer.WriteStartElement("is", ns);
                    writer.WriteElementString("t", ns, value.ToString()); writer.WriteEndElement();
                }
                writer.WriteEndElement();
            }
            writer.WriteEndElement();
        }
        writer.WriteEndElement(); writer.WriteEndElement(); writer.WriteEndDocument();
    }
}
