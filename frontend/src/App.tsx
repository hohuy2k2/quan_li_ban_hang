import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Barcode from 'react-barcode'
import {
  AlertTriangle, ArrowRight, Barcode as BarcodeIcon, Boxes, Check, ChevronDown,
  Clock3, Download, FileClock, Menu, Minus, Package, Pencil, Plus, Printer,
  ReceiptText, RefreshCw, ScanLine, Search, ShoppingCart, Trash2, X,
} from 'lucide-react'
import { api } from './api'
import type { Product, ProductAudit, ProductInput, Sale, StockMovement, Summary } from './types'
import './App.css'

type Page = 'sales' | 'products' | 'invoices' | 'history'
type CartLine = { product: Product; quantity: number }
type HistoryTab = 'edits' | 'stock'

const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
const dateTime = (value: string | Date) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value))
const searchKey = (value: string) => value.toLocaleLowerCase('vi-VN')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim()

const blankProduct = (code = ''): ProductInput => ({
  code, name: '', brand: '', category: '', purchasePrice: 0,
  purchasePriceIncludesTax: false, salePrice: 0, quantity: 0, lowStockThreshold: 5,
})

const historyNames: Record<string, string> = {
  Code: 'Mã', Name: 'Tên', Brand: 'Hãng', Category: 'Loại',
  PurchasePrice: 'Giá nhập', PurchasePriceIncludesTax: 'Thuế', SalePrice: 'Giá bán',
  Quantity: 'Số lượng', LowStockThreshold: 'Mức cảnh báo',
}

function historyDetails(audit: ProductAudit): string[] {
  if (audit.action !== 'updated') return []
  try {
    const data = JSON.parse(audit.changesJson) as { before: Record<string, unknown>; after: Record<string, unknown> }
    return Object.keys(data.after).filter(key => data.before[key] !== data.after[key]).map(key => {
      const display = (value: unknown) => key === 'PurchasePriceIncludesTax'
        ? (value ? 'Có thuế' : 'Chưa thuế')
        : key.includes('Price') ? money(Number(value)) : String(value || '—')
      return `${historyNames[key] ?? key}: ${display(data.before[key])} → ${display(data.after[key])}`
    })
  } catch { return [] }
}

