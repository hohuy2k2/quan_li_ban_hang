import type { AuthUser, NewOrder, OrderReceipt, Product, StoreOrder } from './types'

let csrfPromise: Promise<string> | null = null

/** Lấy token chống giả mạo trước khi ghi dữ liệu bằng cookie đăng nhập. */
function csrfToken(): Promise<string> {
  csrfPromise ??= fetch('/api/auth/csrf').then(async response => {
    if (!response.ok) throw new Error('Không tạo được phiên bảo mật.')
    return (await response.json() as { token: string }).token
  }).catch(error => { csrfPromise = null; throw error })
  return csrfPromise
}

/** Đọc thông báo lỗi do backend trả về để hiển thị cho khách. */
async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as { message?: string }
  return new Error(body.message ?? (response.status === 401
    ? 'Bạn cần đăng nhập hoặc phiên đăng nhập đã hết hạn.'
    : response.status === 429 ? 'Bạn thao tác quá nhanh. Hãy thử lại sau một phút.'
    : `Không gửi được yêu cầu (${response.status}).`))
}

/** Gọi API cùng nguồn và tự gắn token cho các thao tác ghi. */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (options?.body) headers.set('Content-Type', 'application/json')
  if (options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()))
    headers.set('X-CSRF-TOKEN', await csrfToken())
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Chỉ lấy thông tin sản phẩm dành cho website khách hàng. */
export async function getProducts(): Promise<Product[]> {
  return request<Product[]>('/store/products')
}

/** Gửi đơn chờ xác nhận; backend tính lại giá và kiểm tra tồn kho. */
export async function createOrder(order: NewOrder): Promise<OrderReceipt> {
  return request<OrderReceipt>('/store/orders', { method: 'POST', body: JSON.stringify(order) })
}

/** Kiểm tra cookie đăng nhập khi mở trang. */
export async function currentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me')
  if (response.status === 401) return null
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<AuthUser>
}

/** Đăng ký và tự đăng nhập tài khoản khách. */
export async function register(data: { email: string; password: string; displayName: string; phone: string }): Promise<AuthUser> {
  const user = await request<AuthUser>('/auth/register', { method: 'POST', body: JSON.stringify(data) })
  csrfPromise = null
  return user
}

/** Đăng nhập bằng email và mật khẩu. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await request<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  csrfPromise = null
  return user
}

/** Yêu cầu gửi mã khôi phục đến email khách đã đăng ký. */
export function requestResetCode(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
}

/** Xác nhận mã email rồi đặt mật khẩu mới. */
export function resetForgottenPassword(email: string, code: string, newPassword: string): Promise<void> {
  return request<void>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) })
}

/** Xoá cookie phiên và token cũ. */
export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
  csrfPromise = null
}

/** Chỉ tải những đơn gắn với tài khoản khách đang đăng nhập. */
export function myOrders(): Promise<StoreOrder[]> {
  return request<StoreOrder[]>('/store/orders/mine')
}
