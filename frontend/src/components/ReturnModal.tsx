import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { ReturnDisposition, ReturnInput, Sale, SaleItem } from '../types'
import { money } from '../utils/format'

type Counts = Record<number, Record<ReturnDisposition, number>>
type Props = {
  sale: Sale
  onClose: () => void
  onSave: (input: ReturnInput) => Promise<void>
  onError: (message: string) => void
}

const dispositions: { key: ReturnDisposition; label: string; note: string }[] = [
  { key: 'restock', label: 'Nhập lại kho', note: 'Hoàn tiền' },
  { key: 'warranty', label: 'Đi bảo hành', note: 'Không hoàn tiền' },
  { key: 'discard', label: 'Bỏ đi', note: 'Không hoàn tiền' },
]

function remaining(sale: Sale, item: SaleItem) {
  const returned = (sale.returns ?? []).flatMap(entry => entry.items)
    .filter(entry => entry.saleItemId === item.id)
    .reduce((sum, entry) => sum + entry.quantity, 0)
  return item.quantity - returned
}

/** Chia số hàng trả thành nhập kho hoàn tiền, bảo hành hoặc bỏ đi. */
export function ReturnModal({ sale, onClose, onSave, onError }: Props) {
  const [reason, setReason] = useState('')
  const [counts, setCounts] = useState<Counts>({})
  const [saving, setSaving] = useState(false)

  const selected = sale.items.flatMap(item => dispositions.flatMap(({ key }) => {
    const quantity = counts[item.id]?.[key] ?? 0
    return quantity > 0 ? [{ saleItemId: item.id, quantity, disposition: key, refund: key === 'restock' }] : []
  }))
  const refund = selected.reduce((sum, line) =>
    sum + (line.refund ? ((sale.items.find(item => item.id === line.saleItemId)?.unitPrice ?? 0) - (sale.items.find(item => item.id === line.saleItemId)?.discountPerUnit ?? 0)) * line.quantity : 0), 0)

  function changeCount(itemId: number, disposition: ReturnDisposition, value: number) {
    setCounts(current => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? { restock: 0, warranty: 0, discard: 0 }), [disposition]: Math.max(0, Math.floor(value) || 0) },
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected.length) return onError('Hãy chọn số lượng hàng cần trả.')
    if (sale.items.some(item => dispositions.reduce((sum, entry) => sum + (counts[item.id]?.[entry.key] ?? 0), 0) > remaining(sale, item)))
      return onError('Số lượng trả vượt quá số còn được trả trong hoá đơn.')
    setSaving(true)
    try {
      await onSave({ reason, items: selected })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không ghi nhận được hàng trả.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal return-modal">
        <div className="modal-header"><div><div className="eyebrow">TRẢ HÀNG · {sale.number}</div><h2>Ghi nhận hàng khách trả</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button></div>
        <form onSubmit={event => void submit(event)}>
          <p className="modal-description">Chọn số lượng theo cách xử lý. Chỉ hàng nhập lại kho được hoàn tiền; hàng bảo hành và bỏ đi không tăng tồn kho.</p>
          <div className="return-lines">
            {sale.items.map(item => {
              const available = remaining(sale, item)
              return <div className="return-line" key={item.id}>
                <div className="return-line-heading"><strong>{item.productName}</strong><span>{item.productCode} · Còn được trả {available}/{item.quantity} · {money(item.unitPrice - (item.discountPerUnit ?? 0))}/món đã thanh toán</span></div>
                <div className="return-dispositions">{dispositions.map(({ key, label, note }) => <label key={key}>{label}<small>{note}</small><input type="number" min="0" max={available} disabled={available === 0} value={counts[item.id]?.[key] ?? 0} onChange={event => changeCount(item.id, key, Number(event.target.value))} /></label>)}</div>
              </div>
            })}
          </div>
          <label className="return-reason">Lý do trả hàng <em>*</em><textarea required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Khách không dùng / sản phẩm lỗi cần bảo hành" /></label>
          <div className="return-refund">Số tiền hoàn lại khách <strong>{money(refund)}</strong></div>
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button><button type="submit" className="primary-button" disabled={saving || !selected.length}>{saving ? 'Đang lưu...' : 'Xác nhận trả hàng'}</button></div>
        </form>
      </div>
    </div>
  )
}
