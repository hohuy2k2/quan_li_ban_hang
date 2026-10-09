import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, X } from 'lucide-react'
import { api } from '../api'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { CustomerHistory, Party, PartyInput } from '../types'
import { dateTime, money, searchKey } from '../utils/format'

type Props = { active: boolean; onShowDebts: (customerId: number) => void; showToast: (message: string, kind?: 'success' | 'error') => void }
const blank = (): PartyInput => ({ kind: 'customer', name: '', phone: '', email: '', address: '', note: '' })

/** Danh bạ khách hàng, lịch sử hoá đơn và số dư công nợ. */
export function CustomersPage({ active, onShowDebts, showToast }: Props) {
  const [customers, setCustomers] = useState<Party[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Party | 'new' | null>(null)
  const [form, setForm] = useState<PartyInput>(blank)
  const [history, setHistory] = useState<CustomerHistory | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void api.parties('customer').then(value => { if (!cancelled) setCustomers(value) })
      .catch(error => showToast(error instanceof Error ? error.message : 'Không tải được khách hàng.', 'error'))
    return () => { cancelled = true }
  }, [active, loadKey, showToast])

  const visible = useMemo(() => customers.filter(c =>
    searchKey(`${c.name} ${c.phone} ${c.email} ${c.address}`).includes(searchKey(query))
  ), [customers, query])
  const pager = usePagination(visible.length, 20, query)

  function openForm(customer?: Party) {
    setEditing(customer ?? 'new')
    setForm(customer ? { kind: 'customer', name: customer.name, phone: customer.phone,
      email: customer.email, address: customer.address, note: customer.note } : blank())
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      if (editing === 'new') await api.createParty(form)
      else await api.updateParty(editing.id, form)
      setEditing(null)
      setLoadKey(value => value + 1)
      showToast('Đã lưu thông tin khách hàng.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không lưu được khách hàng.', 'error') }
    finally { setSaving(false) }
  }

  async function showHistory(id: number) {
    try { setHistory(await api.customerHistory(id)) }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không tải được lịch sử mua.', 'error') }
  }

  return <section className="page-content" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">THÔNG TIN KHÁCH HÀNG</div><h1>Khách hàng</h1><p>Thông tin liên hệ, lịch sử mua và số tiền còn nợ.</p></div>
      <button className="primary-button" onClick={() => openForm()}><Plus size={16} />Thêm khách hàng</button></div>
    <div className="panel crm-panel"><div className="crm-toolbar"><div className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, điện thoại, email..." /></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>KHÁCH HÀNG</th><th>LIÊN HỆ</th><th>ĐỊA CHỈ</th><th>CÒN NỢ</th><th></th></tr></thead><tbody>
        {visible.slice(pager.start, pager.end).map(c => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone || '—'}<small className="stacked-cell">{c.email}</small></td><td>{c.address || '—'}</td><td><strong>{money(c.balance)}</strong></td><td><div className="crm-actions"><button className="view-button" onClick={() => void showHistory(c.id)}>Lịch sử mua</button><button className="view-button" onClick={() => onShowDebts(c.id)}>Công nợ</button><button className="icon-button" onClick={() => openForm(c)} aria-label={`Sửa ${c.name}`}><Pencil size={15} /></button></div></td></tr>)}
        {!visible.length && <tr><td colSpan={5}><div className="table-empty">Chưa có khách hàng phù hợp.</div></td></tr>}
      </tbody></table></div><Pagination total={visible.length} pageSize={20} page={pager.page} totalPages={pager.totalPages} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="khách hàng" /></div>

    {editing && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}><div className="modal crm-modal">
      <div className="modal-header"><div><div className="eyebrow">HỒ SƠ KHÁCH HÀNG</div><h2>{editing === 'new' ? 'Thêm khách hàng' : 'Sửa thông tin'}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Đóng"><X size={20} /></button></div>
      <form className="crm-form" onSubmit={event => void save(event)}><label>Họ tên *<input required maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Số điện thoại<input maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Email<input type="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label>Địa chỉ<input maxLength={300} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></label>
        <label className="crm-wide">Ghi chú<textarea maxLength={500} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></label>
        <div className="modal-footer crm-wide"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Huỷ</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu khách hàng'}</button></div></form>
    </div></div>}

    {history && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setHistory(null) }}><div className="modal crm-modal">
      <div className="modal-header"><div><div className="eyebrow">LỊCH SỬ MUA HÀNG</div><h2>{history.party.name}</h2></div><button className="icon-button" onClick={() => setHistory(null)} aria-label="Đóng"><X size={20} /></button></div>
      <p className="crm-total">Tổng mua sau hoàn hàng: <strong>{money(history.totalSpent)}</strong></p>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>HOÁ ĐƠN</th><th>NGÀY</th><th>GIÁ TRỊ</th><th>HOÀN HÀNG</th><th>THỰC MUA</th></tr></thead><tbody>
        {history.sales.map(s => <tr key={s.id}><td><strong>{s.number}</strong></td><td>{dateTime(s.soldAt)}</td><td>{money(s.total)}</td><td>{money(s.refunded)}</td><td><strong>{money(s.netTotal)}</strong></td></tr>)}
        {!history.sales.length && <tr><td colSpan={5}>Chưa có hoá đơn.</td></tr>}
      </tbody></table></div>
    </div></div>}
  </section>
}
