import { useState } from 'react'
import { createPortal } from 'react-dom'
import Barcode from 'react-barcode'
import { Printer, X } from 'lucide-react'
import type { Product } from '../../types'
import { money } from '../../utils/format'

type Props = { product: Product; onClose: () => void }
type LabelSize = '35x22' | '50x30'

/** In tem bằng driver Windows qua hộp thoại in của trình duyệt. */
export function LabelPrintModal({ product, onClose }: Props) {
  const [quantity, setQuantity] = useState(1)
  const [size, setSize] = useState<LabelSize>('35x22')
  const compact = size === '35x22'
  const pageSize = compact ? '35mm 22mm' : '50mm 30mm'

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
            <p className="modal-description">Chọn cùng khổ tem trong phần mềm và driver máy in. Khi in, đặt lề 0 và tỷ lệ 100%.</p>
            <div className={'label-preview' + (compact ? ' compact' : '')}>
              <strong>{product.name}</strong><span>{money(product.salePrice)}</span>
              <Barcode value={product.code} format="CODE128" width={compact ? 1.05 : 1.25} height={compact ? 26 : 38} displayValue={false} margin={0} />
              <small>{product.code}</small>
            </div>
            <div className="label-settings">
              <label className="label-size">Khổ tem
                <select value={size} onChange={event => setSize(event.target.value as LabelSize)}>
                  <option value="35x22">35 × 22 mm</option>
                  <option value="50x30">50 × 30 mm</option>
                </select>
              </label>
              <label className="label-count">Số tem cần in
                <input type="number" min="1" max="200" value={quantity}
                  onChange={event => setQuantity(Math.min(200, Math.max(1, Math.floor(Number(event.target.value) || 1))))} />
              </label>
            </div>
            {compact && product.code.length > 12 && <p className="label-warning">Mã sản phẩm khá dài với tem 35 × 22 mm. Hãy in thử một tem và quét kiểm tra.</p>}
            <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Đóng</button>
              <button className="primary-button" onClick={() => window.print()}><Printer size={18} />In {quantity} tem</button></div>
          </div>
        </div>
        <div className="print-sheet" aria-hidden="true">
          {Array.from({ length: quantity }, (_, index) => <div className={'printed-label' + (compact ? ' compact' : '')} key={index}>
            <strong>{product.name}</strong><b>{money(product.salePrice)}</b>
            <Barcode value={product.code} format="CODE128" width={compact ? 1.05 : 1.2} height={compact ? 26 : 36} displayValue={false} margin={0} />
            <small>{product.code}</small>
          </div>)}
        </div>
      </>, document.body
    )}
  </>
}
