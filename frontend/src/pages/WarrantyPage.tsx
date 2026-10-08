import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ClipboardList, Package, Plus, Search, X } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import { api } from '../api'
import type { Product, WarrantyCase, WarrantyStatus } from '../types'
import { dateTime, searchKey } from '../utils/format'

type Props = {
  active: boolean
  products: Product[]
  onRefresh: () => Promise<void>
  showToast: (message: string, kind?: 'success' | 'error') => void
}

const statusNames: Record<WarrantyStatus, string> = {
  received: 'Đã tiếp nhận',
  sent: 'Đã gửi bảo hành',
  ready: 'Đã bảo hành xong',
  returned_to_customer: 'Đã trả khách',
  restocked: 'Đã nhập lại kho',
  discarded: 'Đã bỏ đi',
}
const closed: Set<WarrantyStatus> = new Set(['returned_to_customer', 'restocked', 'discarded'])

type UnitDraft = { serialNumber: string; warrantyExpiresOn: string }

function WarrantyUnitsEditor({ units, max, onChange }: {
  units: UnitDraft[]
  max: number
  onChange: (units: UnitDraft[]) => void
}) {
  return <div className="warranty-units">
    <div className="warranty-units-heading"><strong>Serial / IMEI từng món</strong><button type="button" className="secondary-button" disabled={units.length >= max} onClick={() => onChange([...units, { serialNumber: '', warrantyExpiresOn: '' }])}><Plus size={14} />Thêm serial</button></div>
    {units.map((unit, index) => <div className="warranty-unit-row" key={index}>
      <label>Serial / IMEI {index + 1}<input required maxLength={100} value={unit.serialNumber} onChange={event => onChange(units.map((item, position) => position === index ? { ...item, serialNumber: event.target.value } : item))} /></label>
      <label>Hạn bảo hành<input type="date" value={unit.warrantyExpiresOn} onChange={event => onChange(units.map((item, position) => position === index ? { ...item, warrantyExpiresOn: event.target.value } : item))} /></label>
      <button type="button" className="stock-remove" onClick={() => onChange(units.filter((_, position) => position !== index))} aria-label="Xóa serial"><X size={16} /></button>
    </div>)}
    <small>Có thể bổ sung serial sau khi tạo phiếu. Mỗi món có hạn bảo hành riêng.</small>
  </div>
}


