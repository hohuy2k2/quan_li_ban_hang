import { useEffect, useState, type FormEvent } from 'react'
import { LogOut, X } from 'lucide-react'
import { login, logout, myOrders, register, requestResetCode, resetForgottenPassword } from '../api'
import type { AuthUser, StoreOrder } from '../types'
import { money } from '../utils/format'

type Props = {
  user: AuthUser | null
  onAuth: (user: AuthUser) => void
  onLogout: () => Promise<void>
  onClose: () => void
}

/** Đăng ký/đăng nhập và hiển thị các đơn đã gắn với tài khoản khách. */
export function AccountModal({ user, onAuth, onLogout, onClose }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState<StoreOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'customer') return
    let cancelled = false
    setLoading(true)
    void myOrders().then(value => { if (!cancelled) setOrders(value) })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không tải được đơn.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  /** Xử lý đăng nhập, đăng ký và hai bước khôi phục trong cùng biểu mẫu. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'forgot') {
        const result = await requestResetCode(email)
        setInfo(result.message)
        setMode('reset')
        return
      }
      if (mode === 'reset') {
        await resetForgottenPassword(email, code, password)
        setPassword('')
        setCode('')
        setMode('login')
        setInfo('Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.')
        return
      }
      const next = mode === 'login'
        ? await login(email, password)
        : await register({ email, password, displayName: name, phone })
      if (next.role !== 'customer') {
        await logout()
        throw new Error('Lỗi không xác định')
      }
      onAuth(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đăng nhập được.')
    } finally { setBusy(false) }
  }

  function switchMode(next: typeof mode) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setCode('')
  }

  return <div className="account-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="account-modal" aria-label="Tài khoản khách hàng">
      <div className="account-head"><div><span>TÀI KHOẢN KHÁCH HÀNG</span><h2>{user ? `Xin chào, ${user.displayName}` : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Quên mật khẩu' : 'Nhập mã xác nhận'}</h2></div><button onClick={onClose} aria-label="Đóng"><X size={22} /></button></div>
      {user ? <div className="account-body">
        <div className="account-user"><span>{user.email}</span><button onClick={() => void onLogout()}><LogOut size={15} />Đăng xuất</button></div>
        <h3>Đơn hàng của tôi</h3>
        {loading ? <p className="account-muted">Đang tải đơn hàng...</p> : orders.length === 0 ? <p className="account-muted">Bạn chưa có đơn nào trong tài khoản.</p> :
          <div className="account-orders">{orders.map(order => <article key={order.id}>
            <div><strong>{order.number}</strong><span className={`account-order-status ${order.status}`}>{order.status === 'pending' ? 'Chờ xác nhận' : order.status === 'confirmed' ? 'Đã xác nhận' : 'Đã huỷ'}</span></div>
            <small>{new Date(order.createdAt).toLocaleString('vi-VN')} · {order.fulfillment === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao hàng'}</small>
            <ul>{order.items.map(item => <li key={item.id}>{item.productName} × {item.quantity}<b>{money(item.lineTotal)}</b></li>)}</ul>
            <div className="account-order-total">Tổng cộng <strong>{money(order.total)}</strong></div>
          </article>)}</div>}
      </div> : <div className="account-body">
        <div className="account-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => switchMode('login')}>Đăng nhập</button><button className={mode === 'register' ? 'selected' : ''} onClick={() => switchMode('register')}>Đăng ký</button></div>
        <form className="account-form" onSubmit={event => void submit(event)}>
          {mode === 'register' && <><label>Họ tên<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label><label>Số điện thoại<input type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label></>}
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
          {mode === 'reset' && <label>Mã 6 chữ số trong email<input inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>}
          {mode !== 'forgot' && <label>{mode === 'reset' ? 'Mật khẩu mới (ít nhất 8 ký tự)' : `Mật khẩu${mode === 'register' ? ' (ít nhất 8 ký tự)' : ''}`}<input type="password" required minLength={mode === 'login' ? undefined : 8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>}
          <button disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Gửi mã qua email' : 'Đặt lại mật khẩu'}</button>
          {mode === 'login' && <button className="account-text-button" type="button" onClick={() => switchMode('forgot')}>Quên mật khẩu?</button>}
          {mode === 'reset' && <button className="account-text-button" type="button" onClick={() => switchMode('forgot')}>Yêu cầu mã mới</button>}
          <p>{mode === 'forgot' ? 'Nhập email đã đăng ký để nhận mã khôi phục.' : mode === 'reset' ? 'Mã chỉ dùng một lần và hết hạn sau 10 phút.' : 'Đăng nhập để lưu và xem lại trạng thái đơn hàng của bạn.'}</p>
        </form>
      </div>}
      {info && <div className="account-success" role="status">{info}</div>}
      {error && <div className="account-error" role="alert">{error}</div>}
    </section>
  </div>
}
