import { useEffect, useState } from 'react'
import { CartDrawer } from './components/CartDrawer'
import { AccountModal } from './components/AccountModal'
import { ProductDetailModal } from './components/ProductDetailModal'
import { Benefits, ClosingCallout, Hero, SiteFooter } from './components/HomeSections'
import { ProductCatalog } from './components/ProductCatalog'
import { SiteHeader } from './components/SiteHeader'
import { Toast } from './components/Toast'
import { useCart } from './hooks/useCart'
import { useTheme } from './hooks/useTheme'
import { useProducts } from './hooks/useProducts'
import { currentUser, logout } from './api'
import type { AuthUser, CartLine, Product } from './types'

/** Ghép các phần của website và giữ trạng thái dùng chung giữa danh mục/giỏ hàng. */
function App() {
  const { theme, toggleTheme } = useTheme()
  const { products, loading, error, reload } = useProducts()
  const cart = useCart(products)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [cartOpen, setCartOpen] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quickBuy, setQuickBuy] = useState<CartLine | null>(null)
  const [quickMode, setQuickMode] = useState(false)

  useEffect(() => { void currentUser().then(setUser).catch(() => setUser(null)) }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(timer)
  }, [message])

  /** Trở về đầu trang và xoá bộ lọc đang dùng. */
  function goHome() {
    setQuery('')
    setCategory('Tất cả')
  }

  /** Mỗi lần mở giỏ mới, bỏ trạng thái hoàn tất của đơn trước. */
  function openCart() {
    setOrderNumber('')
    setQuickMode(false)
    setQuickBuy(null)
    setCartOpen(true)
  }

  /** Mở thanh toán một món mà vẫn giữ nguyên giỏ hàng thường. */
  function buyNow(product: Product) {
    if (!product.available) return
    setSelectedProduct(null)
    setOrderNumber('')
    setQuickBuy({ product, quantity: 1 })
    setQuickMode(true)
    setCartOpen(true)
  }

  function changeQuantity(productId: number, quantity: number) {
    if (!quickMode) { cart.setQuantity(productId, quantity); return }
    setQuickBuy(previous => previous?.product.id === productId && quantity > 0
      ? { ...previous, quantity: Math.min(quantity, 99) } : null)
  }

  /** Thêm sản phẩm và báo ngắn cho khách biết thao tác đã thành công. */
  function addToCart(product: Product) {
    cart.add(product.id)
    setMessage(`Đã thêm ${product.name} vào giỏ hàng`)
  }

  /** Sau khi backend nhận đơn, làm trống giỏ và cập nhật lại danh mục. */
  function orderPlaced(number: string) {
    setOrderNumber(number)
    setMessage('')
    if (quickMode) setQuickBuy(null)
    else cart.clear()
    void reload()
  }

  async function signOut() {
    await logout()
    setUser(null)
    setAccountOpen(false)
  }

  const activeLines = quickMode ? (quickBuy ? [quickBuy] : []) : cart.lines
  const activeCount = quickMode ? (quickBuy?.quantity ?? 0) : cart.count
  const activeTotal = quickMode ? (quickBuy ? quickBuy.product.salePrice * quickBuy.quantity : 0) : cart.total

  return <div className="site-shell">
    <SiteHeader cartCount={cart.count} user={user} theme={theme} onToggleTheme={toggleTheme} onHome={goHome} onOpenCart={openCart} onOpenAccount={() => setAccountOpen(true)} />
    <main id="top">
      <Hero />
      <Benefits />
      <ProductCatalog
        products={products} loading={loading} error={error}
        query={query} category={category}
        onQueryChange={setQuery} onCategoryChange={setCategory}
        onReload={() => void reload()} onAdd={addToCart} onView={setSelectedProduct} onBuyNow={buyNow}
      />
      <ClosingCallout onOpenCart={openCart} />
    </main>
    <SiteFooter />
    <Toast message={message} onClose={() => setMessage('')} />
    {selectedProduct && <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} onBuyNow={buyNow} />}
    {cartOpen && <CartDrawer
      lines={activeLines} count={activeCount} total={activeTotal} quickBuy={quickMode}
      orderNumber={orderNumber} onClose={() => setCartOpen(false)}
      onQuantityChange={changeQuantity} onOrderPlaced={orderPlaced} onError={setMessage}
      user={user} onOpenAccount={() => setAccountOpen(true)}
    />}
    {accountOpen && <AccountModal user={user} onAuth={setUser} onLogout={signOut} onClose={() => setAccountOpen(false)} />}
  </div>
}

export default App
