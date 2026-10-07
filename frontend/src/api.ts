import type { Product, ProductAudit, ProductInput, Sale, StockMovement, Summary } from './types'

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
  sales: () => request<Sale[]>('/sales'),
  createSale: (data: { customerName: string; customerPhone: string; items: { productId: number; quantity: number }[] }) =>
    request<Sale>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  history: () => request<ProductAudit[]>('/history'),
  movements: () => request<StockMovement[]>('/movements'),
  summary: () => request<Summary>('/summary'),
}
