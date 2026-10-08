import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, X } from 'lucide-react'
import { api } from '../api'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { Account, AccountDetails, AuthUser } from '../types'
import { dateTime, searchKey } from '../utils/format'

type Props = {
  active: boolean
  user: AuthUser
  onUserChange: (user: AuthUser) => void
  showToast: (message: string, kind?: 'success' | 'error') => void
}

const blankAccount = (): AccountDetails => ({ displayName: '', email: '', phone: '', role: 'customer', isActive: true })

/** Hồ sơ cá nhân và danh sách tài khoản; chỉ admin được mở trang này. */
export function AccountsPage({ active, user, onUserChange, showToast }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState({ displayName: user.displayName, email: user.email, phone: user.phone })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [form, setForm] = useState<AccountDetails>(blankAccount)
  const [formPassword, setFormPassword] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setProfile({ displayName: user.displayName, email: user.email, phone: user.phone }) }, [user])
  useEffect(() => {
    if (!active) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void api.accounts().then(value => { if (!cancelled) setAccounts(value) })
      .catch(error => { if (!cancelled) { setAccounts([]); setLoadError(error instanceof Error ? error.message : 'Không tải được tài khoản.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active, reloadKey])

  const visible = useMemo(() => accounts.filter(account =>
    searchKey(`${account.displayName} ${account.email} ${account.phone}`).includes(searchKey(query))
  ), [accounts, query])
  const pager = usePagination(visible.length, 20, query)

  async function reloadAccounts() { setAccounts(await api.accounts()) }

  /** Lưu tên, email, số điện thoại của admin hiện tại và nhận cookie mới. */
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      onUserChange(await api.updateProfile(profile))
      await reloadAccounts()
      showToast('Đã cập nhật hồ sơ.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không lưu được hồ sơ.', 'error') }
    finally { setBusy(false) }
  }

  /** Mật khẩu riêng phải xác nhận lại và cung cấp mật khẩu cũ. */
  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword !== confirmPassword) { showToast('Hai mật khẩu mới không khớp.', 'error'); return }
    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      showToast('Đã đổi mật khẩu. Các phiên đăng nhập cũ hết hiệu lực.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không đổi được mật khẩu.', 'error') }
    finally { setBusy(false) }
  }

  function openCreate() {
    setEditing('new'); setForm(blankAccount()); setFormPassword(''); setResetPassword('')
  }

  function openEdit(account: Account) {
    setEditing(account)
    setForm({ displayName: account.displayName, email: account.email, phone: account.phone, role: account.role, isActive: account.isActive })
    setResetPassword('')
  }

  /** Tạo hoặc sửa tài khoản mà vẫn giữ các đơn hàng đã liên kết. */
  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      if (editing === 'new') await api.createAccount({ ...form, password: formPassword })
      else if (editing) await api.updateAccount(editing.id, form)
      await reloadAccounts()
      setEditing(null)
      showToast('Đã lưu tài khoản.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không lưu được tài khoản.', 'error') }
    finally { setBusy(false) }
  }

  async function resetOtherPassword() {
    if (!editing || editing === 'new') return
    setBusy(true)
    try {
      await api.resetAccountPassword(editing.id, resetPassword)
      setResetPassword('')
      showToast('Đã đặt mật khẩu mới. Phiên cũ của tài khoản này hết hiệu lực.')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không đặt lại được mật khẩu.', 'error') }
    finally { setBusy(false) }
  }

  return <section className="page-content accounts-page" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">TÀI KHOẢN VÀ PHÂN QUYỀN</div><h1>Quản lý tài khoản</h1><p>Chỉnh hồ sơ, đổi mật khẩu và quản lý quyền truy cập của người dùng.</p></div></div>
    <div className="account-settings-grid">
      <form className="panel account-settings-card" onSubmit={event => void saveProfile(event)}>
        <h2>Hồ sơ của tôi</h2>
        <label>Họ tên<input required minLength={2} maxLength={120} value={profile.displayName} onChange={event => setProfile({ ...profile, displayName: event.target.value })} /></label>
        <label>Email<input required type="email" maxLength={254} value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} /></label>
        <label>Số điện thoại<input maxLength={30} value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label>
        <button className="primary-button" disabled={busy}>Lưu thông tin</button>
      </form>
      <form className="panel account-settings-card" onSubmit={event => void savePassword(event)}>
        <h2>Đổi mật khẩu</h2>
        <label>Mật khẩu hiện tại<input required type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
        <label>Mật khẩu mới<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
        <label>Nhập lại mật khẩu mới<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
        <button className="primary-button" disabled={busy}>Đổi mật khẩu</button>
      </form>
    </div>

    <div className="panel accounts-panel">
      <div className="accounts-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại" aria-label="Tìm tài khoản" /></div><button className="primary-button" onClick={openCreate}><Plus size={16} />Thêm tài khoản</button></div>
      {loading ? <p className="accounts-empty">Đang tải tài khoản...</p> : loadError ? <div className="accounts-empty" role="alert"><p>{loadError}</p><button className="secondary-button" onClick={() => setReloadKey(value => value + 1)}>Thử tải lại</button></div> : visible.length === 0 ? <p className="accounts-empty">Không có tài khoản phù hợp.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>TÊN</th><th>EMAIL</th><th>ĐIỆN THOẠI</th><th>QUYỀN</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th><th></th></tr></thead><tbody>{visible.slice(pager.start, pager.end).map(account => <tr key={account.id}><td><strong>{account.displayName}</strong></td><td>{account.email}</td><td>{account.phone || '—'}</td><td>{account.role === 'admin' ? 'Quản trị' : 'Khách hàng'}</td><td><span className={`account-state ${account.isActive ? 'active' : 'inactive'}`}>{account.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td><td>{dateTime(account.createdAt)}</td><td>{account.id === user.id ? 'Bạn' : <button className="secondary-button" onClick={() => openEdit(account)}><Pencil size={14} />Sửa</button>}</td></tr>)}</tbody></table></div>}
      {visible.length > 20 && <Pagination page={pager.page} totalPages={pager.totalPages} pageSize={20} total={visible.length} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="tài khoản" />}
    </div>

    {editing && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}><div className="modal account-editor">
      <div className="modal-header"><div><div className="eyebrow">QUẢN LÝ TÀI KHOẢN</div><h2>{editing === 'new' ? 'Thêm tài khoản' : `Sửa ${editing.displayName}`}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Đóng"><X size={20} /></button></div>
      <form className="account-editor-form" onSubmit={event => void saveAccount(event)}>
        <label>Họ tên<input required minLength={2} maxLength={120} value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>Email<input required type="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label>Số điện thoại<input maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Quyền<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as AccountDetails['role'] })}><option value="customer">Khách hàng</option><option value="admin">Quản trị</option></select></label>
        {editing === 'new' ? <label>Mật khẩu ban đầu<input required type="password" minLength={8} maxLength={128} value={formPassword} onChange={event => setFormPassword(event.target.value)} /></label> : <label className="account-lock"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Tài khoản hoạt động</label>}
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Huỷ</button><button className="primary-button" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu tài khoản'}</button></div>
      </form>
      {editing !== 'new' && <div className="account-reset"><h3>Đặt lại mật khẩu</h3><p>Phiên đăng nhập cũ của tài khoản này sẽ hết hiệu lực.</p><div><input type="password" minLength={8} maxLength={128} placeholder="Mật khẩu mới (ít nhất 8 ký tự)" value={resetPassword} onChange={event => setResetPassword(event.target.value)} /><button className="secondary-button" disabled={busy || resetPassword.length < 8} onClick={() => void resetOtherPassword()}>Đặt lại</button></div></div>}
    </div></div>}
  </section>
}
