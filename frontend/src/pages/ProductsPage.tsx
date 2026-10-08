import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Package, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { api } from '../api'
import { LabelPrintModal } from '../components/LabelPrintModal'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import { ProductFormModal } from '../components/ProductFormModal'
import type { Product, ProductInput, Summary } from '../types'
import { money, searchKey } from '../utils/format'

type Props = {
  active: boolean
  products: Product[]
  summary: Summary | null
  onlyLowStock: boolean
  onToggleLowStock: () => void
  onRefresh: () => Promise<void>
  showToast: (message: string, kind?: 'success' | 'error') => void
}

const blankProduct = (code = ''): ProductInput => ({
  code, name: '', brand: '', category: '', purchasePrice: 0,
  purchasePriceIncludesTax: false, salePrice: 0, quantity: 0, lowStockThreshold: 5,
})

/** Danh mục sản phẩm: lọc, phân trang, sửa hàng và in tem. */
export function ProductsPage({ active, products, summary, onlyLowStock, onToggleLowStock, onRefresh, showToast }: Props) {
  const [productSearch, setProductSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [initialForm, setInitialForm] = useState<ProductInput>(blankProduct())
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)

  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean))].sort(), [products])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products])
  const filteredProducts = useMemo(() => products.filter(p => {
    const text = searchKey(`${p.code} ${p.name} ${p.brand} ${p.category}`)
    return text.includes(searchKey(productSearch)) && (!brandFilter || p.brand === brandFilter)
      && (!categoryFilter || p.category === categoryFilter)
      && (!onlyLowStock || p.quantity <= p.lowStockThreshold)
  }), [products, productSearch, brandFilter, categoryFilter, onlyLowStock])
  const pager = usePagination(filteredProducts.length, 20,
    JSON.stringify([productSearch, brandFilter, categoryFilter, onlyLowStock]))

  async function openCreate() {
    setEditing(null)
    try {
      const next = await api.nextCode()
      setInitialForm(blankProduct(next.code))
    } catch {
      setInitialForm(blankProduct())
    }
    setShowForm(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setInitialForm({
      code: product.code, name: product.name, brand: product.brand, category: product.category,
      purchasePrice: product.purchasePrice, purchasePriceIncludesTax: product.purchasePriceIncludesTax,
      salePrice: product.salePrice, quantity: product.quantity, lowStockThreshold: product.lowStockThreshold,
    })
    setShowForm(true)
  }

  async function saveProduct(form: ProductInput) {
    if (editing) await api.updateProduct(editing.id, form)
    else await api.createProduct(form)
    setShowForm(false)
    showToast(editing ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.')
    await onRefresh()
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Xoá “${product.name}” khỏi danh mục? Lịch sử và hoá đơn cũ vẫn được giữ.`)) return
    try {
      await api.deleteProduct(product.id)
      showToast('Đã xoá sản phẩm khỏi danh mục.')
      await onRefresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không xoá được sản phẩm.', 'error')
    }
  }

  return (
    <>
      <section className="page-content" style={{ display: active ? undefined : 'none' }}>
        <div className="page-heading"><div><div className="eyebrow">DANH MỤC HÀNG HOÁ</div><h1>Sản phẩm & tồn kho</h1><p>Quản lý thông tin, giá và số lượng hiện có.</p></div><button className="primary-button" onClick={() => void openCreate()}><Plus size={18} />Thêm sản phẩm</button></div>
        <div className="inventory-stats"><div><span>Tổng sản phẩm</span><strong>{summary?.productCount ?? 0}</strong></div><button type="button" className={onlyLowStock ? 'selected' : ''} onClick={onToggleLowStock} aria-pressed={onlyLowStock}><span>Sắp hết hàng · nhấn để lọc</span><strong className="warning-text">{summary?.lowStockCount ?? 0}</strong></button></div>
        <div className="panel inventory-panel"><div className="inventory-toolbar"><div className="search-field"><Search size={18} /><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Tìm tên, mã, hãng, loại..." /></div><div className="select-wrap"><select value={brandFilter} onChange={event => setBrandFilter(event.target.value)} aria-label="Lọc theo hãng"><option value="">Tất cả hãng</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select><ChevronDown size={16} /></div><div className="select-wrap"><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Lọc theo loại"><option value="">Tất cả loại</option>{categories.map(category => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>SẢN PHẨM</th><th>HÃNG / LOẠI</th><th>GIÁ NHẬP</th><th>GIÁ BÁN</th><th>TỒN KHO</th><th>THAO TÁC</th></tr></thead><tbody>{filteredProducts.length ? filteredProducts.slice(pager.start, pager.end).map(p => <tr key={p.id}><td><div className="product-cell"><span className="product-square"><Package size={20} /></span><div><strong>{p.name}</strong><small>{p.code}</small></div></div></td><td><div className="stacked-cell">{p.brand || '—'}<small>{p.category || 'Chưa phân loại'}</small></div></td><td><div className="stacked-cell">{money(p.purchasePrice)}<small>{p.purchasePriceIncludesTax ? 'Có thuế' : 'Chưa thuế'}</small></div></td><td><strong>{money(p.salePrice)}</strong></td><td><span className={`stock-pill ${p.quantity <= p.lowStockThreshold ? 'low' : ''}`}>{p.quantity <= p.lowStockThreshold && <AlertTriangle size={13} />}{p.quantity}</span></td><td><div className="row-actions"><button title="In tem" aria-label={`In tem ${p.name}`} onClick={() => setLabelProduct(p)}><Printer size={17} /></button><button title="Sửa sản phẩm" aria-label={`Sửa ${p.name}`} onClick={() => openEdit(p)}><Pencil size={17} /></button><button title="Xoá sản phẩm" aria-label={`Xoá ${p.name}`} className="delete-action" onClick={() => void deleteProduct(p)}><Trash2 size={17} /></button></div></td></tr>) : <tr><td colSpan={6}><div className="table-empty"><Package size={30} /><strong>Chưa có sản phẩm phù hợp</strong><span>Thêm sản phẩm mới hoặc thay đổi bộ lọc.</span></div></td></tr>}</tbody></table></div>
          <Pagination total={filteredProducts.length} pageSize={20} page={pager.page} totalPages={pager.totalPages} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="sản phẩm" />
        </div>
      </section>
      {showForm && <ProductFormModal editing={editing} initialValue={initialForm} onClose={() => setShowForm(false)} onSave={saveProduct} onError={message => showToast(message, 'error')} />}
      {labelProduct && <LabelPrintModal key={labelProduct.id} product={labelProduct} onClose={() => setLabelProduct(null)} />}
    </>
  )
}
