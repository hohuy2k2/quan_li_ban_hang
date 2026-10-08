import type { NewOrder, OrderReceipt, Product } from './types'

/** Đọc thông báo lỗi do backend trả về để hiển thị cho khách. */
async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as { message?: string }
  return new Error(body.message ?? `Không gửi được yêu cầu (${response.status}).`)
}

/** Chỉ lấy thông tin sản phẩm dành cho website khách hàng. */
export async function getProducts(): Promise<Product[]> {
  const response = await fetch('/api/store/products')
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<Product[]>
}

/** Gửi đơn chờ xác nhận; backend tính lại giá và kiểm tra tồn kho. */
export async function createOrder(order: NewOrder): Promise<OrderReceipt> {
  const response = await fetch('/api/store/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<OrderReceipt>
}
