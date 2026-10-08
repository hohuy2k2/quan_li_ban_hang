import { useState, type FormEvent } from 'react'
import { LockKeyhole, Moon, Sun } from 'lucide-react'

type Props = { onLogin: (email: string, password: string) => Promise<void>; initialError?: string; theme: 'light' | 'dark'; onToggleTheme: () => void }

/** Chặn giao diện quản lý cho tới khi đăng nhập bằng tài khoản admin. */
export function AdminLoginPage({ onLogin, initialError, theme, onToggleTheme }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await onLogin(email, password) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đăng nhập được.') }
    finally { setBusy(false) }
  }

  return <main className="admin-login-page"><button type="button" className="login-theme-toggle" onClick={onToggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</button><form className="admin-login-card" onSubmit={event => void submit(event)}>
    <span className="admin-login-icon"><LockKeyhole size={27} /></span>
    <h1>Đăng nhập quản lý</h1>
    <p>Chỉ quản trị viên mới xem được kho, hoá đơn và báo cáo.</p>
    <label>Email admin<input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label>Mật khẩu<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
    {(error || initialError) && <div className="admin-login-error" role="alert">{error || initialError}</div>}
    <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>

  </form></main>
}
