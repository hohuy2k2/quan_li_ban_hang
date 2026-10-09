import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Pencil, Plus, Search, X } from 'lucide-react'
import { api } from '../api'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { Debt, Party, PartyInput, PartyKind } from '../types'
import { dateTime, money, searchKey } from '../utils/format'

type Props = { active: boolean; focusPartyId: number | null; onClearFocus: () => void; showToast: (message: string, kind?: 'success' | 'error') => void }
const today = () => new Date().toLocaleDateString('sv-SE')
const blankSupplier = (): PartyInput => ({ kind: 'supplier', name: '', phone: '', email: '', address: '', note: '' })

/** Công nợ từng chứng từ, thanh toán từng lần và xuất toàn bộ sổ ra Excel. */
export function DebtsPage({ active, focusPartyId, onClearFocus, showToast }: Props) {
  const [kind, setKind] = useState<PartyKind>('customer')
  const [debts, setDebts] = useState<Debt[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | 'paid'>('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [paymentFor, setPaymentFor] = useState<Debt | null>(null)
  const [payment, setPayment] = useState({ amount: 0, paidOn: today(), note: '' })
  const [opening, setOpening] = useState(false)
  const [openingForm, setOpeningForm] = useState({ partyId: 0, amount: 0, dueDate: '', note: '' })
  const [supplierForm, setSupplierForm] = useState<PartyInput | null>(null)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => { if (focusPartyId) setKind('customer') }, [focusPartyId])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void Promise.all([api.debts(kind), api.parties(kind)]).then(([nextDebts, nextParties]) => {
      if (!cancelled) { setDebts(nextDebts); setParties(nextParties) }
    }).catch(error => showToast(error instanceof Error ? error.message : 'Không tải được công nợ.', 'error'))
    return () => { cancelled = true }
  }, [active, kind, loadKey, showToast])

  const visible = useMemo(() => debts.filter(d =>
    (!focusPartyId || d.partyId === focusPartyId) &&
    (status === 'all' || (status === 'open' ? d.balance > 0 : d.balance === 0)) &&
    searchKey(`${d.partyName} ${d.reference} ${d.note}`).includes(searchKey(query))
  ), [debts, focusPartyId, status, query])
  const pager = usePagination(visible.length, 20, JSON.stringify([kind, focusPartyId, query, status]))
  const outstanding = debts.filter(d => !focusPartyId || d.partyId === focusPartyId).reduce((sum, d) => sum + d.balance, 0)

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!paymentFor) return
    setBusy(true)
    try {
      await api.payDebt(paymentFor.id, payment)
      setPaymentFor(null)
      setLoadKey(value => value + 1)
      showToast('Đã ghi nhận thanh toán.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không lưu được thanh toán.', 'error') }
    finally { setBusy(false) }
  }

  async function saveOpening(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.createOpeningDebt(openingForm)
      setOpening(false)
      setLoadKey(value => value + 1)
      showToast('Đã ghi công nợ đầu kỳ.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không tạo được công nợ.', 'error') }
    finally { setBusy(false) }
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supplierForm) return
    setBusy(true)
    try {
      if (supplierId) await api.updateParty(supplierId, supplierForm)
      else await api.createParty(supplierForm)
      setSupplierForm(null)
      setLoadKey(value => value + 1)
      showToast('Đã lưu nhà cung cấp.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không lưu được nhà cung cấp.', 'error') }
    finally { setBusy(false) }
  }

  async function exportExcel() {
    try {
      const file = await api.exportDebts(kind)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url; link.download = `cong-no-${kind}-${today()}.xlsx`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('Đã xuất sổ công nợ ra Excel.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không xuất được Excel.', 'error') }
  }

  return <section className="page-content" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">THEO DÕI THANH TOÁN</div><h1>Công nợ</h1><p>Ghi nhận từng khoản còn phải thu hoặc phải trả và các lần thanh toán.</p></div>
      <div className="debt-actions"><button className="secondary-button" onClick={() => void exportExcel()}><Download size={16} />Xuất Excel</button><button className="primary-button" onClick={() => { setOpeningForm({ partyId: 0, amount: 0, dueDate: '', note: '' }); setOpening(true) }}><Plus size={16} />Nợ đầu kỳ</button></div></div>
    <div className="debt-tabs"><button className={kind === 'customer' ? 'selected' : ''} onClick={() => { setKind('customer'); setExpanded(null) }}>Khách hàng phải trả</button><button className={kind === 'supplier' ? 'selected' : ''} onClick={() => { onClearFocus(); setKind('supplier'); setExpanded(null) }}>Cần trả nhà cung cấp</button>{focusPartyId && <button onClick={onClearFocus}>Bỏ lọc khách hàng ×</button>}</div>
    <div className="debt-summary"><div><span>Tổng còn nợ</span><strong>{money(outstanding)}</strong></div><div><span>Khoản chưa tất toán</span><strong>{debts.filter(d => d.balance > 0 && (!focusPartyId || d.partyId === focusPartyId)).length}</strong></div></div>
    {kind === 'supplier' && <div className="panel supplier-panel"><div className="supplier-heading"><strong>Nhà cung cấp</strong><button className="secondary-button" onClick={() => { setSupplierId(null); setSupplierForm(blankSupplier()) }}><Plus size={15} />Thêm nhà cung cấp</button></div>
      <div className="supplier-list">{parties.map(p => <div key={p.id}><span><strong>{p.name}</strong> · {p.phone || 'Chưa có số điện thoại'} · Còn nợ {money(p.balance)}</span><button className="icon-button" onClick={() => { setSupplierId(p.id); setSupplierForm({ kind: 'supplier', name: p.name, phone: p.phone, email: p.email, address: p.address, note: p.note }) }} aria-label={`Sửa ${p.name}`}><Pencil size={15} /></button></div>)}</div></div>}
    <div className="panel debt-panel"><div className="debt-toolbar"><div className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, mã chứng từ..." /></div><select value={status} onChange={event => setStatus(event.target.value as typeof status)} aria-label="Trạng thái công nợ"><option value="all">Tất cả</option><option value="open">Còn nợ</option><option value="paid">Đã trả đủ</option></select></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>CHỨNG TỪ</th><th>KHÁCH / NHÀ CUNG CẤP</th><th>NGÀY / HẠN</th><th>NỢ BAN ĐẦU</th><th>ĐÃ TRẢ</th><th>CÒN NỢ</th><th></th></tr></thead><tbody>
        {visible.slice(pager.start, pager.end).map(d => <tr key={d.id}><td><strong>{d.reference}</strong><small className="stacked-cell">{d.sourceType === 'opening' ? 'Nợ đầu kỳ' : d.sourceType === 'sale' ? 'Hoá đơn' : 'Phiếu nhập'}</small></td><td>{d.partyName}</td><td>{dateTime(d.createdAt)}{d.dueDate && <small className="stacked-cell">Hạn {d.dueDate.split('-').reverse().join('/')}</small>}</td><td>{money(d.principal)}</td><td>{money(d.paid)}</td><td><strong>{money(d.balance)}</strong></td><td><div className="crm-actions"><button className="view-button" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>Lịch sử</button>{d.balance > 0 && <button className="view-button" onClick={() => { setPaymentFor(d); setPayment({ amount: d.balance, paidOn: today(), note: '' }) }}>Ghi thanh toán</button>}</div></td></tr>)}
        {!visible.length && <tr><td colSpan={7}><div className="table-empty">Chưa có công nợ phù hợp.</div></td></tr>}
      </tbody></table></div><Pagination total={visible.length} pageSize={20} page={pager.page} totalPages={pager.totalPages} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="khoản nợ" /></div>
    {expanded && <div className="panel debt-history"><h2>Lịch sử thanh toán · {debts.find(d => d.id === expanded)?.reference}</h2>{debts.find(d => d.id === expanded)?.payments.map(p => <div key={p.id}><span>{dateTime(p.paidAt)} · {p.note || 'Thanh toán'}</span><strong>{money(p.amount)}</strong></div>)}{!debts.find(d => d.id === expanded)?.payments.length && <p>Chưa có lần thanh toán nào.</p>}</div>}

    {paymentFor && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentFor(null) }}><div className="modal crm-modal"><div className="modal-header"><div><div className="eyebrow">THANH TOÁN CÔNG NỢ</div><h2>{paymentFor.reference}</h2></div><button className="icon-button" onClick={() => setPaymentFor(null)} aria-label="Đóng"><X size={20} /></button></div><p className="crm-total">Còn nợ: <strong>{money(paymentFor.balance)}</strong></p>
      <form className="crm-form" onSubmit={event => void savePayment(event)}><label>Số tiền trả *<input type="number" required min={1} max={paymentFor.balance} step={1} value={payment.amount} onChange={event => setPayment({ ...payment, amount: Number(event.target.value) })} /></label><label>Ngày trả<input type="date" value={payment.paidOn} onChange={event => setPayment({ ...payment, paidOn: event.target.value })} /></label><label className="crm-wide">Ghi chú<textarea maxLength={500} value={payment.note} onChange={event => setPayment({ ...payment, note: event.target.value })} /></label><div className="modal-footer crm-wide"><button type="button" className="secondary-button" onClick={() => setPaymentFor(null)}>Huỷ</button><button className="primary-button" disabled={busy}>Lưu thanh toán</button></div></form></div></div>}
    {opening && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpening(false) }}><div className="modal crm-modal"><div className="modal-header"><div><div className="eyebrow">SỐ DƯ BAN ĐẦU</div><h2>Ghi công nợ đầu kỳ</h2></div><button className="icon-button" onClick={() => setOpening(false)} aria-label="Đóng"><X size={20} /></button></div><form className="crm-form" onSubmit={event => void saveOpening(event)}><label className="crm-wide">{kind === 'customer' ? 'Khách hàng' : 'Nhà cung cấp'} *<select required value={openingForm.partyId} onChange={event => setOpeningForm({ ...openingForm, partyId: Number(event.target.value) })}><option value={0}>Chọn hồ sơ</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Số tiền còn nợ *<input type="number" required min={1} step={1} value={openingForm.amount} onChange={event => setOpeningForm({ ...openingForm, amount: Number(event.target.value) })} /></label><label>Hạn thanh toán<input type="date" value={openingForm.dueDate} onChange={event => setOpeningForm({ ...openingForm, dueDate: event.target.value })} /></label><label className="crm-wide">Ghi chú<textarea maxLength={500} value={openingForm.note} onChange={event => setOpeningForm({ ...openingForm, note: event.target.value })} /></label><div className="modal-footer crm-wide"><button type="button" className="secondary-button" onClick={() => setOpening(false)}>Huỷ</button><button className="primary-button" disabled={busy}>Lưu công nợ</button></div></form></div></div>}
    {supplierForm && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSupplierForm(null) }}><div className="modal crm-modal"><div className="modal-header"><div><div className="eyebrow">NHÀ CUNG CẤP</div><h2>{supplierId ? 'Sửa hồ sơ' : 'Thêm nhà cung cấp'}</h2></div><button className="icon-button" onClick={() => setSupplierForm(null)} aria-label="Đóng"><X size={20} /></button></div><form className="crm-form" onSubmit={event => void saveSupplier(event)}><label>Tên *<input required maxLength={160} value={supplierForm.name} onChange={event => setSupplierForm({ ...supplierForm, name: event.target.value })} /></label><label>Số điện thoại<input maxLength={30} value={supplierForm.phone} onChange={event => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label><label>Email<input type="email" maxLength={254} value={supplierForm.email} onChange={event => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label><label>Địa chỉ<input maxLength={300} value={supplierForm.address} onChange={event => setSupplierForm({ ...supplierForm, address: event.target.value })} /></label><label className="crm-wide">Ghi chú<textarea maxLength={500} value={supplierForm.note} onChange={event => setSupplierForm({ ...supplierForm, note: event.target.value })} /></label><div className="modal-footer crm-wide"><button type="button" className="secondary-button" onClick={() => setSupplierForm(null)}>Huỷ</button><button className="primary-button" disabled={busy}>Lưu nhà cung cấp</button></div></form></div></div>}
  </section>
}
