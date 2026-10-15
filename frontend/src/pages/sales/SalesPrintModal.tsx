import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import qrImage from '../../assets/qr.png'
import { dateTime, money } from '../../utils/format'
import '../../styles/print-document.css'

export type VatStatus = '' | 'included' | 'excluded'

export type SalesPrintData = {
  kind: 'quote' | 'receipt'
  vatStatus: VatStatus
  number?: string
  date: string
  customerName: string
  customerPhone: string
  customerAddress: string
  lines: { code: string; name: string; unit: string; quantity: number; unitPrice: number; discountPerUnit: number }[]
  total: number
  paidAmount?: number
}

type ShopInfo = {
  name: string
  tagline: string
  address: string
  phone: string
  bankAccount: string
}
type PaperSize = 'A5' | 'A4'
type Props = { document: SalesPrintData; autoPrint?: boolean; onClose: () => void }
const shopStorageKey = 'sales-print-shop'
const paperStorageKey = 'sales-print-paper'
const defaultShop: ShopInfo = {
  name: 'ĐỒ ĐIỆN VIỆT THU',
  tagline: 'CHUYÊN KINH DOANH THIẾT BỊ ĐIỆN CÔNG NGHIỆP - DÂN DỤNG',
  address: '66 HÀNG ĐỒNG - P. Hạc Thành - tỉnh Thanh Hoá',
  phone: '090.229.1971 - 091.403.1971',
  bankAccount: '1234432434234243 - cong thy viet huy',
}

function savedShop(): ShopInfo {
  try {
    const value = JSON.parse(localStorage.getItem(shopStorageKey) || '{}') as Partial<ShopInfo> & { version?: number }
    if (value.version !== 2) return {
      ...defaultShop,
      name: value.name && value.name !== 'CỬA HÀNG ĐỒ ĐIỆN' ? value.name : defaultShop.name,
      address: value.address || defaultShop.address,
      phone: value.phone || defaultShop.phone,
    }
    return {
      name: typeof value.name === 'string' ? value.name : defaultShop.name,
      tagline: typeof value.tagline === 'string' ? value.tagline : defaultShop.tagline,
      address: typeof value.address === 'string' ? value.address : defaultShop.address,
      phone: typeof value.phone === 'string' ? value.phone : defaultShop.phone,
      bankAccount: typeof value.bankAccount === 'string' ? value.bankAccount : defaultShop.bankAccount,
    }
  } catch { return defaultShop }
}

function savedPaper(): PaperSize {
  try { return localStorage.getItem(paperStorageKey) === 'A4' ? 'A4' : 'A5' }
  catch { return 'A5' }
}

/** Đọc số tiền thành chữ để điền dòng tổng tiền trên mẫu giấy. */
function amountInWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) return ''
  if (amount === 0) return 'Không đồng'
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']
  const groups: number[] = []
  for (let value = amount; value > 0; value = Math.floor(value / 1000)) groups.push(value % 1000)
  const top = groups.length - 1

  function readGroup(value: number, full: boolean): string {
    const hundreds = Math.floor(value / 100)
    const tens = Math.floor(value % 100 / 10)
    const units = value % 10
    const words: string[] = []
    if (hundreds || full) words.push(digits[hundreds], 'trăm')
    if (tens > 1) words.push(digits[tens], 'mươi')
    else if (tens === 1) words.push('mười')
    else if (units && (hundreds || full)) words.push('lẻ')
    if (units) words.push(tens > 1 && units === 1 ? 'mốt' : tens > 0 && units === 5 ? 'lăm' : digits[units])
    return words.join(' ')
  }

  const result = groups.map((value, index) => value
    ? `${readGroup(value, index < top && value < 100)} ${scales[index] ?? ''}`.trim() : '')
    .reverse().filter(Boolean).join(' ')
  return result.charAt(0).toLocaleUpperCase('vi-VN') + result.slice(1) + ' đồng'
}

