using ClosedXML.Excel;

namespace InventoryApp;

// Sổ gửi khách lấy số liệu từ hoá đơn và lịch sử thanh toán, không ghi lại vào DB.
internal static class CustomerStatementExcel
{
    private sealed record Entry(DateTime At, int Order, string Kind, string Reference, long Amount,
        Sale? Sale = null, SaleReturn? Return = null, string Note = "");

    public static byte[] Export(BusinessParty party, int year, IReadOnlyList<Sale> sales, IReadOnlyList<DebtAccount> debts)
    {
        var entries = BuildEntries(sales, debts).OrderBy(e => e.At).ThenBy(e => e.Order).ThenBy(e => e.Reference).ToList();
        var inYear = entries.Where(e => e.At.Year == year).ToList();
        var months = inYear.Select(e => e.At.Month).Distinct().OrderBy(m => m).ToList();
        if (months.Count == 0) months.Add(12); // vẫn cho xem số dư chuyển sang cuối năm.

        using var book = new XLWorkbook();
        foreach (var month in months)
        {
            var sheet = book.Worksheets.Add($"Tháng {month}");
            var opening = entries.Where(e => e.At < new DateTime(year, month, 1)).Sum(e => e.Amount);
            WriteMonth(sheet, party, year, month, opening, inYear.Where(e => e.At.Month == month).ToList());
        }
        using var stream = new MemoryStream();
        book.SaveAs(stream);
        return stream.ToArray();
    }

    // Quy đổi dữ liệu công nợ thành các khoản tăng/giảm; hoàn tiền mặt không làm thay đổi nợ.
    private static List<Entry> BuildEntries(IReadOnlyList<Sale> sales, IReadOnlyList<DebtAccount> debts)
    {
        var result = new List<Entry>();
        var saleDebts = debts.Where(d => d.SourceType == "sale" && d.SourceId.HasValue)
            .GroupBy(d => d.SourceId!.Value).ToDictionary(g => g.Key, g => g.First());
        foreach (var sale in sales)
        {
            saleDebts.TryGetValue(sale.Id, out var debt);
            var refundTotal = sale.Returns.Sum(r => r.TotalRefund);
            var paidAtSale = sale.PaidAtSale ?? (debt is null
                ? sale.Total : Math.Clamp(sale.Total - debt.Principal - refundTotal, 0, sale.Total));
            result.Add(new Entry(Local(sale.SoldAt), 0, "sale", sale.Number, sale.Total, sale,
                Note: sale.PaidAtSale is null && debt is not null ? "số đã thu lúc bán ước tính từ dữ liệu cũ" : ""));
            if (paidAtSale > 0)
                result.Add(new Entry(Local(sale.SoldAt), 1, "paid-at-sale", sale.Number, -paidAtSale,
                    Note: sale.PaidAtSale is null && debt is not null ? "Số đã thu ước tính từ dữ liệu cũ" : ""));

            var creditRemaining = Math.Max(0, sale.Total - paidAtSale - (debt?.Principal ?? 0));
            long creditedTotal = 0;
            foreach (var returned in sale.Returns.OrderBy(r => r.ReturnedAt))
            {
                var credit = Math.Min(returned.TotalRefund, creditRemaining);
                creditRemaining -= credit;
                creditedTotal += credit;
                result.Add(new Entry(Local(returned.ReturnedAt), 2, "return", returned.Number, -credit,
                    Sale: sale, Return: returned, Note: $"Trả hàng của {sale.Number}"));
            }
            if (debt is not null)
            {
                // Sau các dòng trả hàng, đối chiếu về đúng gốc nợ đang lưu, kể cả dữ liệu cũ đã sửa.
                var represented = sale.Total - paidAtSale - creditedTotal;
                var adjustment = debt.Principal - represented;
                if (adjustment != 0)
                    result.Add(new Entry(Local(sale.SoldAt), 3, "adjustment", sale.Number, adjustment,
                        Note: "Điều chỉnh công nợ theo hoá đơn hiện tại"));
            }
        }
        foreach (var debt in debts)
        {
            if (debt.SourceType == "opening" || (debt.SourceType == "sale" && sales.All(s => s.Id != debt.SourceId)))
                result.Add(new Entry(Local(debt.CreatedAt), 0, "opening", debt.Reference, debt.Principal,
                    Note: debt.Note));
            foreach (var payment in debt.Payments)
                result.Add(new Entry(Local(payment.PaidAt), 4, "payment", debt.Reference, -payment.Amount,
                    Note: payment.Note));
        }
        return result;
    }

