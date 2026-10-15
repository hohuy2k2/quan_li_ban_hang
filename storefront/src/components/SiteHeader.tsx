import { Moon, ShoppingBag, Sun, UserRound, Zap } from 'lucide-react'
import logo from '../assets/logo_1.png'
import type { AuthUser } from '../types'

type Props = { cartCount: number; user: AuthUser | null; theme: 'light' | 'dark'; onToggleTheme: () => void; onHome: () => void; onOpenCart: () => void; onOpenAccount: () => void }

/** Thanh đầu trang và lối vào giỏ hàng. */
export function SiteHeader({ cartCount, user, theme, onToggleTheme, onHome, onOpenCart, onOpenAccount }: Props) {
  return <>
    <div className="announcement"><Zap size={14} fill="currentColor" /> Chọn hàng dễ dàng · Cửa hàng gọi xác nhận trước khi giao</div>
    <header className="site-header">
      <div className="site-container header-inner">
        <a className="logo" href="#top" onClick={onHome}>
          <img className="logo-image" src={logo} alt="" width={50} height={50} />
          <span>ĐỒ ĐIỆN<br /><strong>VIỆT THU</strong></span>
        </a>
        <nav aria-label="Điều hướng">
          <a href="#products">Sản phẩm</a>
          <a href="#how-it-works">Cách đặt hàng</a>
        </nav>
        <div className="header-actions">
          <button className="site-theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
          <button className="account-trigger" onClick={onOpenAccount} aria-label={user ? 'Đơn hàng và tài khoản' : 'Đăng nhập hoặc đăng ký'}><UserRound size={19} /><span>{user ? 'Đơn của tôi' : 'Đăng nhập'}</span></button>
          <button className="header-cart" onClick={onOpenCart}>
            <ShoppingBag size={19} /><span>Giỏ hàng</span><b>{cartCount}</b>
          </button>
        </div>
      </div>
    </header>
  </>
}
