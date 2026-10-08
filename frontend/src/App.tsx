import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Barcode as BarcodeIcon, Boxes, Check, Clock3, Download,
  FileClock, Menu, ReceiptText, RefreshCw, ShieldCheck, ShoppingCart, X,
} from 'lucide-react'
import { api } from './api'
import { HistoryPage } from './pages/HistoryPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { ProductsPage } from './pages/ProductsPage'
import { SalesPage } from './pages/SalesPage'
import { WarrantyPage } from './pages/WarrantyPage'
import type { Product, ProductAudit, Sale, StockMovement, Summary } from './types'
import { dateTime } from './utils/format'
import './App.css'

type Page = 'sales' | 'products' | 'invoices' | 'warranty' | 'history'
type Toast = { message: string; kind: 'success' | 'error' }

const pageTitles: Record<Page, string> = {
  sales: 'Bán hàng', products: 'Sản phẩm & tồn kho',
  invoices: 'Hoá đơn', warranty: 'Bảo hành', history: 'Lịch sử thay đổi',
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
  const [toast, setToast] = useState<Toast | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [onlyLowStock, setOnlyLowStock] = useState(false)

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    setToast({ message, kind })
  }, [])

  // Nạp dữ liệu dùng chung sau mỗi thao tác có thể thay đổi kho, hóa đơn hoặc thống kê.
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

  return (
    <>
      <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="brand-lockup"><div className="brand-mark"><BarcodeIcon size={23} strokeWidth={2.2} /></div><div><strong>QUẢN LÝ BÁN HÀNG</strong><span>Cửa hàng đồ điện</span></div></div>
          <div className="sidebar-divider" />
          <div className="nav-caption">LÀM VIỆC</div>
          <nav className="nav-list" aria-label="Điều hướng chính">
            <button className={page === 'sales' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('sales')}><ShoppingCart size={19} />Bán hàng</button>
            <button className={page === 'products' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('products')}><Boxes size={19} />Sản phẩm & kho</button>
            <button className={page === 'invoices' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('invoices')}><ReceiptText size={19} />Hoá đơn</button>
            <button className={page === 'warranty' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('warranty')}><ShieldCheck size={19} />Bảo hành</button>
            <button className={page === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('history')}><FileClock size={19} />Lịch sử thay đổi</button>
          </nav>
          <div className="sidebar-bottom"><button className="backup-button" onClick={() => void downloadBackup()}><Download size={18} />Sao lưu dữ liệu</button><div className="local-note"><span className="online-dot" />Dữ liệu lưu trên máy này</div></div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(value => !value)} aria-label="Mở menu"><Menu size={21} /></button>
            <div className="breadcrumb">TỔNG QUAN <span>/</span> <strong>{pageTitles[page]}</strong></div>
            <div className="topbar-right"><span className="top-date"><Clock3 size={16} />{dateTime(now)}</span><div className="avatar">VN</div></div>
          </header>

          {loadError && <div className="connection-error"><AlertTriangle size={18} /><span>{loadError}</span><button onClick={() => void refresh()}><RefreshCw size={15} />Thử lại</button></div>}
          {loading ? <div className="loading-state">Đang tải dữ liệu cửa hàng...</div> : <>
            <SalesPage active={page === 'sales'} products={products} summary={summary} now={now} onRefresh={refresh} onShowInvoices={() => selectPage('invoices')} onShowLowStock={() => { setOnlyLowStock(true); selectPage('products') }} showToast={showToast} />
            <ProductsPage active={page === 'products'} products={products} summary={summary} onlyLowStock={onlyLowStock} onToggleLowStock={() => setOnlyLowStock(value => !value)} onRefresh={refresh} showToast={showToast} />
            <InvoicesPage active={page === 'invoices'} sales={sales} products={products} onRefresh={refresh} showToast={showToast} />
            <WarrantyPage active={page === 'warranty'} products={products} onRefresh={refresh} showToast={showToast} />
            <HistoryPage active={page === 'history'} audits={audits} movements={movements} showToast={showToast} />
          </>}
        </main>
      </div>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}
    </>
  )
}

export default App
