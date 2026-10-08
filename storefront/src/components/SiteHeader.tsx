import { ShoppingBag, Zap } from 'lucide-react'

type Props = { cartCount: number; onHome: () => void; onOpenCart: () => void }

/** Thanh đầu trang và lối vào giỏ hàng. */
export function SiteHeader({ cartCount, onHome, onOpenCart }: Props) {
  return <>
    <div className="announcement"><Zap size={14} fill="currentColor" /> Chọn hàng dễ dàng · Cửa hàng gọi xác nhận trước khi giao</div>
    <header className="site-header">
      <div className="site-container header-inner">
        <a className="logo" href="#top" onClick={onHome}>
          <span className="logo-mark"><Zap size={22} fill="currentColor" /></span>
          <span>ĐỒ ĐIỆN<br /><strong>VIỆT THU</strong></span>
        </a>
        <nav aria-label="Điều hướng">
          <a href="#products">Sản phẩm</a>
          <a href="#how-it-works">Cách đặt hàng</a>
        </nav>
        <button className="header-cart" onClick={onOpenCart}>
          <ShoppingBag size={19} /><span>Giỏ hàng</span><b>{cartCount}</b>
        </button>
      </div>
    </header>
  </>
}
