import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardList, Plus, Search, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { Party, Product, StockDocument, StockDocumentInput, StockDocumentKind } from '../types'
import { dateTime, money, searchKey } from '../utils/format'

type Props = {
  active: boolean
  products: Product[]
  onRefresh: () => Promise<void>
  showToast: (message: string, kind?: 'success' | 'error') => void
}
type Line = StockDocumentInput['items'][number]
const blankLine = (): Line => ({ productId: 0, quantity: 1, purchasePrice: 0, purchasePriceIncludesTax: false })
const today = () => {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}
const displayDate = (value: string) => value.split('-').reverse().join('/')

/** Phiếu nhập và kiểm kê là nguồn thay đổi tồn kho có ngày, lý do và từng dòng đối chiếu. */
export function StockPage({ active, products, onRefresh, showToast }: Props) {
  const [documents, setDocuments] = useState<StockDocument[]>([])
  const [kind, setKind] = useState<StockDocumentKind | null>(null)
  const [documentDate, setDocumentDate] = useState(today)
  const [supplier, setSupplier] = useState('')
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [paymentMode, setPaymentMode] = useState<'paid' | 'debt'>('paid')
  const [paidAmount, setPaidAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [selected, setSelected] = useState<StockDocument | null>(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setDocuments(await api.stockDocuments()) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không tải được phiếu kho.', 'error') }
  }, [showToast])
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [active, load])
  useEffect(() => { if (active) void api.parties('supplier').then(setSuppliers).catch(() => undefined) }, [active])

  const filtered = useMemo(() => documents.filter(doc => {
    if (filter && doc.kind !== filter) return false
    return searchKey([doc.number, doc.supplier, doc.reason,
      ...doc.lines.map(line => line.productCode + ' ' + line.productName)].join(' ')).includes(searchKey(search))
  }), [documents, filter, search])
  const pager = usePagination(filtered.length, 20, JSON.stringify([filter, search]))
  const receiptTotal = lines.reduce((sum, line) => sum + line.quantity * (line.purchasePrice ?? 0), 0)

  function open(kindToCreate: StockDocumentKind) {
    setKind(kindToCreate)
    setDocumentDate(today())
    setSupplier('')
    setSupplierId(null)
    setPaymentMode('paid')
    setPaidAmount(0)
    setDueDate('')
    setReason('')
    setLines([blankLine()])
  }
  function updateLine(index: number, patch: Partial<Line>) {
    setLines(current => current.map((line, position) => position === index ? { ...line, ...patch } : line))
  }
  function chooseProduct(index: number, id: number) {
    const product = products.find(item => item.id === id)
    updateLine(index, { productId: id, quantity: kind === 'count' ? product?.quantity ?? 0 : 1,
      purchasePrice: product?.purchasePrice ?? 0, purchasePriceIncludesTax: product?.purchasePriceIncludesTax ?? false })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!kind) return
    if (lines.some(line => !line.productId) || new Set(lines.map(line => line.productId)).size !== lines.length) {
      showToast('Chọn sản phẩm khác nhau cho từng dòng phiếu.', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await api.createStockDocument({ kind, documentDate, supplier, supplierId, reason,
        paidAmount: kind === 'receipt' ? (paymentMode === 'paid' ? receiptTotal : paidAmount) : null,
        dueDate: kind === 'receipt' && paymentMode === 'debt' ? dueDate : '',
        items: lines.map(line => ({ ...line, purchasePrice: kind === 'receipt' ? line.purchasePrice : null,
          purchasePriceIncludesTax: kind === 'receipt' ? line.purchasePriceIncludesTax : null })) })
      await Promise.all([load(), onRefresh()])
      setKind(null)
      setSelected(created)
      showToast('Đã lưu phiếu ' + created.number + '.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không lưu được phiếu kho.', 'error')
    } finally { setSaving(false) }
  }

  return <section className="page-content stock-page" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">THEO DÕI TỒN KHO</div><h1>Nhập kho & kiểm kê</h1><p>Mỗi thay đổi số lượng được ghi thành phiếu để dễ đối chiếu.</p></div>
      <div className="stock-heading-actions"><button className="secondary-button" onClick={() => open('count')}><ClipboardList size={17} />Kiểm kê</button><button className="primary-button" onClick={() => open('receipt')}><Plus size={17} />Nhập kho</button></div></div>
    <div className="panel stock-panel">
      <div className="stock-toolbar"><div className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã phiếu, sản phẩm, nhà cung cấp..." /></div>
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Loại phiếu"><option value="">Tất cả phiếu</option><option value="receipt">Nhập kho</option><option value="count">Kiểm kê</option></select></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>MÃ PHIẾU</th><th>LOẠI / NGÀY</th><th>NHÀ CUNG CẤP / LÝ DO</th><th>SẢN PHẨM</th><th></th></tr></thead><tbody>
        {filtered.slice(pager.start, pager.end).map(doc => <tr key={doc.id}><td><strong className="invoice-number">{doc.number}</strong></td><td>{doc.kind === 'receipt' ? 'Nhập kho' : 'Kiểm kê'}<small className="warranty-subline">{displayDate(doc.documentDate)}</small></td><td>{doc.supplier || doc.reason || '—'}</td><td>{doc.lines.length} sản phẩm</td><td><button className="view-button" onClick={() => setSelected(doc)}>Xem phiếu</button></td></tr>)}
        {!filtered.length && <tr><td colSpan={5}><div className="table-empty"><ClipboardList size={30} /><strong>Chưa có phiếu kho phù hợp</strong></div></td></tr>}
      </tbody></table></div>
      <Pagination total={filtered.length} pageSize={20} page={pager.page} totalPages={pager.totalPages} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="phiếu kho" />
    </div>

    {kind && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setKind(null) }}><div className="modal stock-modal">
      <div className="modal-header"><div><div className="eyebrow">PHIẾU KHO</div><h2>{kind === 'receipt' ? 'Nhập hàng vào kho' : 'Kiểm kê số lượng thực tế'}</h2></div><button className="icon-button" onClick={() => setKind(null)} aria-label="Đóng"><X size={21} /></button></div>
      <form onSubmit={event => void submit(event)} className="stock-form">
        <div className="stock-form-fields"><label>Ngày phiếu<input type="date" required value={documentDate} onChange={event => setDocumentDate(event.target.value)} /></label>
          {kind === 'receipt' && <><label>Nhà cung cấp đã lưu<select value={supplierId ?? ''} onChange={event => { const id = Number(event.target.value); const found = suppliers.find(s => s.id === id); setSupplierId(found?.id ?? null); if (found) setSupplier(found.name) }}><option value="">Nhập tên mới</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Tên nhà cung cấp<input maxLength={160} value={supplier} onChange={event => { setSupplier(event.target.value); setSupplierId(null) }} placeholder="Tên nhà cung cấp" /></label></>}
          <label className="span-2">Lý do {kind === 'count' ? <em>*</em> : '(nếu có)'}<textarea required={kind === 'count'} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder={kind === 'count' ? 'Ví dụ: Kiểm kê cuối tháng, điều chỉnh hàng thiếu...' : 'Ví dụ: Nhập theo đơn đặt hàng...'} /></label></div>
        <div className="stock-lines"><div className="stock-lines-heading"><strong>Sản phẩm trong phiếu</strong><button type="button" className="secondary-button" onClick={() => setLines(current => [...current, blankLine()])}><Plus size={15} />Thêm dòng</button></div>
          {lines.map((line, index) => <div className="stock-line" key={index}>
            <label className="stock-product">Sản phẩm<select required value={line.productId} onChange={event => chooseProduct(index, Number(event.target.value))}><option value={0}>Chọn sản phẩm</option>{products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name} · tồn {product.quantity}</option>)}</select></label>
            <label>{kind === 'receipt' ? 'Số lượng nhập' : 'Đếm thực tế'}<input type="number" required min={kind === 'receipt' ? 1 : 0} step="1" value={line.quantity} onChange={event => updateLine(index, { quantity: Number(event.target.value) })} /></label>
            {kind === 'receipt' && <><label>Giá nhập / món<input type="number" required min="0" step="1" value={line.purchasePrice ?? 0} onChange={event => updateLine(index, { purchasePrice: Number(event.target.value) })} /></label>
              <label>Thuế giá nhập<select value={line.purchasePriceIncludesTax ? 'yes' : 'no'} onChange={event => updateLine(index, { purchasePriceIncludesTax: event.target.value === 'yes' })}><option value="no">Chưa thuế</option><option value="yes">Có thuế</option></select></label></>}
            <button type="button" className="stock-remove" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, position) => position !== index))} aria-label="Xóa dòng"><Trash2 size={17} /></button>
          </div>)}</div>
        {kind === 'count' && <p className="stock-note">Nhập số lượng bạn đếm được. Hệ thống sẽ tự tính chênh lệch so với tồn kho hiện tại.</p>}
        {kind === 'receipt' && <div className="stock-payment"><strong>Giá trị phiếu: {money(receiptTotal)}</strong><label>Thanh toán<select value={paymentMode} onChange={event => setPaymentMode(event.target.value as typeof paymentMode)}><option value="paid">Đã trả đủ</option><option value="debt">Trả một phần / ghi nợ</option></select></label>{paymentMode === 'debt' && <><label>Đã trả (đ)<input type="number" min={0} max={receiptTotal} step={1} value={paidAmount} onChange={event => setPaidAmount(Number(event.target.value))} /></label><label>Hạn trả<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><small>Còn nợ: {money(Math.max(0, receiptTotal - paidAmount))}. Cần ghi nhà cung cấp.</small></>}</div>}
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setKind(null)}>Hủy</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phiếu'}</button></div>
      </form>
    </div></div>}

    {selected && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}><div className="modal stock-modal">
      <div className="modal-header"><div><div className="eyebrow">{selected.kind === 'receipt' ? 'PHIẾU NHẬP KHO' : 'PHIẾU KIỂM KÊ'}</div><h2>{selected.number}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Đóng"><X size={21} /></button></div>
      <div className="stock-detail-meta"><span>Ngày phiếu: <strong>{displayDate(selected.documentDate)}</strong></span><span>Lập lúc: <strong>{dateTime(selected.createdAt)}</strong></span>{selected.supplier && <span>Nhà cung cấp: <strong>{selected.supplier}</strong></span>}{selected.reason && <span>Lý do: <strong>{selected.reason}</strong></span>}</div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>SẢN PHẨM</th><th>TRƯỚC</th><th>THAY ĐỔI</th><th>SAU</th>{selected.kind === 'receipt' && <th>GIÁ NHẬP</th>}</tr></thead><tbody>{selected.lines.map(line => <tr key={line.id}><td>{line.productName}<small className="warranty-subline">{line.productCode}</small></td><td>{line.quantityBefore}</td><td className={line.quantityChange >= 0 ? 'positive-change' : 'negative-change'}>{line.quantityChange > 0 ? '+' : ''}{line.quantityChange}</td><td>{line.quantityAfter}</td>{selected.kind === 'receipt' && <td>{money(line.purchasePrice ?? 0)}<small className="warranty-subline">{line.purchasePriceIncludesTax ? 'Có thuế' : 'Chưa thuế'}</small></td>}</tr>)}</tbody></table></div>
      <div className="modal-footer"><button className="secondary-button" onClick={() => setSelected(null)}>Đóng</button></div>
    </div></div>}
  </section>
}

