import { useState, type FormEvent } from 'react'
import { Barcode as BarcodeIcon, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { api } from '../api'
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [specs, setSpecs] = useState(() => Object.entries(initialValue.specifications).map(([key, value]) => ({ id: crypto.randomUUID(), key, value })))
  const [saving, setSaving] = useState(false)

  /** Kiểm tra thông số, tải ảnh mới (nếu có), rồi lưu thông tin sản phẩm. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const filled = specs.filter(row => row.key.trim() || row.value.trim())
      if (filled.some(row => !row.key.trim() || !row.value.trim()) ||
        new Set(filled.map(row => row.key.trim().toLocaleLowerCase('vi-VN'))).size !== filled.length)
        throw new Error('Mỗi thông số cần tên và giá trị; không được trùng tên.')
      const specifications = Object.fromEntries(filled.map(row => [row.key.trim(), row.value.trim()]))
      const imageUrl = imageFile ? (await api.uploadImage(imageFile)).imageUrl : form.imageUrl
      await onSave({ ...form, imageUrl, specifications })
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
            <label>Đơn vị tính <em>*</em><input required maxLength={20} value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="cái, bộ, mét..." /></label>
            <label>Giá nhập (₫)<input type="number" min="0" step="1" required value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: Number(event.target.value) })} /></label>
            <label>Thuế giá nhập<div className="select-wrap full"><select value={form.purchasePriceIncludesTax ? 'yes' : 'no'} onChange={event => setForm({ ...form, purchasePriceIncludesTax: event.target.value === 'yes' })}><option value="no">Chưa thuế</option><option value="yes">Có thuế</option></select><ChevronDown size={16} /></div></label>
            <label>Giá bán (₫) <em>*</em><input type="number" min="0" step="1" required value={form.salePrice} onChange={event => setForm({ ...form, salePrice: Number(event.target.value) })} /></label>
            <div className="stock-form-hint">Số lượng được cập nhật bằng phiếu nhập kho hoặc kiểm kê. Sản phẩm mới bắt đầu với tồn kho 0.</div>
            <label>Mức cảnh báo tồn thấp<input type="number" min="0" step="1" required value={form.lowStockThreshold} onChange={event => setForm({ ...form, lowStockThreshold: Number(event.target.value) })} /></label>
            <label className="span-2">Ảnh hiển thị trên website
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImageFile(event.target.files?.[0] ?? null)} />
              <small>{imageFile ? imageFile.name : form.imageUrl ? 'Đã có ảnh. Chọn tệp mới để thay.' : 'JPEG, PNG hoặc WebP; tối đa 3 MB.'}</small>
            </label>
            {(imageFile || form.imageUrl) && <button type="button" className="secondary-button product-image-remove" onClick={() => { setImageFile(null); setForm({ ...form, imageUrl: '' }) }}>Bỏ ảnh sản phẩm</button>}
            <div className="span-2 product-specs">
              <div className="product-specs-head"><strong>Thông số riêng của sản phẩm</strong><button type="button" className="secondary-button" onClick={() => setSpecs(current => [...current, { id: crypto.randomUUID(), key: '', value: '' }])}><Plus size={15} />Thêm thông số</button></div>
              <small>Ví dụ: Công suất — 12 W; Kích thước — 30 × 30 cm.</small>
              {specs.map(row => <div className="product-spec-row" key={row.id}>
                <input aria-label="Tên thông số" maxLength={80} placeholder="Tên thông số" value={row.key} onChange={event => setSpecs(current => current.map(item => item.id === row.id ? { ...item, key: event.target.value } : item))} />
                <input aria-label="Giá trị thông số" maxLength={300} placeholder="Giá trị" value={row.value} onChange={event => setSpecs(current => current.map(item => item.id === row.id ? { ...item, value: event.target.value } : item))} />
                <button type="button" aria-label="Bỏ thông số" onClick={() => setSpecs(current => current.filter(item => item.id !== row.id))}><Trash2 size={16} /></button>
              </div>)}
            </div>
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
