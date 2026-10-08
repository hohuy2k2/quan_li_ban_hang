import { ShoppingBag, X, Zap } from 'lucide-react'
import type { Product } from '../types'
import { money } from '../utils/format'

type Props = { product: Product; onClose: () => void; onAdd: (product: Product) => void; onBuyNow: (product: Product) => void }

/** Hiển thị ảnh và các thông số riêng của sản phẩm trong hộp thoại. */
export function ProductDetailModal({ product, onClose, onAdd, onBuyNow }: Props) {
  const specifications = Object.entries(product.specifications ?? {})
  return <div className="detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="detail-modal" role="dialog" aria-modal="true" aria-label={`Chi tiết ${product.name}`}>
      <button className="detail-close" onClick={onClose} aria-label="Đóng chi tiết"><X size={22} /></button>
      <div className="detail-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <Zap size={72} />}</div>
      <div className="detail-content">
        <span className="section-kicker">{product.category || 'THIẾT BỊ ĐIỆN'}</span>
        <h2>{product.name}</h2>
        <p className="detail-meta">Mã {product.code} · {product.brand || 'Cửa hàng đồ điện'}</p>
        <strong className="detail-price">{money(product.salePrice)}</strong>
        <p className="detail-stock">{product.available ? 'Còn hàng' : 'Tạm hết hàng'}</p>
        {specifications.length > 0 && <><h3>Thông tin sản phẩm</h3><dl className="detail-specs">{specifications.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></>}
        <div className="detail-actions"><button disabled={!product.available} onClick={() => onAdd(product)}><ShoppingBag size={17} /> Thêm vào giỏ</button><button disabled={!product.available} onClick={() => onBuyNow(product)}>Mua ngay</button></div>
      </div>
    </section>
  </div>
}
