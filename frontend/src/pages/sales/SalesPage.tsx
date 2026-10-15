import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle, ArrowRight, Barcode as BarcodeIcon, Check, Minus, Package, Plus,
  ReceiptText, ScanLine, Search, ShoppingCart, X,
} from 'lucide-react'
import { api } from '../../api'
import { SalesPrintModal, type SalesPrintData, type VatStatus } from './SalesPrintModal'
import type { Party, Product, Summary } from '../../types'
import { dateTime, money, searchKey } from '../../utils/format'

type CartLine = { product: Product; quantity: number; discountPerUnit: number }
type Props = {
  active: boolean
  products: Product[]
  summary: Summary | null
  now: Date
  onRefresh: () => Promise<void>
  onShowInvoices: () => void
  onShowLowStock: () => void
  showToast: (message: string, kind?: 'success' | 'error') => void
}

/** Quét mã, lập giỏ hàng, tính giảm giá từng món và lưu đơn bán. */
export function SalesPage({ active, products, summary, now, onRefresh, onShowInvoices, onShowLowStock, showToast }: Props) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [scanCode, setScanCode] = useState('')
  const [manualSearch, setManualSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customers, setCustomers] = useState<Party[]>([])
  const [paymentMode, setPaymentMode] = useState<'paid' | 'debt'>('paid')
  const [paidAmount, setPaidAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastInvoice, setLastInvoice] = useState('')
  const [printOnCheckout, setPrintOnCheckout] = useState(false)
  const [vatStatus, setVatStatus] = useState<VatStatus>('')
  const [printJob, setPrintJob] = useState<{ data: SalesPrintData; autoPrint: boolean } | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const scanCodeRef = useRef('')
  const scanTimerRef = useRef<number | undefined>(undefined)
  const scanningRef = useRef(false)

  useEffect(() => { if (active) scanRef.current?.focus() }, [active])
  useEffect(() => { if (active) void api.parties('customer').then(setCustomers).catch(() => undefined) }, [active])
  useEffect(() => () => window.clearTimeout(scanTimerRef.current), [])

  const manualMatches = useMemo(() => {
    if (!manualSearch.trim()) return []
    const term = searchKey(manualSearch)
    return products.filter(p => searchKey(`${p.code} ${p.name} ${p.brand} ${p.category}`).includes(term)).slice(0, 8)
  }, [products, manualSearch])
  const cartSubtotal = cart.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0)
  const cartDiscount = cart.reduce((sum, line) => sum + line.discountPerUnit * line.quantity, 0)
  const cartTotal = cartSubtotal - cartDiscount
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  function addToCart(product: Product) {
    if (product.quantity <= 0) {
      showToast(`${product.name} đã hết hàng.`, 'error')
      return
    }
    const existing = cart.find(line => line.product.id === product.id)
    if (existing && existing.quantity >= product.quantity) {
      showToast(`Chỉ còn ${product.quantity} ${product.name} trong kho.`, 'error')
      return
    }
    setCart(current => {
      const found = current.find(line => line.product.id === product.id)
      return found
        ? current.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1, discountPerUnit: 0 }]
    })
    setManualSearch('')
    scanRef.current?.focus()
  }

  async function processScan(code: string) {
    if (!code || scanCodeRef.current.trim() !== code) return
    if (scanningRef.current) {
      scanTimerRef.current = window.setTimeout(() => void processScan(code), 100)
      return
    }
    scanningRef.current = true
    window.clearTimeout(scanTimerRef.current)
    scanCodeRef.current = ''
    setScanCode('')
    try {
      addToCart(await api.lookup(code))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tìm thấy sản phẩm.', 'error')
    } finally {
      scanningRef.current = false
      scanRef.current?.focus()
    }
  }

  function changeScanCode(value: string) {
    scanCodeRef.current = value
    setScanCode(value)
    window.clearTimeout(scanTimerRef.current)
    const code = value.trim()
    if (code) scanTimerRef.current = window.setTimeout(() => void processScan(code), 350)
  }

  function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void processScan(scanCodeRef.current.trim())
  }

  function changeQuantity(id: number, nextQuantity: number) {
    const line = cart.find(item => item.product.id === id)
    if (!line) return
    if (nextQuantity > line.product.quantity) {
      showToast(`Chỉ còn ${line.product.quantity} ${line.product.name} trong kho.`, 'error')
      return
    }
    setCart(current => nextQuantity <= 0
      ? current.filter(item => item.product.id !== id)
      : current.map(item => item.product.id === id ? { ...item, quantity: nextQuantity } : item))
    scanRef.current?.focus()
  }

  function changeDiscount(id: number, value: number) {
    setCart(current => current.map(line => line.product.id === id
      ? { ...line, discountPerUnit: Math.max(0, Math.min(line.product.salePrice, Math.floor(value) || 0)) }
      : line))
  }

  /** Lập mẫu in từ giỏ hàng hiện tại; xem hoặc in không lưu đơn và không trừ kho. */
  function previewQuote() {
    if (!cart.length) return
    setPrintJob({ autoPrint: false, data: {
      kind: 'quote', vatStatus, date: new Date().toISOString(), customerName, customerPhone, customerAddress,
      lines: cart.map(line => ({
        code: line.product.code, name: line.product.name, unit: line.product.unit,
        quantity: line.quantity, unitPrice: line.product.salePrice, discountPerUnit: line.discountPerUnit,
      })),
      total: cartTotal,
    } })
  }

  async function checkout() {
    if (!cart.length) return
    setCheckingOut(true)
    try {
      const sale = await api.createSale({
        customerName, customerPhone, customerId,
        paidAmount: paymentMode === 'paid' ? cartTotal : paidAmount,
        dueDate: paymentMode === 'debt' ? dueDate : '',
        items: cart.map(line => ({ productId: line.product.id, quantity: line.quantity, discountPerUnit: line.discountPerUnit })),
      })
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
      setCustomerId(null)
      setPaymentMode('paid')
      setPaidAmount(0)
      setDueDate('')
      setPrintOnCheckout(false)
      setVatStatus('')
      setLastInvoice(sale.number)
      showToast(`${paymentMode === 'debt' && paidAmount < cartTotal ? 'Đã lưu hoá đơn và công nợ' : 'Thanh toán thành công'} · ${sale.number}`)
      await onRefresh()
      if (printOnCheckout) setPrintJob({ autoPrint: true, data: {
        kind: 'receipt', vatStatus, number: sale.number, date: sale.soldAt,
        customerName: sale.customerName, customerPhone: sale.customerPhone, customerAddress,
        lines: sale.items.map(item => ({
          code: item.productCode, name: item.productName, unit: item.unit,
          quantity: item.quantity, unitPrice: item.unitPrice, discountPerUnit: item.discountPerUnit,
        })),
        total: sale.total, paidAmount: sale.paidAtSale ?? sale.total,
      } })
      scanRef.current?.focus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không lưu được đơn hàng.', 'error')
      await onRefresh()
    } finally { setCheckingOut(false) }
  }

  return (
    <section className="page-content sales-page" style={{ display: active ? undefined : 'none' }}>
      <div className="page-heading"><div><div className="eyebrow">QUẦY THANH TOÁN</div><h1>Bán hàng</h1><p>Quét mã để thêm sản phẩm vào đơn hàng đang mở.</p></div><div className="day-pill"><span />Hôm nay · {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)}</div></div>
      <div className="metrics-grid">
        <div className="metric-card"><span className="metric-icon blue"><ReceiptText size={19} /></span><span>Đơn hôm nay</span><strong>{summary?.salesToday ?? 0}</strong></div>
        <div className="metric-card"><span className="metric-icon green"><ShoppingCart size={19} /></span><span>Doanh thu hôm nay</span><strong>{money(summary?.revenueToday ?? 0)}</strong></div>
        <button type="button" className="metric-card metric-button" onClick={onShowLowStock}><span className="metric-icon amber"><AlertTriangle size={19} /></span><span>Sắp hết hàng · xem danh sách</span><strong>{summary?.lowStockCount ?? 0} <small>sản phẩm</small></strong></button>
      </div>
      <div className="sales-layout">
        <div className="sales-left">
          <div className="panel scan-panel">
            <div className="panel-heading"><div><span className="section-icon"><ScanLine size={19} /></span><h2>Quét mã sản phẩm</h2></div><span className="hint-tag">SẴN SÀNG QUÉT</span></div>
            <form className="scan-form" onSubmit={submitScan}><BarcodeIcon size={22} /><input ref={scanRef} value={scanCode} onChange={event => changeScanCode(event.target.value)} placeholder="Quét mã vạch để tự thêm sản phẩm..." autoComplete="off" aria-label="Mã vạch sản phẩm" /><kbd>TỰ ĐỘNG</kbd></form>
            <div className="helper-text">Quét xong, sản phẩm tự vào đơn sau một thoáng. Bạn vẫn có thể nhập mã rồi nhấn Enter.</div>
            <div className="manual-search-wrap"><label htmlFor="manual-search">Hoặc tìm sản phẩm để thêm thủ công</label><div className="search-field"><Search size={18} /><input id="manual-search" value={manualSearch} onChange={event => setManualSearch(event.target.value)} placeholder="Nhập tên, hãng, loại hoặc mã sản phẩm" /></div>
              {manualSearch.trim() && <div className="suggestions">{manualMatches.length ? manualMatches.map(p => <button key={p.id} onClick={() => addToCart(p)}><span className="suggestion-icon"><Package size={19} /></span><span className="suggestion-text"><strong>{p.name}</strong><small>{p.code} · {p.brand || 'Chưa có hãng'} · Còn {p.quantity}</small></span><b>{money(p.salePrice)}</b><Plus size={18} /></button>) : <div className="suggestion-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>}
            </div>
          </div>

          <div className="panel cart-panel">
            <div className="panel-heading"><div><span className="section-icon"><ShoppingCart size={19} /></span><h2>Sản phẩm trong đơn</h2><span className="count-badge">{cartCount}</span></div>{cart.length > 0 && <button className="text-danger" onClick={() => setCart([])}>Xoá đơn</button>}</div>
            {cart.length === 0 ? <div className="empty-cart"><div className="empty-graphic"><ShoppingCart size={33} /></div><strong>Đơn hàng đang trống</strong><span>Quét mã hoặc tìm sản phẩm để bắt đầu bán hàng</span></div> : <div className="cart-list">{cart.map(line => <div className="cart-line" key={line.product.id}><div className="cart-product-icon"><Package size={21} /></div><div className="cart-product"><strong>{line.product.name}</strong><span>{line.product.code} · {money(line.product.salePrice)} / sản phẩm</span></div><div className="quantity-control"><button onClick={() => changeQuantity(line.product.id, line.quantity - 1)} aria-label="Giảm số lượng"><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, line.quantity + 1)} aria-label="Tăng số lượng"><Plus size={14} /></button></div><label className="cart-discount">Giảm/món (đ)<input type="number" min="0" max={line.product.salePrice} step="1" inputMode="numeric" value={line.discountPerUnit} onChange={event => changeDiscount(line.product.id, Number(event.target.value))} aria-label={`Giảm giá mỗi món ${line.product.name}`} /></label><strong className="line-total">{money((line.product.salePrice - line.discountPerUnit) * line.quantity)}</strong><button className="remove-line" onClick={() => changeQuantity(line.product.id, 0)} aria-label="Xoá sản phẩm"><X size={17} /></button></div>)}</div>}
          </div>
        </div>

        <aside className="order-panel panel">
          <div className="order-panel-top"><span className="section-icon dark"><ReceiptText size={20} /></span><div><h2>Thông tin đơn hàng</h2><p>Chi tiết thanh toán</p></div></div>
          <div className="order-fields"><label>Khách hàng đã lưu <span>(nếu có)</span><select value={customerId ?? ''} onChange={event => { const id = Number(event.target.value); const found = customers.find(c => c.id === id); setCustomerId(found?.id ?? null); setCustomerName(found?.name ?? ''); setCustomerPhone(found?.phone ?? ''); setCustomerAddress(found?.address ?? '') }}><option value="">Khách mới / khách lẻ</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone || 'chưa có SĐT'}</option>)}</select></label><label>Họ tên khách hàng <span>(không bắt buộc)</span><input value={customerName} onChange={event => { setCustomerName(event.target.value); setCustomerId(null); setCustomerAddress('') }} placeholder="Nhập tên khách hàng" maxLength={120} /></label><label>Số điện thoại <span>(không bắt buộc)</span><input value={customerPhone} onChange={event => { setCustomerPhone(event.target.value); setCustomerId(null); setCustomerAddress('') }} placeholder="Nhập số điện thoại" maxLength={30} inputMode="tel" /></label><label>Địa chỉ trên bản in <span>(không bắt buộc)</span><input value={customerAddress} onChange={event => setCustomerAddress(event.target.value)} placeholder="Địa chỉ khách hàng" maxLength={200} /></label><label>Thời gian mua<input value={dateTime(now)} readOnly className="readonly-input" /></label><label>Thanh toán<select value={paymentMode} onChange={event => setPaymentMode(event.target.value as typeof paymentMode)}><option value="paid">Đã trả đủ</option><option value="debt">Trả một phần / ghi nợ</option></select></label>{paymentMode === 'debt' && <><label>Đã trả (đ)<input type="number" min={0} max={cartTotal} step={1} value={paidAmount} onChange={event => setPaidAmount(Number(event.target.value))} /></label><label>Hạn trả<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><small>Còn nợ: {money(Math.max(0, cartTotal - paidAmount))}. Cần ghi khách hàng.</small></>}</div>
          <div className="order-summary"><div><span>Số lượng sản phẩm</span><strong>{cartCount}</strong></div><div><span>Tạm tính</span><strong>{money(cartSubtotal)}</strong></div><div><span>Giảm giá</span><strong>−{money(cartDiscount)}</strong></div><div className="total-row"><span>Tổng thanh toán</span><strong>{money(cartTotal)}</strong></div></div>
          <label className="sales-vat-select">VAT trên bản in<select value={vatStatus} onChange={event => setVatStatus(event.target.value as VatStatus)}><option value="">Không ghi VAT</option><option value="included">Giá đã gồm VAT</option><option value="excluded">Giá chưa gồm VAT</option></select><small>Chỉ ghi trạng thái, không thay đổi tổng tiền.</small></label>
          <div className="sales-print-actions"><button type="button" onClick={previewQuote} disabled={!cart.length || checkingOut}><ReceiptText size={16} />In báo giá</button></div>
          <label className="sales-print-choice"><input type="checkbox" checked={printOnCheckout} onChange={event => setPrintOnCheckout(event.target.checked)} />In phiếu bán hàng sau khi thanh toán</label>
          <button className="checkout-button" onClick={() => void checkout()} disabled={!cart.length || checkingOut}><span>{checkingOut ? 'Đang lưu đơn...' : paymentMode === 'debt' ? 'Lưu hoá đơn & công nợ' : 'Thanh toán & lưu hoá đơn'}</span><ArrowRight size={19} /></button>
          <div className="order-footnote"><Check size={15} />Tồn kho được trừ sau khi thanh toán thành công.</div>
          {lastInvoice && <button className="last-invoice" onClick={onShowInvoices}><ReceiptText size={17} />Đơn vừa lưu: <strong>{lastInvoice}</strong><ArrowRight size={15} /></button>}
        </aside>
      </div>
      {printJob && <SalesPrintModal document={printJob.data} autoPrint={printJob.autoPrint} onClose={() => setPrintJob(null)} />}
    </section>
  )
}
