import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Barcode as BarcodeIcon, Boxes, Check, Clock3, Download,
  FileClock, Menu, ReceiptText, RefreshCw, ShieldCheck, ShoppingCart, ClipboardList, Globe2, LogOut, ChartNoAxesCombined, Moon, Sun, UsersRound, X,
  HandCoins, ContactRound,
} from 'lucide-react'
import { api } from './api'
import { AdminLoginPage } from './components/AdminLoginPage'
import { useTheme } from './hooks/useTheme'
import { AccountsPage } from './pages/AccountsPage'
import { CustomersPage } from './pages/CustomersPage'
import { DebtsPage } from './pages/DebtsPage'
import { HistoryPage } from './pages/HistoryPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { OnlineOrdersPage } from './pages/OnlineOrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { RevenuePage } from './pages/RevenuePage'
import { SalesPage } from './pages/SalesPage'
import { StockPage } from './pages/StockPage'
import { WarrantyPage } from './pages/WarrantyPage'
import type { AuthUser, OnlineOrder, Product, ProductAudit, Sale, StockMovement, Summary } from './types'
import { dateTime } from './utils/format'
import './App.css'
import './account.css'
import './theme.css'
import './crm.css'

type Page = 'sales' | 'products' | 'stock' | 'invoices' | 'onlineOrders' | 'revenue' | 'warranty' | 'history' | 'accounts' | 'customers' | 'debts'
type Toast = { message: string; kind: 'success' | 'error' }

const pageTitles: Record<Page, string> = {
  sales: 'Bán hàng', products: 'Sản phẩm & tồn kho',
  stock: 'Phiếu kho', invoices: 'Hoá đơn', warranty: 'Bảo hành', history: 'Lịch sử thay đổi',
  onlineOrders: 'Đơn online',
  revenue: 'Doanh thu',
  accounts: 'Tài khoản',
  customers: 'Khách hàng', debts: 'Công nợ',
}

