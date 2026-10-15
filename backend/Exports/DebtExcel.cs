using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;

namespace InventoryApp;

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
