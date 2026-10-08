import { useState, type FormEvent } from 'react'
import { Barcode as BarcodeIcon, ChevronDown, X } from 'lucide-react'
import type { Product, ProductInput } from '../types'

type Props = {
  editing: Product | null
  initialValue: ProductInput
  onClose: () => void
  onSave: (value: ProductInput) => Promise<void>
  onError: (message: string) => void
}

/**Biểu mẫu thêm/sửa sản phẩm, gồm giá nhập, thuế, giá bán và tồn kho. */
export function ProductFormModal({ editing, initialValue, onClose, onSave, onError }: Props) {
  const [form, setForm] = useState<ProductInput>(initialValue)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không lưu được sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal product-modal">
        <div className="modal-header">
          <div><div className="eyebrow">DANH MỤC SẢN PHẨM</div><h2>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button>
        </div>
        <form onSubmit={event => void submit(event)}>
          <div className="form-grid">
            <label className="span-2">Tên sản phẩm <em>*</em><input autoFocus required maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Ổ cắm 3 chấu" /></label>
            <label>Mã sản phẩm <em>*</em><div className="input-action"><input required maxLength={40} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="SP000001" /><BarcodeIcon size={18} /></div></label>
            <label>Hãng<input maxLength={80} value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} placeholder="Ví dụ: Điện Quang" /></label>
            <label>Loại sản phẩm<input maxLength={80} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Ví dụ: Ổ cắm" /></label>
            <label>Giá nhập (₫)<input type="number" min="0" step="1" required value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: Number(event.target.value) })} /></label>
            <label>Thuế giá nhập<div className="select-wrap full"><select value={form.purchasePriceIncludesTax ? 'yes' : 'no'} onChange={event => setForm({ ...form, purchasePriceIncludesTax: event.target.value === 'yes' })}><option value="no">Chưa thuế</option><option value="yes">Có thuế</option></select><ChevronDown size={16} /></div></label>
            <label>Giá bán (₫) <em>*</em><input type="number" min="0" step="1" required value={form.salePrice} onChange={event => setForm({ ...form, salePrice: Number(event.target.value) })} /></label>
            <label>Số lượng hiện có <em>*</em><input type="number" min="0" step="1" required value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></label>
            <label>Mức cảnh báo tồn thấp<input type="number" min="0" step="1" required value={form.lowStockThreshold} onChange={event => setForm({ ...form, lowStockThreshold: Number(event.target.value) })} /></label>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