function App() {
  const [page, setPage] = useState<Page>('sales')
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [audits, setAudits] = useState<ProductAudit[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  const [now, setNow] = useState(new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductInput>(blankProduct())
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)
  const [labelQuantity, setLabelQuantity] = useState(1)

  const [cart, setCart] = useState<CartLine[]>([])
  const [scanCode, setScanCode] = useState('')
  const [manualSearch, setManualSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastInvoice, setLastInvoice] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [historyTab, setHistoryTab] = useState<HistoryTab>('edits')
  const scanRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [nextProducts, nextSales, nextAudits, nextMovements, nextSummary] = await Promise.all([
        api.products(), api.sales(), api.history(), api.movements(), api.summary(),
      ])
      setProducts([...nextProducts].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      setSales(nextSales)
      setAudits(nextAudits)
      setMovements(nextMovements)
      setSummary(nextSummary)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (page === 'sales' && !selectedSale && !showForm) scanRef.current?.focus()
  }, [page, selectedSale, showForm])

  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean))].sort(), [products])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products])
  const filteredProducts = useMemo(() => products.filter(p => {
    const text = searchKey(`${p.code} ${p.name} ${p.brand} ${p.category}`)
    return text.includes(searchKey(productSearch)) && (!brandFilter || p.brand === brandFilter)
      && (!categoryFilter || p.category === categoryFilter)
  }), [products, productSearch, brandFilter, categoryFilter])
  const manualMatches = useMemo(() => {
    if (!manualSearch.trim()) return []
    const term = searchKey(manualSearch)
    return products.filter(p => searchKey(`${p.code} ${p.name} ${p.brand} ${p.category}`).includes(term)).slice(0, 8)
  }, [products, manualSearch])
  const invoiceMatches = useMemo(() => {
    const term = searchKey(invoiceSearch)
    return sales.filter(s => searchKey(`${s.number} ${s.customerName} ${s.customerPhone}`).includes(term))
  }, [sales, invoiceSearch])
  const cartTotal = cart.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0)
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  async function openCreate() {
    setEditing(null)
    try {
      const next = await api.nextCode()
      setForm(blankProduct(next.code))
    } catch {
      setForm(blankProduct())
    }
    setShowForm(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setForm({
      code: product.code, name: product.name, brand: product.brand, category: product.category,
      purchasePrice: product.purchasePrice, purchasePriceIncludesTax: product.purchasePriceIncludesTax,
      salePrice: product.salePrice, quantity: product.quantity, lowStockThreshold: product.lowStockThreshold,
    })
    setShowForm(true)
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      if (editing) await api.updateProduct(editing.id, form)
      else await api.createProduct(form)
      setShowForm(false)
      showToast(editing ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.')
      await refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không lưu được sản phẩm.', 'error')
    } finally { setSaving(false) }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Xoá “${product.name}” khỏi danh mục? Lịch sử và hoá đơn cũ vẫn được giữ.`)) return
    try {
      await api.deleteProduct(product.id)
      showToast('Đã xoá sản phẩm khỏi danh mục.')
      await refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không xoá được sản phẩm.', 'error')
    }
  }

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
        : [...current, { product, quantity: 1 }]
    })
    setManualSearch('')
    scanRef.current?.focus()
  }

  async function submitScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = scanCode.trim()
    if (!code) return
    setScanCode('')
    try {
      const product = await api.lookup(code)
      addToCart(product)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tìm thấy sản phẩm.', 'error')
    } finally { scanRef.current?.focus() }
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

  async function checkout() {
    if (!cart.length) return
    setCheckingOut(true)
    try {
      const sale = await api.createSale({
        customerName, customerPhone,
        items: cart.map(line => ({ productId: line.product.id, quantity: line.quantity })),
      })
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setLastInvoice(sale.number)
      showToast(`Thanh toán thành công · ${sale.number}`)
      await refresh()
      scanRef.current?.focus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không lưu được đơn hàng.', 'error')
      await refresh()
    } finally { setCheckingOut(false) }
  }

  async function downloadBackup() {
    try {
      const response = await fetch('/api/backup')
      if (!response.ok) throw new Error('Không tạo được bản sao lưu.')
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `quan-ly-ban-hang-${new Date().toISOString().slice(0, 10)}.db`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      showToast('Đã tải bản sao lưu dữ liệu.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không sao lưu được dữ liệu.', 'error')
    }
  }

  function selectPage(next: Page) {
    setPage(next)
    setSidebarOpen(false)
  }

  const pageTitles: Record<Page, string> = {
    sales: 'Bán hàng', products: 'Sản phẩm & tồn kho', invoices: 'Hoá đơn', history: 'Lịch sử thay đổi',
  }

  return (
    <>
      <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="brand-lockup">
            <div className="brand-mark"><BarcodeIcon size={23} strokeWidth={2.2} /></div>
            <div><strong>QUẢN LÝ BÁN HÀNG</strong><span>Cửa hàng đồ điện</span></div>
          </div>
          <div className="sidebar-divider" />
          <div className="nav-caption">LÀM VIỆC</div>
          <nav className="nav-list" aria-label="Điều hướng chính">
            <button className={page === 'sales' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('sales')}><ShoppingCart size={19} />Bán hàng</button>
            <button className={page === 'products' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('products')}><Boxes size={19} />Sản phẩm & kho</button>
            <button className={page === 'invoices' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('invoices')}><ReceiptText size={19} />Hoá đơn</button>
            <button className={page === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('history')}><FileClock size={19} />Lịch sử thay đổi</button>
          </nav>
          <div className="sidebar-bottom">
            <button className="backup-button" onClick={() => void downloadBackup()}><Download size={18} />Sao lưu dữ liệu</button>
            <div className="local-note"><span className="online-dot" />Dữ liệu lưu trên máy này</div>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(value => !value)} aria-label="Mở menu"><Menu size={21} /></button>
            <div className="breadcrumb">TỔNG QUAN <span>/</span> <strong>{pageTitles[page]}</strong></div>
            <div className="topbar-right"><span className="top-date"><Clock3 size={16} />{dateTime(now)}</span><div className="avatar">CH</div></div>
          </header>

          {loadError && <div className="connection-error"><AlertTriangle size={18} /><span>{loadError}</span><button onClick={() => void refresh()}><RefreshCw size={15} />Thử lại</button></div>}
          {loading ? <div className="loading-state">Đang tải dữ liệu cửa hàng...</div> : <>
            {page === 'sales' && <section className="page-content sales-page">
              <div className="page-heading"><div><div className="eyebrow">QUẦY THANH TOÁN</div><h1>Bán hàng</h1><p>Quét mã để thêm sản phẩm vào đơn hàng đang mở.</p></div><div className="day-pill"><span />Hôm nay · {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)}</div></div>
              <div className="metrics-grid">
                <div className="metric-card"><span className="metric-icon blue"><ReceiptText size={19} /></span><span>Đơn hôm nay</span><strong>{summary?.salesToday ?? 0}</strong></div>
                <div className="metric-card"><span className="metric-icon green"><ShoppingCart size={19} /></span><span>Doanh thu hôm nay</span><strong>{money(summary?.revenueToday ?? 0)}</strong></div>
                <div className="metric-card"><span className="metric-icon amber"><AlertTriangle size={19} /></span><span>Sắp hết hàng</span><strong>{summary?.lowStockCount ?? 0} <small>sản phẩm</small></strong></div>
              </div>
              <div className="sales-layout">
                <div className="sales-left">
                  <div className="panel scan-panel">
                    <div className="panel-heading"><div><span className="section-icon"><ScanLine size={19} /></span><h2>Quét mã sản phẩm</h2></div><span className="hint-tag">SẴN SÀNG QUÉT</span></div>
                    <form className="scan-form" onSubmit={event => void submitScan(event)}><BarcodeIcon size={22} /><input ref={scanRef} value={scanCode} onChange={event => setScanCode(event.target.value)} placeholder="Quét mã vạch hoặc nhập mã rồi Enter..." autoComplete="off" aria-label="Mã vạch sản phẩm" /><kbd>ENTER</kbd></form>
                    <div className="helper-text">Máy quét USB nhập mã như bàn phím. Đặt con trỏ vào ô này để quét liên tục.</div>
                    <div className="manual-search-wrap"><label htmlFor="manual-search">Hoặc tìm sản phẩm để thêm thủ công</label><div className="search-field"><Search size={18} /><input id="manual-search" value={manualSearch} onChange={event => setManualSearch(event.target.value)} placeholder="Nhập tên, hãng, loại hoặc mã sản phẩm" /></div>
                      {manualSearch.trim() && <div className="suggestions">{manualMatches.length ? manualMatches.map(p => <button key={p.id} onClick={() => addToCart(p)}><span className="suggestion-icon"><Package size={19} /></span><span className="suggestion-text"><strong>{p.name}</strong><small>{p.code} · {p.brand || 'Chưa có hãng'} · Còn {p.quantity}</small></span><b>{money(p.salePrice)}</b><Plus size={18} /></button>) : <div className="suggestion-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>}
                    </div>
                  </div>

                  <div className="panel cart-panel">
                    <div className="panel-heading"><div><span className="section-icon"><ShoppingCart size={19} /></span><h2>Sản phẩm trong đơn</h2><span className="count-badge">{cartCount}</span></div>{cart.length > 0 && <button className="text-danger" onClick={() => setCart([])}>Xoá đơn</button>}</div>
                    {cart.length === 0 ? <div className="empty-cart"><div className="empty-graphic"><ShoppingCart size={33} /></div><strong>Đơn hàng đang trống</strong><span>Quét mã hoặc tìm sản phẩm để bắt đầu bán hàng</span></div> : <div className="cart-list">{cart.map(line => <div className="cart-line" key={line.product.id}><div className="cart-product-icon"><Package size={21} /></div><div className="cart-product"><strong>{line.product.name}</strong><span>{line.product.code} · {money(line.product.salePrice)} / sản phẩm</span></div><div className="quantity-control"><button onClick={() => changeQuantity(line.product.id, line.quantity - 1)} aria-label="Giảm số lượng"><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, line.quantity + 1)} aria-label="Tăng số lượng"><Plus size={14} /></button></div><strong className="line-total">{money(line.product.salePrice * line.quantity)}</strong><button className="remove-line" onClick={() => changeQuantity(line.product.id, 0)} aria-label="Xoá sản phẩm"><X size={17} /></button></div>)}</div>}
                  </div>
                </div>

                <aside className="order-panel panel">
                  <div className="order-panel-top"><span className="section-icon dark"><ReceiptText size={20} /></span><div><h2>Thông tin đơn hàng</h2><p>Chi tiết thanh toán</p></div></div>
                  <div className="order-fields"><label>Họ tên khách hàng <span>(không bắt buộc)</span><input value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Nhập tên khách hàng" maxLength={120} /></label><label>Số điện thoại <span>(không bắt buộc)</span><input value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="Nhập số điện thoại" maxLength={30} inputMode="tel" /></label><label>Thời gian mua<input value={dateTime(now)} readOnly className="readonly-input" /></label></div>
                  <div className="order-summary"><div><span>Số lượng sản phẩm</span><strong>{cartCount}</strong></div><div><span>Tạm tính</span><strong>{money(cartTotal)}</strong></div><div className="total-row"><span>Tổng thanh toán</span><strong>{money(cartTotal)}</strong></div></div>
                  <button className="checkout-button" onClick={() => void checkout()} disabled={!cart.length || checkingOut}><span>{checkingOut ? 'Đang lưu đơn...' : 'Thanh toán & lưu hoá đơn'}</span><ArrowRight size={19} /></button>
                  <div className="order-footnote"><Check size={15} />Tồn kho được trừ sau khi thanh toán thành công.</div>
                  {lastInvoice && <button className="last-invoice" onClick={() => selectPage('invoices')}><ReceiptText size={17} />Đơn vừa lưu: <strong>{lastInvoice}</strong><ArrowRight size={15} /></button>}
                </aside>
              </div>
            </section>}

            {page === 'products' && <section className="page-content">
              <div className="page-heading"><div><div className="eyebrow">DANH MỤC HÀNG HOÁ</div><h1>Sản phẩm & tồn kho</h1><p>Quản lý thông tin, giá và số lượng hiện có.</p></div><button className="primary-button" onClick={() => void openCreate()}><Plus size={18} />Thêm sản phẩm</button></div>
              <div className="inventory-stats"><div><span>Tổng sản phẩm</span><strong>{summary?.productCount ?? 0}</strong></div><div><span>Số lượng trong kho</span><strong>{summary?.stockUnits ?? 0}</strong></div><div><span>Sắp hết hàng</span><strong className="warning-text">{summary?.lowStockCount ?? 0}</strong></div></div>
              <div className="panel inventory-panel"><div className="inventory-toolbar"><div className="search-field"><Search size={18} /><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Tìm tên, mã, hãng, loại..." /></div><div className="select-wrap"><select value={brandFilter} onChange={event => setBrandFilter(event.target.value)} aria-label="Lọc theo hãng"><option value="">Tất cả hãng</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select><ChevronDown size={16} /></div><div className="select-wrap"><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Lọc theo loại"><option value="">Tất cả loại</option>{categories.map(category => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></div></div>
                <div className="table-scroll"><table className="data-table"><thead><tr><th>SẢN PHẨM</th><th>HÃNG / LOẠI</th><th>GIÁ NHẬP</th><th>GIÁ BÁN</th><th>TỒN KHO</th><th>THAO TÁC</th></tr></thead><tbody>{filteredProducts.length ? filteredProducts.map(p => <tr key={p.id}><td><div className="product-cell"><span className="product-square"><Package size={20} /></span><div><strong>{p.name}</strong><small>{p.code}</small></div></div></td><td><div className="stacked-cell">{p.brand || '—'}<small>{p.category || 'Chưa phân loại'}</small></div></td><td><div className="stacked-cell">{money(p.purchasePrice)}<small>{p.purchasePriceIncludesTax ? 'Có thuế' : 'Chưa thuế'}</small></div></td><td><strong>{money(p.salePrice)}</strong></td><td><span className={`stock-pill ${p.quantity <= p.lowStockThreshold ? 'low' : ''}`}>{p.quantity <= p.lowStockThreshold && <AlertTriangle size={13} />}{p.quantity}</span></td><td><div className="row-actions"><button title="In tem" aria-label={`In tem ${p.name}`} onClick={() => { setLabelProduct(p); setLabelQuantity(1) }}><Printer size={17} /></button><button title="Sửa sản phẩm" aria-label={`Sửa ${p.name}`} onClick={() => openEdit(p)}><Pencil size={17} /></button><button title="Xoá sản phẩm" aria-label={`Xoá ${p.name}`} className="delete-action" onClick={() => void deleteProduct(p)}><Trash2 size={17} /></button></div></td></tr>) : <tr><td colSpan={6}><div className="table-empty"><Package size={30} /><strong>Chưa có sản phẩm phù hợp</strong><span>Thêm sản phẩm mới hoặc thay đổi bộ lọc.</span></div></td></tr>}</tbody></table></div>
                <div className="table-footer">Hiển thị {filteredProducts.length} / {products.length} sản phẩm <span>Danh sách sắp xếp theo tên</span></div>
              </div>
            </section>}

            {page === 'invoices' && <section className="page-content"><div className="page-heading"><div><div className="eyebrow">LỊCH SỬ BÁN HÀNG</div><h1>Hoá đơn</h1><p>Tra cứu các đơn hàng đã thanh toán.</p></div><div className="header-count">{sales.length} đơn đã lưu</div></div><div className="panel inventory-panel"><div className="inventory-toolbar"><div className="search-field invoice-search"><Search size={18} /><input value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} placeholder="Tìm mã hoá đơn, tên hoặc số điện thoại..." /></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>MÃ HOÁ ĐƠN</th><th>THỜI GIAN</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM</th><th>TỔNG TIỀN</th><th></th></tr></thead><tbody>{invoiceMatches.length ? invoiceMatches.map(sale => <tr key={sale.id}><td><strong className="invoice-number">{sale.number}</strong></td><td>{dateTime(sale.soldAt)}</td><td><div className="stacked-cell">{sale.customerName || 'Khách lẻ'}<small>{sale.customerPhone || '—'}</small></div></td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</td><td><strong>{money(sale.total)}</strong></td><td><button className="view-button" onClick={() => setSelectedSale(sale)}>Xem chi tiết <ArrowRight size={15} /></button></td></tr>) : <tr><td colSpan={6}><div className="table-empty"><ReceiptText size={30} /><strong>Chưa có hoá đơn</strong><span>Hoá đơn sẽ xuất hiện sau khi hoàn tất bán hàng.</span></div></td></tr>}</tbody></table></div></div></section>}

            {page === 'history' && <section className="page-content"><div className="page-heading"><div><div className="eyebrow">NHẬT KÝ HỆ THỐNG</div><h1>Lịch sử thay đổi</h1><p>Theo dõi các lần thêm, sửa, xoá sản phẩm và biến động tồn kho.</p></div></div><div className="history-tabs"><button className={historyTab === 'edits' ? 'selected' : ''} onClick={() => setHistoryTab('edits')}>Chỉnh sửa sản phẩm</button><button className={historyTab === 'stock' ? 'selected' : ''} onClick={() => setHistoryTab('stock')}>Biến động tồn kho</button></div><div className="panel history-panel">{historyTab === 'edits' ? (audits.length ? audits.map(audit => <div className="history-row" key={audit.id}><span className={`history-icon ${audit.action}`}><FileClock size={18} /></span><div className="history-content"><strong>{audit.summary}</strong><span>{audit.productName} <code>{audit.productCode}</code></span>{historyDetails(audit).length > 0 && <ul>{historyDetails(audit).map(detail => <li key={detail}>{detail}</li>)}</ul>}</div><time>{dateTime(audit.at)}</time></div>) : <div className="table-empty"><FileClock size={30} /><strong>Chưa có thay đổi nào</strong></div>) : (movements.length ? movements.map(movement => <div className="history-row" key={movement.id}><span className={`history-icon ${movement.change >= 0 ? 'created' : 'deleted'}`}><Boxes size={18} /></span><div className="history-content"><strong>{movement.reason}</strong><span>{movement.productCode}{movement.reference ? ` · ${movement.reference}` : ''}</span></div><b className={movement.change >= 0 ? 'positive-change' : 'negative-change'}>{movement.change > 0 ? '+' : ''}{movement.change}</b><time>{dateTime(movement.at)}</time></div>) : <div className="table-empty"><Boxes size={30} /><strong>Chưa có biến động kho</strong></div>)}</div></section>}
          </>}
        </main>
      </div>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}

      {showForm && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false) }}><div className="modal product-modal"><div className="modal-header"><div><div className="eyebrow">DANH MỤC SẢN PHẨM</div><h2>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Đóng"><X size={21} /></button></div><form onSubmit={event => void saveProduct(event)}><div className="form-grid"><label className="span-2">Tên sản phẩm <em>*</em><input autoFocus required maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Ổ cắm 3 chấu" /></label><label>Mã sản phẩm <em>*</em><div className="input-action"><input required maxLength={40} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="SP000001" /><BarcodeIcon size={18} /></div></label><label>Hãng<input maxLength={80} value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} placeholder="Ví dụ: Điện Quang" /></label><label>Loại sản phẩm<input maxLength={80} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Ví dụ: Ổ cắm" /></label><label>Giá nhập (₫)<input type="number" min="0" step="1" required value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: Number(event.target.value) })} /></label><label>Thuế giá nhập<div className="select-wrap full"><select value={form.purchasePriceIncludesTax ? 'yes' : 'no'} onChange={event => setForm({ ...form, purchasePriceIncludesTax: event.target.value === 'yes' })}><option value="no">Chưa thuế</option><option value="yes">Có thuế</option></select><ChevronDown size={16} /></div></label><label>Giá bán (₫) <em>*</em><input type="number" min="0" step="1" required value={form.salePrice} onChange={event => setForm({ ...form, salePrice: Number(event.target.value) })} /></label><label>Số lượng hiện có <em>*</em><input type="number" min="0" step="1" required value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></label><label>Mức cảnh báo tồn thấp<input type="number" min="0" step="1" required value={form.lowStockThreshold} onChange={event => setForm({ ...form, lowStockThreshold: Number(event.target.value) })} /></label></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Huỷ</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button></div></form></div></div>}

      {labelProduct && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setLabelProduct(null) }}><div className="modal label-modal"><div className="modal-header"><div><div className="eyebrow">IN TEM SẢN PHẨM</div><h2>{labelProduct.name}</h2></div><button className="icon-button" onClick={() => setLabelProduct(null)} aria-label="Đóng"><X size={21} /></button></div><p className="modal-description">Mẫu tem 50 × 30 mm. Chọn đúng khổ tem trong cài đặt máy in trước khi in.</p><div className="label-preview"><strong>{labelProduct.name}</strong><span>{money(labelProduct.salePrice)}</span><Barcode value={labelProduct.code} format="CODE128" width={1.25} height={38} displayValue={false} margin={0} /><small>{labelProduct.code}</small></div><label className="label-count">Số tem cần in<input type="number" min="1" max="200" value={labelQuantity} onChange={event => setLabelQuantity(Math.max(1, Number(event.target.value) || 1))} /></label><div className="modal-footer"><button className="secondary-button" onClick={() => setLabelProduct(null)}>Đóng</button><button className="primary-button" onClick={() => window.print()}><Printer size={18} />In {labelQuantity} tem</button></div></div></div>}

      {selectedSale && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedSale(null) }}><div className="modal invoice-modal"><div className="modal-header"><div><div className="eyebrow">CHI TIẾT HOÁ ĐƠN</div><h2>{selectedSale.number}</h2></div><button className="icon-button" onClick={() => setSelectedSale(null)} aria-label="Đóng"><X size={21} /></button></div><div className="invoice-meta"><div><span>Khách hàng</span><strong>{selectedSale.customerName || 'Khách lẻ'}</strong></div><div><span>Số điện thoại</span><strong>{selectedSale.customerPhone || '—'}</strong></div><div><span>Thời gian</span><strong>{dateTime(selectedSale.soldAt)}</strong></div></div><div className="invoice-items">{selectedSale.items.map(item => <div key={item.id}><div><strong>{item.productName}</strong><small>{item.productCode} · {money(item.unitPrice)} × {item.quantity}</small></div><b>{money(item.lineTotal)}</b></div>)}</div><div className="invoice-total"><span>Tổng thanh toán</span><strong>{money(selectedSale.total)}</strong></div><div className="modal-footer"><button className="primary-button" onClick={() => setSelectedSale(null)}>Đóng</button></div></div></div>}

      {labelProduct && <div className="print-sheet" aria-hidden="true">{Array.from({ length: Math.min(labelQuantity, 200) }, (_, index) => <div className="printed-label" key={index}><strong>{labelProduct.name}</strong><b>{money(labelProduct.salePrice)}</b><Barcode value={labelProduct.code} format="CODE128" width={1.2} height={36} displayValue={false} margin={0} /><small>{labelProduct.code}</small></div>)}</div>}
    </>
  )
}

export default App
