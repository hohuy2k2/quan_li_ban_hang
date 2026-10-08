import { X } from 'lucide-react'
import type { Sale } from '../types'
import { dateTime, money } from '../utils/format'

type Props = {
  sale: Sale
  onClose: () => void
  onEdit?: () => void
  onReturn?: () => void
  onDelete?: () => void
  onResolveWarranty?: (itemId: number, outcome: 'returned_to_customer' | 'discard') => void
}

const dispositionNames = { restock: 'Nhập lại kho · đã hoàn tiền', warranty: 'Đi bảo hành · chưa hoàn tiền', discard: 'Bỏ đi · chưa hoàn tiền' }

/** Xem hóa đơn và các thao tác sửa, trả hàng, xóa khi còn hợp lệ. */
export function InvoiceDetailModal({ sale, onClose, onEdit, onReturn, onDelete, onResolveWarranty }: Props) {
  const returns = sale.returns ?? []
  const returned = returns.flatMap(entry => entry.items)
  const canReturn = sale.items.some(item => item.quantity > returned.filter(entry => entry.saleItemId === item.id).reduce((sum, entry) => sum + entry.quantity, 0))
  const totalRefund = returns.reduce((sum, entry) => sum + entry.totalRefund, 0)
  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal invoice-modal">
        <div className="modal-header"><div><div className="eyebrow">CHI TIẾT HOÁ ĐƠN</div><h2>{sale.number}</h2>{sale.isDeleted && <span className="deleted-invoice-badge">Đã xoá</span>}</div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button></div>
        <div className="invoice-meta"><div><span>Khách hàng</span><strong>{sale.customerName || 'Khách lẻ'}</strong></div><div><span>Số điện thoại</span><strong>{sale.customerPhone || '—'}</strong></div><div><span>Thời gian</span><strong>{dateTime(sale.soldAt)}</strong></div></div>
        <div className="invoice-items">{sale.items.map(item => <div key={item.id}><div><strong>{item.productName}</strong><small>{item.productCode} · {money(item.unitPrice)} × {item.quantity}{item.discountPerUnit > 0 && ` · Giảm ${money(item.discountPerUnit)}/món`}</small></div><b>{money(item.lineTotal)}</b></div>)}</div>
        <div className="invoice-total"><span>Tổng bán ban đầu</span><strong>{money(sale.total)}</strong></div>
        {returns.length > 0 && <>
          <div className="invoice-total"><span>Đã hoàn tiền</span><strong className="refund-text">−{money(totalRefund)}</strong></div>
          <div className="invoice-returns"><h3>Lịch sử trả hàng</h3>{returns.map(entry => <div className="invoice-return" key={entry.id}>
            <div className="invoice-return-heading"><strong>{entry.number}</strong><time>{dateTime(entry.returnedAt)}</time></div>
            <p>{entry.reason}</p>
            {entry.items.map(item => <div className="invoice-return-item" key={item.id}><span>{item.productName} × {item.quantity}<small>{dispositionNames[item.disposition]}</small>{item.disposition === 'warranty' && <small>{item.warrantyResolution === 'returned_to_customer' ? 'Đã trả lại khách' : item.warrantyResolution === 'discard' ? 'Đã bỏ đi sau bảo hành' : 'Đang bảo hành'}</small>}</span><strong>{item.refundAmount > 0 ? `Hoàn ${money(item.refundAmount)}` : 'Không hoàn tiền'}</strong>{item.disposition === 'warranty' && !item.warrantyResolution && onResolveWarranty && <span className="warranty-actions"><button onClick={() => onResolveWarranty(item.id, 'returned_to_customer')}>Đã trả khách</button><button onClick={() => onResolveWarranty(item.id, 'discard')}>Bỏ đi</button></span>}</div>)}
          </div>)}</div>
        </>}
        <div className="modal-footer">{onDelete && !sale.isDeleted && returns.length === 0 && <button className="secondary-button danger-button" onClick={onDelete}>Xoá hoá đơn</button>}{onEdit && !sale.isDeleted && returns.length === 0 && <button className="secondary-button" onClick={onEdit}>Sửa hoá đơn</button>}{onReturn && !sale.isDeleted && canReturn && <button className="primary-button" onClick={onReturn}>Trả hàng</button>}{onDelete && returns.length > 0 && <span className="invoice-delete-note">Hoá đơn có hàng trả hoặc bảo hành không thể xoá.</span>}<button className="secondary-button" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  )
}
