import { useState } from 'react'
import { createPortal } from 'react-dom'
import Barcode from 'react-barcode'
import { Printer, X } from 'lucide-react'
import type { Product } from '../types'
import { money } from '../utils/format'

type Props = { product: Product; onClose: () => void }

export function LabelPrintModal({ product, onClose }: Props) {
  const [quantity, setQuantity] = useState(1)

  return createPortal(
    <>
      <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <div className="modal label-modal">
          <div className="modal-header">
            <div><div className="eyebrow">IN TEM SẢN PHẨM</div><h2>{product.name}</h2></div>
            <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={21} /></button>
          </div>
          <p className="modal-description">Mẫu tem 50 × 30 mm. Chọn đúng khổ tem trong cài đặt máy in trước khi in.</p>
          <div className="label-preview"><strong>{product.name}</strong><span>{money(product.salePrice)}</span><Barcode value={product.code} format="CODE128" width={1.25} height={38} displayValue={false} margin={0} /><small>{product.code}</small></div>
          <label className="label-count">Số tem cần in<input type="number" min="1" max="200" value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
          <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Đóng</button><button className="primary-button" onClick={() => window.print()}><Printer size={18} />In {quantity} tem</button></div>
        </div>
      </div>
      <div className="print-sheet" aria-hidden="true">
        {Array.from({ length: Math.min(quantity, 200) }, (_, index) => <div className="printed-label" key={index}><strong>{product.name}</strong><b>{money(product.salePrice)}</b><Barcode value={product.code} format="CODE128" width={1.2} height={36} displayValue={false} margin={0} /><small>{product.code}</small></div>)}
      </div>
    </>, document.body
  )
}
