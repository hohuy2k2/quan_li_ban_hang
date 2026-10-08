import { Plus, Zap } from 'lucide-react'
import type { Product } from '../types'
import { money } from '../utils/format'

type Props = { product: Product; tone: number; onAdd: (product: Product) => void; onView: (product: Product) => void; onBuyNow: (product: Product) => void }

/** Ảnh và tên mở thông tin chi tiết; các nút mua có thao tác riêng. */
export function ProductCard({ product, tone, onAdd, onView, onBuyNow }: Props) {
  return <article className="product-card" onClick={() => onView(product)}>
    <button className={`product-visual product-visual-button tone-${tone}`} onClick={() => onView(product)} aria-label={`Xem chi tiết ${product.name}`}>
      <span className="product-code">{product.code}</span>
      {product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} loading="lazy" /> : <div className="product-symbol"><Zap size={45} strokeWidth={1.6} /></div>}
    </button>
    <div className="product-info">
      <span className="product-category">{product.category || 'Thiết bị điện'}</span>
      <h3><button className="product-title" onClick={() => onView(product)}>{product.name}</button></h3>
      <p>{product.brand || 'Cửa hàng đồ điện'} · Mã {product.code}</p>
      <div className="product-bottom">
        <strong>{money(product.salePrice)}</strong>
      </div>
      <div className="product-actions"><button disabled={!product.available} onClick={event => { event.stopPropagation(); onAdd(product) }} aria-label={`Thêm ${product.name} vào giỏ hàng`}><Plus size={16} /> Thêm</button><button className="buy-now" disabled={!product.available} onClick={event => { event.stopPropagation(); onBuyNow(product) }}>{product.available ? 'Mua ngay' : 'Hết hàng'}</button></div>
    </div>
  </article>
}
