import { Check, Minus, Package, Plus, Trash2, X, Zap } from 'lucide-react'
import type { AuthUser, CartLine } from '../types'
import { money } from '../utils/format'
import { CheckoutForm } from './CheckoutForm'

type Props = {
  lines: CartLine[]
  count: number
  total: number
  orderNumber: string
  onClose: () => void
  onQuantityChange: (productId: number, quantity: number) => void
  onOrderPlaced: (number: string) => void
  onError: (message: string) => void
  user: AuthUser | null
  onOpenAccount: () => void
  quickBuy: boolean
}

/** Một dòng giỏ hàng với nút đổi số lượng và bỏ sản phẩm. */
function CartItem({ line, onQuantityChange }: {
  line: CartLine
  onQuantityChange: Props['onQuantityChange']
}) {
  const { product, quantity } = line
  return <div className="drawer-line">
    <div className="line-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Zap size={27} />}</div>
    <div className="line-main">
      <strong>{product.name}</strong><small>{product.code}</small><b>{money(product.salePrice)}</b>
      <div className="stepper">
        <button onClick={() => onQuantityChange(product.id, quantity - 1)} aria-label="Giảm số lượng"><Minus size={14} /></button>
        <span>{quantity}</span>
        <button onClick={() => onQuantityChange(product.id, quantity + 1)} aria-label="Tăng số lượng"><Plus size={14} /></button>
      </div>
    </div>
    <button className="remove-item" onClick={() => onQuantityChange(product.id, 0)} aria-label={`Bỏ ${product.name}`}><Trash2 size={17} /></button>
  </div>
}

/** Ngăn giỏ hàng gồm ba trạng thái: trống, điền đơn và đặt thành công. */
export function CartDrawer({ lines, count, total, orderNumber, onClose, onQuantityChange, onOrderPlaced, onError, user, onOpenAccount, quickBuy }: Props) {
  return <div className="drawer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="cart-drawer" aria-label="Giỏ hàng">
      <div className="drawer-head">
        <div><span>ĐƠN HÀNG CỦA BẠN</span><h2>{orderNumber ? 'Đặt hàng thành công' : quickBuy ? 'Mua ngay' : 'Giỏ hàng'} {count > 0 && <small>{count}</small>}</h2></div>
        <button className="plain-icon" onClick={onClose} aria-label="Đóng giỏ hàng"><X size={23} /></button>
      </div>
      {orderNumber ? <div className="order-success">
        <div className="success-icon"><Check size={38} /></div>
        <h3>Chúng tôi đã nhận đơn!</h3>
        <p>Mã đơn <strong>{orderNumber}</strong></p>
        <p>Cửa hàng sẽ liên hệ theo số điện thoại bạn đã nhập để xác nhận hàng và cách nhận.</p>
        <div className="order-success-actions"><button onClick={onOpenAccount}>Xem đơn hàng</button><button onClick={onClose}>Tiếp tục mua sắm</button></div>
      </div> : <div className="drawer-body">
        {lines.length === 0 ? <div className="drawer-empty">
          <Package size={48} /><h3>Giỏ hàng còn trống</h3>
          <p>Chọn sản phẩm bạn cần để bắt đầu đặt hàng.</p>
          <button onClick={onClose}>Xem sản phẩm</button>
        </div> : <>
          <div className="drawer-lines">{lines.map(line =>
            <CartItem key={line.product.id} line={line} onQuantityChange={onQuantityChange} />)}</div>
          <CheckoutForm lines={lines} total={total} user={user} onOpenAccount={onOpenAccount} onSuccess={onOrderPlaced} onError={onError} />
        </>}
      </div>}
    </aside>
  </div>
}