function Paper({ document, shop, paper }: { document: SalesPrintData; shop: ShopInfo; paper: PaperSize }) {
  const subtotal = document.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const discount = subtotal - document.total
  const remaining = document.paidAmount === undefined ? 0 : Math.max(0, document.total - document.paidAmount)
  return <article className="sales-paper" data-size={paper}>
    <header className="sales-paper-header">
      <div className="sales-paper-brand">
        <strong>{shop.name.trim() || defaultShop.name}</strong>
        {shop.tagline.trim() && <b>{shop.tagline.trim()}</b>}
        {shop.address.trim() && <span>ĐC: {shop.address.trim()}</span>}
        {shop.phone.trim() && <span>ĐT: {shop.phone.trim()}</span>}
        {shop.bankAccount.trim() && <span>STK: {shop.bankAccount.trim()}</span>}
      </div>
      <div className="sales-paper-qr"><img src={qrImage} alt="Mã QR thanh toán" /></div>
    </header>
    <h2>{document.kind === 'quote' ? 'GIẤY BÁO GIÁ' : 'PHIẾU BÁN HÀNG'}</h2>
    {document.vatStatus && <p className="sales-paper-vat">{document.vatStatus === 'included' ? 'Đơn giá và tổng tiền đã bao gồm VAT' : 'Đơn giá và tổng tiền chưa bao gồm VAT'}</p>}
    <div className="sales-paper-meta">
      <div><span>Khách hàng:</span><strong>{document.customerName.trim() || 'Khách lẻ'}</strong></div>
      {document.customerPhone.trim() && <div><span>Số điện thoại:</span><strong>{document.customerPhone.trim()}</strong></div>}
      {document.customerAddress.trim() && <div><span>Địa chỉ:</span><strong>{document.customerAddress.trim()}</strong></div>}
      <div><span>Ngày:</span><strong>{dateTime(document.date)}</strong></div>
      {document.number && <div><span>Số phiếu:</span><strong>{document.number}</strong></div>}
    </div>
    <table className="sales-paper-table">
      <thead><tr><th>TT</th><th>TÊN HÀNG</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th></tr></thead>
      <tbody>{document.lines.map((line, index) => <tr key={`${line.code}-${index}`}>
        <td>{index + 1}</td>
        <td><strong>{line.name}</strong><small>{line.code}{line.discountPerUnit > 0 ? ` · Giảm ${money(line.discountPerUnit)}/món` : ''}</small></td>
        <td>{line.quantity} {line.unit || 'cái'}</td>
        <td>{money(line.unitPrice - line.discountPerUnit)}</td>
        <td>{money((line.unitPrice - line.discountPerUnit) * line.quantity)}</td>
      </tr>)}</tbody>
      <tfoot>
        {discount > 0 && <><tr><td colSpan={4}>Tạm tính</td><td>{money(subtotal)}</td></tr><tr><td colSpan={4}>Giảm giá</td><td>−{money(discount)}</td></tr></>}
        <tr className="sales-paper-total"><td colSpan={4}>CỘNG</td><td>{money(document.total)}</td></tr>
        {document.kind === 'receipt' && remaining > 0 && <><tr><td colSpan={4}>Đã trả</td><td>{money(document.paidAmount ?? 0)}</td></tr><tr><td colSpan={4}>Còn nợ</td><td>{money(remaining)}</td></tr></>}
      </tfoot>
    </table>
    <p className="sales-paper-words"><strong>Thành tiền (bằng chữ):</strong> {amountInWords(document.total)}</p>
    <div className="sales-paper-signatures"><div><strong>Khách hàng</strong><span>(Ký, ghi rõ họ tên)</span></div><div><strong>Người bán hàng</strong><span>(Ký, ghi rõ họ tên)</span></div></div>
  </article>
}

/** Xem mẫu in và chuyển nội dung sang hộp thoại in A5/A4 của trình duyệt. */
export function SalesPrintModal({ document, autoPrint = false, onClose }: Props) {
  const [shop, setShop] = useState(savedShop)
  const [paper, setPaper] = useState<PaperSize>(savedPaper)
  const [vatStatus, setVatStatus] = useState<VatStatus>(document.vatStatus)
  const [shopError, setShopError] = useState('')
  const printableDocument = { ...document, vatStatus }

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  function updateShop(next: ShopInfo) {
    setShop(next)
    try {
      localStorage.setItem(shopStorageKey, JSON.stringify({ ...next, version: 2 }))
      setShopError('')
    } catch { setShopError('Không lưu được thông tin in trên trình duyệt này. Phiếu hiện tại vẫn in được.') }
  }

  function updatePaper(next: PaperSize) {
    setPaper(next)
    try { localStorage.setItem(paperStorageKey, next) } catch { /* Chỉ lưu lựa chọn khổ giấy để dùng lần sau. */ }
  }

  return <>
    {createPortal(<style media="print">{`@page { size: ${paper} portrait; margin: 0; }`}</style>, globalThis.document.head)}
    {createPortal(<>
      <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <div className="modal sales-print-modal">
          <div className="modal-header"><div><div className="eyebrow">XEM TRƯỚC BẢN IN</div><h2>{document.kind === 'quote' ? 'Giấy báo giá' : 'Phiếu bán hàng'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button></div>
          <div className="sales-print-settings">
            <label>Tên cửa hàng<input value={shop.name} maxLength={120} onChange={event => updateShop({ ...shop, name: event.target.value })} /></label>
            <label>Ngành hàng<input value={shop.tagline} maxLength={180} onChange={event => updateShop({ ...shop, tagline: event.target.value })} /></label>
            <label>Địa chỉ cửa hàng<input value={shop.address} maxLength={200} onChange={event => updateShop({ ...shop, address: event.target.value })} placeholder="Địa chỉ in trên phiếu" /></label>
            <label>Điện thoại cửa hàng<input value={shop.phone} maxLength={60} onChange={event => updateShop({ ...shop, phone: event.target.value })} placeholder="Số điện thoại in trên phiếu" /></label>
            <label>STK và tên chủ tài khoản<input value={shop.bankAccount} maxLength={120} onChange={event => updateShop({ ...shop, bankAccount: event.target.value })} /></label>
            <label>Khổ giấy<select value={paper} onChange={event => updatePaper(event.target.value as PaperSize)}><option value="A5">A5 (giống ảnh mẫu)</option><option value="A4">A4</option></select></label>
            <label>VAT trên bản in<select value={vatStatus} onChange={event => setVatStatus(event.target.value as VatStatus)}><option value="">Không ghi VAT</option><option value="included">Giá đã gồm VAT</option><option value="excluded">Giá chưa gồm VAT</option></select></label>
          </div>
          {shopError && <p className="sales-print-error" role="alert">{shopError}</p>}
          <p className="sales-print-hint">Chọn đúng khổ giấy trong hộp thoại máy in, tỷ lệ 100%. Mã QR lấy từ ảnh trong dự án; thông tin cửa hàng được nhớ trên trình duyệt này. Lựa chọn VAT chỉ thêm dòng chú thích, không tính lại tiền.</p>
          <div className="sales-paper-preview"><Paper document={printableDocument} shop={shop} paper={paper} /></div>
          <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Đóng</button><button className="primary-button" onClick={() => window.print()}><Printer size={17} />In / lưu PDF</button></div>
        </div>
      </div>
      <div className="sales-print-root" aria-hidden="true"><Paper document={printableDocument} shop={shop} paper={paper} /></div>
    </>, globalThis.document.body)}
  </>
}