/** Tiếp nhận và theo dõi phiếu bảo hành từ khách hoặc hàng lỗi trong kho. */
export function WarrantyPage({ active, products, onRefresh, showToast }: Props) {
  const [cases, setCases] = useState<WarrantyCase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [creatingSource, setCreatingSource] = useState<'customer' | 'internal' | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [productId, setProductId] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [issue, setIssue] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [saleNumber, setSaleNumber] = useState('')
  const [units, setUnits] = useState<UnitDraft[]>([])
  const [expectedReturnOn, setExpectedReturnOn] = useState('')
  const [note, setNote] = useState('')
  const [partner, setPartner] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setCases(await api.warranties()) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không tải được phiếu bảo hành.', 'error') }
    finally { setLoading(false) }
  }, [showToast])
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [active, load])

  const selected = cases.find(item => item.id === selectedId)
  const todayDate = new Date()
  const todayKey = [todayDate.getFullYear(), String(todayDate.getMonth() + 1).padStart(2, '0'),
    String(todayDate.getDate()).padStart(2, '0')].join('-')
  const filtered = useMemo(() => cases.filter(item => {
    if (sourceFilter && item.source !== sourceFilter) return false
    if (statusFilter === 'open' && closed.has(item.status)) return false
    if (statusFilter === 'closed' && !closed.has(item.status)) return false
    if (statusFilter === 'overdue' && (closed.has(item.status) || !item.expectedReturnOn || item.expectedReturnOn >= todayKey)) return false
    const term = searchKey(search)
    return !term || searchKey([item.number, item.saleNumber, item.productCode, item.productName,
      item.customerName, item.customerPhone, item.issue, item.partner, ...(item.units ?? []).map(unit => unit.serialNumber)].join(' ')).includes(term)
  }), [cases, search, sourceFilter, statusFilter, todayKey])
  const pager = usePagination(filtered.length, 20, JSON.stringify([search, sourceFilter, statusFilter]))
  const productMatches = products.filter(product =>
    searchKey(`${product.code} ${product.name}`).includes(searchKey(productSearch)))

  function openCreate(source: 'customer' | 'internal') {
    setProductId(0); setProductSearch(''); setQuantity(1); setIssue('')
    setCustomerName(''); setCustomerPhone(''); setSaleNumber('')
    setUnits([]); setExpectedReturnOn(''); setPartner('')
    setCreatingSource(source)
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!productId || quantity < 1 || !issue.trim()) {
      showToast('Chọn sản phẩm, số lượng và mô tả lỗi.', 'error')
      return
    }
    if (creatingSource === 'customer' && !customerName.trim() && !customerPhone.trim()) {
      showToast('Nhập tên hoặc số điện thoại khách hàng.', 'error')
      return
    }
    if (units.length > quantity) {
      showToast('Số serial vượt quá số món trong phiếu.', 'error')
      return
    }
    setSaving(true)
    try {
      const created = creatingSource === 'customer'
        ? await api.createCustomerWarranty({ productId, quantity, issue: issue.trim(), customerName, customerPhone, saleNumber, units, expectedReturnOn, partner })
        : await api.createInternalWarranty({ productId, quantity, issue: issue.trim(), units, expectedReturnOn, partner })
      await Promise.all([load(), onRefresh()])
      setCreatingSource(null)
      setProductId(0); setProductSearch(''); setQuantity(1); setIssue('')
      setCustomerName(''); setCustomerPhone(''); setSaleNumber('')
      setUnits([]); setExpectedReturnOn(''); setPartner('')
      setSelectedId(created.id)
      showToast(`Đã tạo phiếu ${created.number}.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không tạo được phiếu bảo hành.', 'error')
    } finally { setSaving(false) }
  }

  async function updateStatus(status: WarrantyStatus) {
    if (!selected) return
    if (closed.has(status) && !window.confirm(`Xác nhận: ${statusNames[status].toLowerCase()}?`)) return
    setSaving(true)
    try {
      await api.updateWarranty(selected.id, { status, note: note.trim(), partner: partner.trim() })
      await Promise.all([load(), onRefresh()])
      setNote('')
      showToast('Đã cập nhật phiếu bảo hành.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không cập nhật được bảo hành.', 'error')
    } finally { setSaving(false) }
  }

  function openCase(item: WarrantyCase) {
    setSelectedId(item.id)
    setNote('')
    setPartner(item.partner)
    setUnits((item.units ?? []).map(unit => ({ serialNumber: unit.serialNumber, warrantyExpiresOn: unit.warrantyExpiresOn })))
    setExpectedReturnOn(item.expectedReturnOn || '')
  }

  async function saveDetails() {
    if (!selected) return
    setSaving(true)
    try {
      await api.updateWarrantyDetails(selected.id, { units, expectedReturnOn, partner })
      await load()
      showToast('Đã lưu thông tin theo dõi bảo hành.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không lưu được thông tin bảo hành.', 'error')
    } finally { setSaving(false) }
  }

  return <section className="page-content warranty-page" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">THEO DÕI XỬ LÝ</div><h1>Bảo hành sản phẩm</h1><p>Quản lý hàng khách gửi bảo hành và hàng lỗi của cửa hàng.</p></div><div className="warranty-heading-actions"><button className="secondary-button" onClick={() => openCreate('customer')}><Plus size={17} />Nhận từ khách</button><button className="primary-button" onClick={() => openCreate('internal')}><Plus size={17} />Hàng lỗi trong kho</button></div></div>
    <div className="warranty-summary"><div><span>Đang xử lý</span><strong>{cases.filter(item => !closed.has(item.status)).length}</strong></div><div><span>Từ khách hàng</span><strong>{cases.filter(item => item.source === 'customer').length}</strong></div><div><span>Hàng lỗi trong kho</span><strong>{cases.filter(item => item.source === 'internal').length}</strong></div></div>
    <div className="panel warranty-panel">
      <div className="warranty-toolbar"><div className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã phiếu, hóa đơn, sản phẩm hoặc khách hàng" /></div><select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} aria-label="Nguồn hàng"><option value="">Mọi nguồn</option><option value="customer">Khách hàng</option><option value="internal">Hàng trong kho</option></select><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="open">Đang xử lý</option><option value="closed">Đã kết thúc</option><option value="overdue">Quá hẹn</option></select></div>
      {loading && <div className="filter-loading">Đang tải phiếu bảo hành...</div>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>MÃ PHIẾU</th><th>SẢN PHẨM</th><th>NGUỒN / KHÁCH</th><th>NGÀY NHẬN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>
        {filtered.slice(pager.start, pager.end).map(item => <tr key={item.id}><td><strong className="invoice-number">{item.number}</strong>{item.saleNumber && <small className="warranty-subline">HĐ {item.saleNumber}</small>}</td><td><strong>{item.productName}</strong><small className="warranty-subline">{item.productCode} · {item.quantity} món</small></td><td>{item.source === 'customer' ? item.customerName || 'Khách lẻ' : 'Hàng trong kho'}{item.customerPhone && <small className="warranty-subline">{item.customerPhone}</small>}</td><td>{dateTime(item.createdAt)}{item.expectedReturnOn && <small className={item.expectedReturnOn < todayKey && !closed.has(item.status) ? "warranty-subline warranty-overdue" : "warranty-subline"}>Hẹn: {item.expectedReturnOn.split("-").reverse().join("/")}{item.expectedReturnOn < todayKey && !closed.has(item.status) && " · quá hẹn"}</small>}</td><td><span className={`warranty-status ${closed.has(item.status) ? 'closed' : ''}`}>{statusNames[item.status]}</span></td><td><button className="view-button" onClick={() => openCase(item)}>Xem / cập nhật</button></td></tr>)}
        {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><ClipboardList size={30} /><strong>Không có phiếu bảo hành phù hợp</strong></div></td></tr>}
      </tbody></table></div>
      <Pagination total={filtered.length} pageSize={20} page={pager.page} totalPages={pager.totalPages} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="phiếu bảo hành" />
    </div>

{creatingSource && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setCreatingSource(null) }}><div className="modal warranty-modal"><div className="modal-header"><div><div className="eyebrow">{creatingSource === "customer" ? "HÀNG KHÁCH GỬI" : "HÀNG LỖI TRONG KHO"}</div><h2>Tạo phiếu bảo hành</h2></div><button className="icon-button" onClick={() => setCreatingSource(null)} aria-label="Đóng"><X size={21} /></button></div><p className="modal-description">{creatingSource === "customer" ? "Ghi nhận hàng của khách, không hoàn tiền và không thay đổi tồn kho." : "Số lượng tiếp nhận sẽ được trừ khỏi tồn kho bán được. Khi bảo hành xong, bạn có thể nhập lại kho hoặc bỏ đi."}</p><form onSubmit={event => void createCase(event)} className="warranty-form"><label>Tìm sản phẩm<input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Tên hoặc mã sản phẩm" /></label><label>Sản phẩm<select required value={productId} onChange={event => setProductId(Number(event.target.value))}><option value={0}>Chọn sản phẩm</option>{productMatches.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name} · Còn {product.quantity}</option>)}</select></label><label>Số lượng<input required type="number" min="1" step="1" max={creatingSource === "internal" ? products.find(p => p.id === productId)?.quantity : undefined} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label>{creatingSource === "customer" && <><label>Tên khách hàng<input maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label><label>Số điện thoại<input maxLength={30} value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} /></label><label>Mã hóa đơn tham khảo (nếu có)<input maxLength={60} value={saleNumber} onChange={event => setSaleNumber(event.target.value)} /></label></>}
    <WarrantyUnitsEditor units={units} max={quantity} onChange={setUnits} />
    <label>Ngày hẹn trả<input type="date" value={expectedReturnOn} onChange={event => setExpectedReturnOn(event.target.value)} /></label>
    <label>Nơi bảo hành<input maxLength={120} value={partner} onChange={event => setPartner(event.target.value)} placeholder="Tên hãng hoặc đơn vị xử lý" /></label>
    <label>Mô tả lỗi<textarea required maxLength={500} value={issue} onChange={event => setIssue(event.target.value)} placeholder="Ví dụ: Không lên nguồn, cần gửi hãng kiểm tra" /></label><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setCreatingSource(null)}>Hủy</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo phiếu'}</button></div></form></div></div>}

    {selected && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null) }}><div className="modal warranty-modal"><div className="modal-header"><div><div className="eyebrow">{selected.source === 'customer' ? 'BẢO HÀNH KHÁCH HÀNG' : 'HÀNG LỖI TRONG KHO'}</div><h2>{selected.number}</h2></div><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="Đóng"><X size={21} /></button></div><div className="warranty-detail"><div><span>Sản phẩm</span><strong>{selected.productName} · {selected.productCode} × {selected.quantity}</strong></div><div><span>Tiếp nhận</span><strong>{dateTime(selected.createdAt)}</strong></div>{selected.saleNumber && <div><span>Hóa đơn</span><strong>{selected.saleNumber}</strong></div>}{selected.source === 'customer' && <div><span>Khách hàng</span><strong>{selected.customerName || 'Khách lẻ'} {selected.customerPhone}</strong></div>}<div><span>Lỗi / yêu cầu</span><strong>{selected.issue}</strong></div>{!!selected.units?.length && <div><span>Serial / hạn từng món</span><div className="warranty-unit-summary">{selected.units.map(unit => <strong key={unit.id}>{unit.serialNumber} {unit.warrantyExpiresOn && '· ' + unit.warrantyExpiresOn.split("-").reverse().join("/")}</strong>)}</div></div>}{selected.expectedReturnOn && <div><span>Ngày hẹn trả</span><strong>{selected.expectedReturnOn.split("-").reverse().join("/")}</strong></div>}<div><span>Trạng thái</span><strong>{statusNames[selected.status]}</strong></div>{selected.partner && <div><span>Nơi bảo hành</span><strong>{selected.partner}</strong></div>}</div>
      <div className="warranty-update warranty-details-edit">
        <h3>Thông tin theo dõi</h3>
        <WarrantyUnitsEditor units={units} max={selected.quantity} onChange={setUnits} />
        <label>Ngày hẹn trả<input type="date" value={expectedReturnOn} onChange={event => setExpectedReturnOn(event.target.value)} /></label>
        <label>Nơi bảo hành<input maxLength={120} value={partner} onChange={event => setPartner(event.target.value)} /></label>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveDetails()}>Lưu thông tin theo dõi</button>
      </div>
      <div className="warranty-timeline"><h3>Lịch sử xử lý</h3>{[...(selected.events ?? [])].sort((a, b) => a.at.localeCompare(b.at)).map(event => <div key={event.id}><Package size={15} /><span><strong>{statusNames[event.status]}</strong>{event.note && <small>{event.note}</small>}</span><time>{dateTime(event.at)}</time></div>)}</div>
      {!closed.has(selected.status) && <div className="warranty-update"><label>Nơi bảo hành<input maxLength={120} value={partner} onChange={event => setPartner(event.target.value)} placeholder="Tên hãng hoặc đơn vị xử lý" /></label><label>Ghi chú lần cập nhật<textarea maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Kết quả kiểm tra, mã vận đơn, tình trạng sau sửa..." /></label><div className="warranty-next"><span>Cập nhật trạng thái:</span>{selected.status === 'received' && <button disabled={saving} onClick={() => void updateStatus('sent')}>Đã gửi bảo hành</button>}{(selected.status === 'received' || selected.status === 'sent') && <button disabled={saving} onClick={() => void updateStatus('ready')}>Đã bảo hành xong</button>}{selected.status === 'ready' && <button disabled={saving} onClick={() => void updateStatus(selected.source === 'customer' ? 'returned_to_customer' : 'restocked')}>{selected.source === 'customer' ? 'Đã trả khách' : 'Nhập lại kho'}</button>}<button className="danger" disabled={saving} onClick={() => void updateStatus('discarded')}>Bỏ đi</button></div><p><AlertTriangle size={14} />Hàng của khách không cộng kho và không hoàn tiền. Hàng lỗi trong kho chỉ cộng lại khi chọn “Nhập lại kho”.</p></div>}
      <div className="modal-footer"><button className="secondary-button" onClick={() => setSelectedId(null)}>Đóng</button></div>
    </div></div>}
  </section>
}