import type { Account, AccountDetails, AuthUser, CustomerHistory, Debt, DebtPayment, OnlineOrder, Party, PartyInput, PartyKind, Product, ProductAudit, ProductInput, ReturnInput, RevenueReport, Sale, SaleInput, SaleReturn, SaleReturnItem, StockMovement, StockDocument, StockDocumentInput, Summary, WarrantyCase, WarrantyStatus } from './types'

let csrfPromise: Promise<string> | null = null

/** Báo rõ khi trang HTML (thường từ backend cũ hoặc sai cổng) bị trả về thay cho API. */
async function readJson<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('json'))
    throw new Error(`API ${path} trả về HTML thay vì dữ liệu. Hãy kiểm tra backend ở cổng 5000 và đường dẫn API.`)
  try { return await response.json() as T }
  catch { throw new Error('Dữ liệu API không hợp lệ. Hãy khởi động lại backend và tải lại trang.') }
}

/** Lấy token chống giả mạo cho các thao tác ghi dùng cookie đăng nhập. */
function csrfToken(): Promise<string> {
  csrfPromise ??= fetch('/api/auth/csrf').then(async response => {
    if (!response.ok) throw new Error('Không tạo được phiên bảo mật.')
    const body = await readJson<{ token?: string }>(response, '/api/auth/csrf')
    if (!body.token) throw new Error('Backend chưa hỗ trợ đăng nhập. Hãy chạy phiên bản backend mới.')
    return body.token
  }).catch(error => { csrfPromise = null; throw error })
  return csrfPromise
}

