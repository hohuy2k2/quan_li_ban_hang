import { useMemo } from 'react'
import { ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type { Product } from '../types'
import { searchKey } from '../utils/format'
import { ProductCard } from './ProductCard'

type Props = {
  products: Product[]
  loading: boolean
  error: string
  query: string
  category: string
  onQueryChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onReload: () => void
  onAdd: (product: Product) => void
}

/** Chọn đúng nội dung cho ba trạng thái tải, lỗi và kết quả tìm kiếm. */
function CatalogResults({ loading, error, visible, onReload, onAdd }: {
  loading: boolean
  error: string
  visible: Product[]
  onReload: () => void
  onAdd: Props['onAdd']
}) {
  if (loading) return <div className="catalog-state">Đang tải sản phẩm...</div>
  if (error) return <div className="catalog-state error">{error}<button onClick={onReload}>Thử lại</button></div>
  if (!visible.length) return <div className="catalog-state">Chưa tìm thấy sản phẩm phù hợp.</div>

  return <div className="product-grid">{visible.map((product, index) =>
    <ProductCard key={product.id} product={product} tone={index % 4} onAdd={onAdd} />)}</div>
}

/** Lọc theo loại và từ khoá, rồi hiển thị danh mục sản phẩm. */
export function ProductCatalog({ products, loading, error, query, category, onQueryChange, onCategoryChange, onReload, onAdd }: Props) {
  const categories = useMemo(() => [
    'Tất cả', ...new Set(products.map(product => product.category.trim()).filter(Boolean)),
  ], [products])
  const visible = useMemo(() => {
    const term = searchKey(query.trim())
    return products.filter(product =>
      (category === 'Tất cả' || product.category === category) &&
      searchKey(`${product.name} ${product.code} ${product.brand} ${product.category}`).includes(term))
  }, [products, category, query])

  return <section className="catalog" id="products"><div className="site-container">
    <div className="section-heading">
      <div><span className="section-kicker">DANH MỤC SẢN PHẨM</span><h2>Chọn đúng món bạn cần</h2><p>Sản phẩm và giá được cập nhật từ hệ thống cửa hàng.</p></div>
      <div className="section-count">{visible.length} sản phẩm <ChevronRight size={16} /></div>
    </div>
    <div className="catalog-tools">
      <div className="catalog-search"><Search size={20} /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Tìm tên, mã, hãng sản phẩm..." aria-label="Tìm sản phẩm" /></div>
      <span className="filter-label"><SlidersHorizontal size={17} /> Lọc theo loại</span>
    </div>
    <div className="category-list" aria-label="Loại sản phẩm">
      {categories.map(item => <button key={item} className={category === item ? 'selected' : ''} onClick={() => onCategoryChange(item)}>{item}</button>)}
    </div>
    <CatalogResults loading={loading} error={error} visible={visible} onReload={onReload} onAdd={onAdd} />
  </div></section>
}
