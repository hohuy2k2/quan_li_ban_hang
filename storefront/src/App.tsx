import { useEffect, useState } from 'react'
import { CartDrawer } from './components/CartDrawer'
import { Benefits, ClosingCallout, Hero, SiteFooter } from './components/HomeSections'
import { ProductCatalog } from './components/ProductCatalog'
import { SiteHeader } from './components/SiteHeader'
import { Toast } from './components/Toast'
import { useCart } from './hooks/useCart'
import { useProducts } from './hooks/useProducts'
import type { Product } from './types'

/** Ghép các phần của website và giữ trạng thái dùng chung giữa danh mục/giỏ hàng. */
function App() {
  const { products, loading, error, reload } = useProducts()
  const cart = useCart(products)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [cartOpen, setCartOpen] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [message, setMessage] = useState('')

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
    setCartOpen(true)
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
    cart.clear()
    void reload()
  }

  return <div className="site-shell">
    <SiteHeader cartCount={cart.count} onHome={goHome} onOpenCart={openCart} />
    <main id="top">
      <Hero />
      <Benefits />
      <ProductCatalog
        products={products} loading={loading} error={error}
        query={query} category={category}
        onQueryChange={setQuery} onCategoryChange={setCategory}
        onReload={() => void reload()} onAdd={addToCart}
      />
      <ClosingCallout onOpenCart={openCart} />
    </main>
    <SiteFooter />
    <Toast message={message} onClose={() => setMessage('')} />
    {cartOpen && <CartDrawer
      lines={cart.lines} count={cart.count} total={cart.total}
      orderNumber={orderNumber} onClose={() => setCartOpen(false)}
      onQuantityChange={cart.setQuantity} onOrderPlaced={orderPlaced} onError={setMessage}
    />}
  </div>
}

export default App