// Mọi lời gọi backend đi qua đây để thống nhất xử lý lỗi và thông báo cho người dùng.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  const headers = new Headers(options?.headers)
  if (options?.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()))
    headers.set('X-CSRF-TOKEN', await csrfToken())
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('Không kết nối được với ứng dụng. Hãy kiểm tra phần mềm đã khởi động.')
  }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('admin-auth-expired'))
    const body: { message?: string } = response.headers.get('content-type')?.includes('json')
      ? await response.json().catch(() => ({})) as { message?: string } : {}
    throw new Error(body.message ?? `Có lỗi xảy ra (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return readJson<T>(response, `/api${path}`)
}

export const api = {
  currentUser: async (): Promise<AuthUser | null> => {
    let response: Response
    try { response = await fetch('/api/auth/me') }
    catch { throw new Error('Không kết nối được backend ở cổng 5000.') }
    if (response.status === 401) return null
    if (!response.ok) throw new Error('Không kiểm tra được phiên đăng nhập.')
    return readJson<AuthUser>(response, '/api/auth/me')
  },
  login: async (email: string, password: string) => {
    const user = await request<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    csrfPromise = null
    return user
  },
  logout: async () => {
    await request<void>('/auth/logout', { method: 'POST' })
    csrfPromise = null
  },
  updateProfile: async (data: { displayName: string; email: string; phone: string }) => {
    const user = await request<AuthUser>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
    csrfPromise = null
    return user
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    await request<void>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
    csrfPromise = null
  },
  accounts: () => request<Account[]>('/accounts'),
  parties: (kind?: PartyKind) => request<Party[]>(`/parties${kind ? `?kind=${kind}` : ''}`),
  createParty: (data: PartyInput) => request<Party>('/parties', { method: 'POST', body: JSON.stringify(data) }),
  updateParty: (id: number, data: PartyInput) => request<Party>(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  customerHistory: (id: number) => request<CustomerHistory>(`/parties/${id}/history`),
  debts: (kind?: PartyKind) => request<Debt[]>(`/debts${kind ? `?kind=${kind}` : ''}`),
  createOpeningDebt: (data: { partyId: number; amount: number; dueDate: string; note: string }) =>
    request<Debt>('/debts/opening', { method: 'POST', body: JSON.stringify(data) }),
  payDebt: (id: number, data: { amount: number; paidOn: string; note: string }) =>
    request<DebtPayment>(`/debts/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  exportDebts: async (kind?: PartyKind) => {
    const response = await fetch(`/api/debts/export.xlsx${kind ? `?kind=${kind}` : ''}`)
    if (!response.ok) throw new Error('Không xuất được tệp Excel công nợ.')
    return response.blob()
  },
  customerStatement: async (partyId: number, year: number) => {
    const response = await fetch(`/api/parties/${partyId}/statement.xlsx?year=${year}`)
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { message?: string } | null
      throw new Error(error?.message || 'Không xuất được bảng công nợ của khách.')
    }
    return response.blob()
  },
  createAccount: (data: AccountDetails & { password: string }) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: AccountDetails) =>
    request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetAccountPassword: (id: number, newPassword: string) =>
    request<void>(`/accounts/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  products: () => request<Product[]>('/products'),
  uploadImage: async (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<{ imageUrl: string }>('/product-images', { method: 'POST', body: form })
  },
  revenue: (from: string, to: string) => request<RevenueReport>(`/revenue?${new URLSearchParams({ from, to })}`),
  onlineOrders: () => request<OnlineOrder[]>('/online-orders'),
  confirmOnlineOrder: (id: number) => request<OnlineOrder>(`/online-orders/${id}/confirm`, { method: 'POST' }),
  cancelOnlineOrder: (id: number) => request<OnlineOrder>(`/online-orders/${id}/cancel`, { method: 'POST' }),
  nextCode: () => request<{ code: string }>('/products/next-code'),
  lookup: (code: string) => request<Product>(`/products/lookup/${encodeURIComponent(code)}`),
  createProduct: (input: ProductInput) => request<Product>('/products', {
    method: 'POST', body: JSON.stringify(input),
  }),
  updateProduct: (id: number, input: ProductInput) => request<Product>(`/products/${id}`, {
    method: 'PUT', body: JSON.stringify(input),
  }),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  sales: (range?: { from?: string; to?: string }) => request<Sale[]>(`/sales${range ? `?${new URLSearchParams(Object.entries(range).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}` : ''}`),
  saleByNumber: (number: string) => request<Sale>(`/sales/by-number/${encodeURIComponent(number)}`),
  createSale: (data: SaleInput) =>
    request<Sale>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale: (id: number, data: SaleInput) => request<Sale>(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSale: (id: number) => request<void>(`/sales/${id}`, { method: 'DELETE' }),
  returnItems: (id: number, data: ReturnInput) => request<SaleReturn>(`/sales/${id}/returns`, { method: 'POST', body: JSON.stringify(data) }),
  resolveWarranty: (id: number, outcome: 'returned_to_customer' | 'discard') =>
    request<SaleReturnItem>(`/returns/items/${id}/warranty`, { method: 'PATCH', body: JSON.stringify({ outcome }) }),
  history: (filters?: { action?: string; query?: string }) => request<ProductAudit[]>(`/history${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}` : ''}`),
  movements: (filters?: { direction?: string; query?: string }) => request<StockMovement[]>(`/movements${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}` : ''}`),
  stockDocuments: () => request<StockDocument[]>('/stock-documents'),
  createStockDocument: (data: StockDocumentInput) => request<StockDocument>('/stock-documents', { method: 'POST', body: JSON.stringify(data) }),
  warranties: () => request<WarrantyCase[]>('/warranties'),
  createCustomerWarranty: (data: { productId: number; quantity: number; customerName: string; customerPhone: string; saleNumber: string; issue: string; units: { serialNumber: string; warrantyExpiresOn: string }[]; expectedReturnOn: string; partner: string }) =>
    request<WarrantyCase>('/warranties/customer', { method: 'POST', body: JSON.stringify(data) }),
  createInternalWarranty: (data: { productId: number; quantity: number; issue: string; units: { serialNumber: string; warrantyExpiresOn: string }[]; expectedReturnOn: string; partner: string }) =>
    request<WarrantyCase>('/warranties/internal', { method: 'POST', body: JSON.stringify(data) }),
  updateWarranty: (id: number, data: { status: WarrantyStatus; note: string; partner: string }) =>
    request<WarrantyCase>(`/warranties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateWarrantyDetails: (id: number, data: { units: { serialNumber: string; warrantyExpiresOn: string }[]; expectedReturnOn: string; partner: string }) =>
    request<WarrantyCase>('/warranties/' + id + '/details', { method: 'PUT', body: JSON.stringify(data) }),
  summary: () => request<Summary>('/summary'),
}
