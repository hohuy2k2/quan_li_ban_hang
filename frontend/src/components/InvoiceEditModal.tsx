import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import type { Product, Sale, SaleInput } from '../types'
import { money, searchKey } from '../utils/format'

type Props = {
  sale: Sale
  products: Product[]
  onClose: () => void
  onSave: (input: SaleInput) => Promise<void>
  onError: (message: string) => void
}

export function InvoiceEditModal({ sale, products, onClose, onSave, onError }: Props) {
  const [customerName, setCustomerName] = useState(sale.customerName)
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone)
  const [lines, setLines] = useState(sale.items.map(item => ({ productId: item.productId, quantity: item.quantity })))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const matches = useMemo(() => search.trim()
    ? products.filter(product => searchKey(`${product.code} ${product.name} ${product.brand}`).includes(searchKey(search))).slice(0, 8)
    : [], [products, search])
  const total = lines.reduce((sum, line) => {
    const original = sale.items.find(item => item.productId === line.productId)
    const product = products.find(item => item.id === line.productId)
    return sum + (original?.unitPrice ?? product?.salePrice ?? 0) * line.quantity
  }, 0)

  function addProduct(product: Product) {
    setLines(current => current.some(line => line.productId === product.id)
      ? current.map(line => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { productId: product.id, quantity: 1 }])
    setSearch('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lines.length || lines.some(line => line.quantity <= 0)) return onError('Hoá đơn cần có sản phẩm với số lượng hợp lệ.')
    setSaving(true)
    try {
      await onSave({ customerName, customerPhone, items: lines })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không sửa được hoá đơn.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal invoice-edit-modal">
        <div className="modal-header"><div><div className="eyebrow">SỬA HOÁ ĐƠN · {sale.number}</div><h2>Thông tin bán hàng</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button></div>
        <form onSubmit={event => void submit(event)}>
          <p className="modal-description">Sửa số lượng sẽ tự điều chỉnh chênh lệch tồn kho. Giá của món đã bán vẫn giữ theo hoá đơn gốc.</p>
          <div className="invoice-edit-customer"><label>Tên khách hàng<input maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label><label>Số điện thoại<input maxLength={30} value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} /></label></div>
          <div className="invoice-edit-lines">{lines.map(line => {
            const original = sale.items.find(item => item.productId === line.productId)
            const product = products.find(item => item.id === line.productId)
            const unitPrice = original?.unitPrice ?? product?.salePrice ?? 0
            return <div className="invoice-edit-line" key={line.productId}><div><strong>{original?.productName ?? product?.name}</strong><small>{original?.productCode ?? product?.code} · {money(unitPrice)}/món</small></div><input type="number" min="1" step="1" aria-label={`Số lượng ${original?.productName ?? product?.name}`} value={line.quantity} onChange={event => setLines(current => current.map(item => item.productId === line.productId ? { ...item, quantity: Number(event.target.value) } : item))} /><button type="button" className="icon-button" onClick={() => setLines(current => current.filter(item => item.productId !== line.productId))} aria-label="Bỏ món khỏi hoá đơn"><Trash2 size={17} /></button></div>
          })}</div>
          <div className="invoice-edit-search"><label>Thêm sản phẩm</label><div className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã" /></div>{search.trim() && <div className="invoice-edit-suggestions">{matches.length ? matches.map(product => <button type="button" key={product.id} onClick={() => addProduct(product)}><span>{product.name}<small>{product.code} · Còn {product.quantity}</small></span><Plus size={16} /></button>) : <div>Không tìm thấy sản phẩm.</div>}</div>}</div>
          <div className="return-refund">Tổng tiền mới <strong>{money(total)}</strong></div>
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button><button type="submit" className="primary-button" disabled={saving || !lines.length}>{saving ? 'Đang lưu...' : 'Lưu hoá đơn'}</button></div>
        </form>
      </div>
    </div>
  )
}