    private static DateTime Local(DateTime value) => TimeZoneInfo.ConvertTimeFromUtc(
        DateTime.SpecifyKind(value, DateTimeKind.Utc),
        TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"));

    // Bảy cột giống phiếu mẫu: ngày, thứ tự, tên hàng/diễn giải, đơn vị, lượng, giá, tiền.
    private static void WriteMonth(IXLWorksheet sheet, BusinessParty party, int year, int month,
        long opening, IReadOnlyList<Entry> entries)
    {
        sheet.Style.Font.FontName = "Arial";
        sheet.Style.Font.FontSize = 10;
        sheet.Columns("A:G").Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        sheet.Column("A").Width = 15;
        sheet.Column("B").Width = 8;
        sheet.Column("C").Width = 49;
        sheet.Column("D").Width = 10;
        sheet.Column("E").Width = 13;
        sheet.Column("F").Width = 20;
        sheet.Column("G").Width = 22;
        sheet.Columns("E:G").Style.NumberFormat.Format = "#,##0;[Red](#,##0);\"–\"";
        sheet.Range("A1:G1").Merge().Value = $"CÔNG NỢ THÁNG {month} · {party.Name.ToUpperInvariant()} ({year})";
        sheet.Range("A1:G1").Style.Font.Bold = true;
        sheet.Range("A1:G1").Style.Font.FontSize = 15;
        sheet.Range("A1:G1").Style.Fill.BackgroundColor = XLColor.FromHtml("#DCEAF7");
        sheet.Row(1).Height = 31;
        sheet.Range("A2:G2").Merge().Value = $"Từ 01/{month:00}/{year} đến {DateTime.DaysInMonth(year, month):00}/{month:00}/{year}";
        sheet.Range("A3:G3").Merge().Value = $"Khách hàng: {party.Name}   ·   Điện thoại: {party.Phone}   ·   Địa chỉ: {party.Address}";
        sheet.Cell(5, 1).Value = "Ngày";
        sheet.Cell(5, 2).Value = "TT";
        sheet.Cell(5, 3).Value = "Tên hàng / diễn giải";
        sheet.Cell(5, 4).Value = "ĐVT";
        sheet.Cell(5, 5).Value = "Số lượng";
        sheet.Cell(5, 6).Value = "Đơn giá sau giảm";
        sheet.Cell(5, 7).Value = "Thành tiền (đ)";
        sheet.Range("A5:G5").Style.Fill.BackgroundColor = XLColor.FromHtml("#E8EFF6");
        sheet.Range("A5:G5").Style.Font.Bold = true;
        sheet.Range("A5:G5").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Row(5).Height = 25;
        sheet.Cell(6, 3).Value = "NỢ ĐẦU THÁNG";
        PutAmount(sheet, 6, opening);
        sheet.Range("A6:G6").Style.Font.Bold = true;

        var row = 7;
        var itemNumber = 0;
        foreach (var entry in entries)
        {
            if (entry.Kind == "sale" && entry.Sale is { } sale)
            {
                foreach (var item in sale.Items.OrderBy(i => i.Id))
                {
                    sheet.Cell(row, 1).Value = entry.At.ToString("dd/MM/yyyy");
                    sheet.Cell(row, 2).Value = ++itemNumber;
                    sheet.Cell(row, 3).Value = item.ProductName;
                    sheet.Cell(row, 4).Value = item.Unit;
                    sheet.Cell(row, 5).Value = item.Quantity;
                    sheet.Cell(row, 6).Value = item.UnitPrice - item.DiscountPerUnit;
                    PutAmount(sheet, row, item.LineTotal);
                    row++;
                }
                sheet.Cell(row, 3).Value = $"Hóa đơn {sale.Number} · tổng hàng" +
                    (entry.Note == "" ? "" : $" · {entry.Note}");
                PutAmount(sheet, row, sale.Total);
                sheet.Range(row, 1, row, 7).Style.Font.Bold = true;
                sheet.Range(row, 1, row, 7).Style.Fill.BackgroundColor = XLColor.FromHtml("#F2F6FA");
                // Tổng hoá đơn để đối chiếu, không cộng lại vào biến động tháng.
                row++;
                continue;
            }
            if (entry.Kind == "return" && entry.Return is { Items.Count: > 0 } returned)
            {
                var remainingCredit = -entry.Amount;
                foreach (var item in returned.Items.OrderBy(i => i.Id))
                {
                    var credited = Math.Min(item.RefundAmount, remainingCredit);
                    remainingCredit -= credited;
                    var cashRefund = item.RefundAmount - credited;
                    sheet.Cell(row, 1).Value = entry.At.ToString("dd/MM/yyyy");
                    sheet.Cell(row, 3).Value = $"Trả: {item.ProductName} · {entry.Reference} · {entry.Sale?.Number}" +
                        (cashRefund > 0 ? $" · hoàn tiền mặt {cashRefund:#,##0} đ" : "");
                    sheet.Cell(row, 4).Value = entry.Sale?.Items.FirstOrDefault(i => i.Id == item.SaleItemId)?.Unit ?? "cái";
                    sheet.Cell(row, 5).Value = -item.Quantity;
                    sheet.Cell(row, 6).Value = item.Quantity == 0 ? 0 : item.RefundAmount / item.Quantity;
                    PutAmount(sheet, row, -credited);
                    row++;
                }
                continue;
            }
            sheet.Cell(row, 1).Value = entry.At.ToString("dd/MM/yyyy");
            sheet.Cell(row, 3).Value = entry.Kind switch
            {
                "paid-at-sale" => $"Đã thanh toán khi mua · {entry.Reference}" +
                    (entry.Note == "" ? "" : $" · {entry.Note}"),
                "payment" => $"Thanh toán công nợ · {entry.Reference}" +
                    (entry.Note == "" ? "" : $" · {entry.Note}"),
                "opening" => $"Nợ đầu kỳ · {entry.Reference}" +
                    (entry.Note == "" ? "" : $" · {entry.Note}"),
                "return" => $"Trả hàng · {entry.Reference} · {entry.Note}" +
                    (entry.Return!.TotalRefund + entry.Amount > 0 ? " (phần còn lại hoàn tiền mặt)" : ""),
                _ => $"{entry.Note} · {entry.Reference}"
            };
            PutAmount(sheet, row, entry.Amount);
            if (entry.Kind == "return")
                sheet.Cell(row, 6).Value = entry.Return!.TotalRefund;
            row++;
        }
        if (entries.Count == 0) sheet.Cell(row++, 3).Value = "Không có phát sinh trong tháng.";
        row++;
        Summary(sheet, row++, "TỔNG TIỀN HÀNG", entries.Where(e => e.Kind == "sale").Sum(e => e.Amount));
        Summary(sheet, row++, "NỢ ĐẦU THÁNG", opening);
        Summary(sheet, row++, "NỢ NHẬP ĐẦU KỲ / ĐIỀU CHỈNH", entries.Where(e => e.Kind is "opening" or "adjustment").Sum(e => e.Amount));
        Summary(sheet, row++, "ĐÃ THANH TOÁN KHI MUA", -entries.Where(e => e.Kind == "paid-at-sale").Sum(e => e.Amount));
        Summary(sheet, row++, "ĐÃ THANH TOÁN CÔNG NỢ", -entries.Where(e => e.Kind == "payment").Sum(e => e.Amount));
        Summary(sheet, row++, "HÀNG TRẢ GIẢM NỢ", -entries.Where(e => e.Kind == "return").Sum(e => e.Amount));
        Summary(sheet, row, "CÒN NỢ CUỐI THÁNG", opening + entries.Sum(e => e.Amount));
        sheet.Range(row, 1, row, 7).Style.Fill.BackgroundColor = XLColor.FromHtml("#DCEAF7");
        sheet.Range(row, 1, row, 7).Style.Font.FontSize = 12;
        sheet.Range(5, 1, row, 7).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        sheet.Range(5, 1, row, 7).Style.Border.InsideBorder = XLBorderStyleValues.Hair;
        sheet.Column("C").Style.Alignment.WrapText = true;
        sheet.SheetView.FreezeRows(5);
        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        sheet.PageSetup.FitToPages(1, 0);
        sheet.PageSetup.PrintAreas.Add($"A1:G{row}");
    }

    private static void PutAmount(IXLWorksheet sheet, int row, long amount) => sheet.Cell(row, 7).Value = amount;

    private static void Summary(IXLWorksheet sheet, int row, string label, long amount)
    {
        sheet.Cell(row, 3).Value = label;
        PutAmount(sheet, row, amount);
        sheet.Range(row, 1, row, 7).Style.Font.Bold = true;
    }
}
