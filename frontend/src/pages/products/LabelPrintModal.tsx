import { useState } from 'react'
import { createPortal } from 'react-dom'
import Barcode from 'react-barcode'
import { Printer, X } from 'lucide-react'
import type { Product } from '../../types'
import { money } from '../../utils/format'
import './label-print.css'

type Props = { product: Product; onClose: () => void }
type LabelSize = '35x22-double' | '35x22' | '50x30'

/** In tem bằng driver Windows qua hộp thoại in của trình duyệt. */
export function LabelPrintModal({ product, onClose }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [size, setSize] = useState<LabelSize>('35x22-double')
  const compact = size !== '50x30'
  const labelsPerRow = size === '35x22-double' ? 2 : 1
  const pageSize = size === '35x22-double' ? '70mm 22mm' : compact ? '35mm 22mm' : '50mm 30mm'

  return <>
    {createPortal(<style media="print">{'@page { size: ' + pageSize + '; margin: 0; }'}</style>, document.head)}
    {createPortal(
      <>
        <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
          <div className="modal label-modal">
            <div className="modal-header">
              <div><div className="eyebrow">IN TEM SẢN PHẨM</div><h2>{product.name}</h2></div>
              <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button>
            </div>
            <p className="modal-description">Khổ cuộn hai tem: chọn 70 × 22 mm trong driver PD304 và ở hộp thoại in. Đặt lề 0, tỷ lệ 100% và tắt đầu trang/chân trang.</p>
            <div className={'label-preview' + (compact ? ' compact' : '')}>
              <strong>{product.name}</strong><span>{money(product.salePrice)}</span>
              <Barcode value={product.code} format="CODE128" width={compact ? 1.05 : 1.25} height={compact ? 26 : 38} displayValue={false} margin={0} />
              <small>{product.code}</small>
            </div>
            <div className="label-settings">
              <label className="label-size">Khổ tem
                <select value={size} onChange={event => setSize(event.target.value as LabelSize)}>
                  <option value="35x22-double">2 tem 35 × 22 mm / hàng (giấy 70 × 22)</option>
                  <option value="35x22">1 tem 35 × 22 mm / hàng</option>
                  <option value="50x30">50 × 30 mm</option>
                </select>
              </label>
              <label className="label-count">Số tem cần in
                <input type="number" min="1" max="200" value={quantity}
                  onChange={event => setQuantity(Math.min(200, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
              </label>
            </div>
            {labelsPerRow === 2 && <p className="label-print-hint">Số tem là số tem riêng lẻ. Nếu chọn số lẻ, ô bên phải của hàng cuối sẽ để trống.</p>}
            {compact && product.code.length > 12 && <p className="label-warning">Mã sản phẩm khá dài với tem 35 × 22 mm. Hãy in thử một tem và quét kiểm tra.</p>}
            <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Đóng</button>
              <button className="primary-button" onClick={() => window.print()}><Printer size={18} />In {quantity} tem</button></div>
          </div>
        </div>
        <div className="print-sheet" data-label-layout={size} aria-hidden="true">
          {Array.from({ length: Math.ceil(quantity / labelsPerRow) }, (_, rowIndex) =>
            <div className="printed-label-row" key={rowIndex}>
              {Array.from({ length: Math.min(labelsPerRow, quantity - rowIndex * labelsPerRow) }, (_, columnIndex) =>
                <div className={'printed-label' + (compact ? ' compact' : '')} key={columnIndex}>
                  <strong>{product.name}</strong><b>{money(product.salePrice)}</b>
                  <Barcode value={product.code} format="CODE128" width={compact ? 1.05 : 1.2} height={compact ? 26 : 36} displayValue={false} margin={0} />
                  <small>{product.code}</small>
                </div>
              )}
            </div>
          )}
        </div>
      </>, document.body
    )}
  </>
}