function App() {
  const { theme, toggleTheme } = useTheme()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('sales')
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([])
  const [audits, setAudits] = useState<ProductAudit[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [debtFocusPartyId, setDebtFocusPartyId] = useState<number | null>(null)

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    setToast({ message, kind })
  }, [])

  // Nạp dữ liệu dùng chung sau mỗi thao tác có thể thay đổi kho, hóa đơn hoặc thống kê.
  const refresh = useCallback(async () => {
    try {
      const [nextProducts, nextSales, nextAudits, nextMovements, nextSummary, nextOnlineOrders] = await Promise.all([
        api.products(), api.sales(), api.history(), api.movements(), api.summary(), api.onlineOrders(),
      ])
      setProducts([...nextProducts].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      setSales(nextSales)
      setOnlineOrders(nextOnlineOrders)
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

  useEffect(() => {
    void api.currentUser().then(setAuthUser).catch(error =>
      setAuthError(error instanceof Error ? error.message : 'Không kết nối được backend.'))
      .finally(() => setAuthChecking(false))
    const expired = () => setAuthUser(null)
    window.addEventListener('admin-auth-expired', expired)
    return () => window.removeEventListener('admin-auth-expired', expired)
  }, [])
  useEffect(() => { if (authUser?.role === 'admin') void refresh() }, [authUser, refresh])
  useEffect(() => {
    if (authUser?.role !== 'admin') return
    const events = new EventSource('/api/online-orders/stream')
    events.addEventListener('orders', () => { void refresh() })
    return () => events.close()
  }, [authUser, refresh])
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
      const response = await fetch('/api/backup/full')
      if (!response.ok) throw new Error('Không tạo được bản sao lưu.')
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `quan-ly-ban-hang-${new Date().toISOString().slice(0, 10)}.zip`
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

  /** Chỉ tài khoản role admin mới được vào phần quản lý. */
  async function login(email: string, password: string) {
    const user = await api.login(email, password)
    if (user.role !== 'admin') {
      await api.logout()
      throw new Error('Tài khoản này không có quyền quản lý.')
    }
    setAuthError('')
    setAuthUser(user)
  }

  async function logout() {
    try { await api.logout(); setAuthUser(null) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không đăng xuất được.', 'error') }
  }

  if (authChecking) return <div className="loading-state">Đang kiểm tra đăng nhập...</div>
  if (authUser?.role !== 'admin') return <AdminLoginPage onLogin={login} initialError={authError || (authUser ? 'Tài khoản khách không có quyền quản lý.' : '')} theme={theme} onToggleTheme={toggleTheme} />

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
            <button className={page === 'stock' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('stock')}><ClipboardList size={19} />Nhập kho / kiểm kê</button>
            <button className={page === 'invoices' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('invoices')}><ReceiptText size={19} />Hoá đơn</button>
            <button className={page === 'customers' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('customers')}><ContactRound size={19} />Khách hàng</button>
            <button className={page === 'debts' ? 'nav-item active' : 'nav-item'} onClick={() => { setDebtFocusPartyId(null); selectPage('debts') }}><HandCoins size={19} />Công nợ</button>
            <button className={page === 'onlineOrders' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('onlineOrders')}><Globe2 size={19} />Đơn online{onlineOrders.some(o => o.status === 'pending') && <span className="nav-count">{onlineOrders.filter(o => o.status === 'pending').length}</span>}</button>
            <button className={page === 'revenue' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('revenue')}><ChartNoAxesCombined size={19} />Doanh thu</button>
            <button className={page === 'warranty' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('warranty')}><ShieldCheck size={19} />Bảo hành</button>
            <button className={page === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('history')}><FileClock size={19} />Lịch sử thay đổi</button>
            <button className={page === 'accounts' ? 'nav-item active' : 'nav-item'} onClick={() => selectPage('accounts')}><UsersRound size={19} />Tài khoản</button>
          </nav>
          <div className="sidebar-bottom"><button className="backup-button" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</button><button className="backup-button" onClick={() => void downloadBackup()}><Download size={18} />Sao lưu dữ liệu và ảnh</button><button className="backup-button" onClick={() => void logout()}><LogOut size={18} />Đăng xuất</button><div className="local-note"><span className="online-dot" />Dữ liệu lưu trên máy này</div></div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(value => !value)} aria-label="Mở menu"><Menu size={21} /></button>
            <div className="breadcrumb">TỔNG QUAN <span>/</span> <strong>{pageTitles[page]}</strong></div>
            <div className="topbar-right"><span className="top-date"><Clock3 size={16} />{dateTime(now)}</span><button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><div className="avatar">{authUser.displayName.trim().slice(0, 2).toUpperCase()}</div></div>
          </header>

          {loadError && <div className="connection-error"><AlertTriangle size={18} /><span>{loadError}</span><button onClick={() => void refresh()}><RefreshCw size={15} />Thử lại</button></div>}
          {loading ? <div className="loading-state">Đang tải dữ liệu cửa hàng...</div> : <>
            <SalesPage active={page === 'sales'} products={products} summary={summary} now={now} onRefresh={refresh} onShowInvoices={() => selectPage('invoices')} onShowLowStock={() => { setOnlyLowStock(true); selectPage('products') }} showToast={showToast} />
            <ProductsPage active={page === 'products'} products={products} summary={summary} onlyLowStock={onlyLowStock} onToggleLowStock={() => setOnlyLowStock(value => !value)} onRefresh={refresh} showToast={showToast} />
            <StockPage active={page === 'stock'} products={products} onRefresh={refresh} showToast={showToast} />
            <InvoicesPage active={page === 'invoices'} sales={sales} products={products} onRefresh={refresh} showToast={showToast} />
            <CustomersPage active={page === 'customers'} onShowDebts={id => { setDebtFocusPartyId(id); selectPage('debts') }} showToast={showToast} />
            <DebtsPage active={page === 'debts'} focusPartyId={debtFocusPartyId} onClearFocus={() => setDebtFocusPartyId(null)} showToast={showToast} />
            <OnlineOrdersPage active={page === 'onlineOrders'} orders={onlineOrders} onRefresh={refresh} showToast={showToast} />
            <RevenuePage active={page === 'revenue'} showToast={showToast} />
            <WarrantyPage active={page === 'warranty'} products={products} onRefresh={refresh} showToast={showToast} />
            <HistoryPage active={page === 'history'} audits={audits} movements={movements} showToast={showToast} />
            <AccountsPage active={page === 'accounts'} user={authUser} onUserChange={setAuthUser} showToast={showToast} />
          </>}
        </main>
      </div>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}
    </>
  )
}

export default App
