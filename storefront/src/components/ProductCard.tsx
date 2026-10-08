import { Plus, Zap } from 'lucide-react'
import type { Product } from '../types'
import { money } from '../utils/format'

type Props = { product: Product; tone: number; onAdd: (product: Product) => void }

/** Thẻ sản phẩm; phần hình đang dùng minh hoạ vì dữ liệu chưa có ảnh. */
export function ProductCard({ product, tone, onAdd }: Props) {
  return <article className="product-card">
    <div className={`product-visual tone-${tone}`}>
      <span className="product-code">{product.code}</span>
      <div className="product-symbol"><Zap size={45} strokeWidth={1.6} /></div>
      <span className="visual-caption">ĐỒ ĐIỆN GIA DỤNG</span>
    </div>
    <div className="product-info">
      <span className="product-category">{product.category || 'Thiết bị điện'}</span>
      <h3>{product.name}</h3>
      <p>{product.brand || 'Cửa hàng đồ điện'} · Mã {product.code}</p>
      <div className="product-bottom">
        <strong>{money(product.salePrice)}</strong>
        <button disabled={!product.available} onClick={() => onAdd(product)} aria-label={`Thêm ${product.name} vào giỏ hàng`}>
          {product.available ? <><Plus size={18} /><span>Thêm</span></> : 'Hết hàng'}
        </button>
      </div>
    </div>
  </article>
}
