import type { Product, ProductAudit, ProductInput, ReturnInput, Sale, SaleInput, SaleReturn, SaleReturnItem, StockMovement, Summary } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error('Không kết nối được với ứng dụng. Hãy kiểm tra phần mềm đã khởi động.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message ?? `Có lỗi xảy ra (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  products: () => request<Product[]>('/products'),
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
  returnItems: (id: number, data: ReturnInput) => request<SaleReturn>(`/sales/${id}/returns`, { method: 'POST', body: JSON.stringify(data) }),
  resolveWarranty: (id: number, outcome: 'returned_to_customer' | 'discard') =>
    request<SaleReturnItem>(`/returns/items/${id}/warranty`, { method: 'PATCH', body: JSON.stringify({ outcome }) }),
  history: (filters?: { action?: string; query?: string }) => request<ProductAudit[]>(`/history${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}` : ''}`),
  movements: (filters?: { direction?: string; query?: string }) => request<StockMovement[]>(`/movements${filters ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}` : ''}`),
  summary: () => request<Summary>('/summary'),
}
