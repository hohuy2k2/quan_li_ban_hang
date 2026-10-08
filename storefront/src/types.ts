export type Product = {
  id: number
  code: string
  name: string
  brand: string
  category: string
  salePrice: number
  imageUrl: string
  specifications: Record<string, string>
  available: boolean
}

export type AuthUser = { id: number; displayName: string; email: string; phone: string; role: 'admin' | 'customer' }

export type StoreOrderItem = {
  id: number; productCode: string; productName: string; unitPrice: number
  quantity: number; lineTotal: number
}
export type StoreOrder = {
  id: number; number: string; fulfillment: 'pickup' | 'delivery'; address: string
  note: string; status: 'pending' | 'confirmed' | 'cancelled'; createdAt: string
  total: number; items: StoreOrderItem[]
}

export type CartLine = { product: Product; quantity: number }
export type CartItems = Record<number, number>

export type CheckoutDetails = {
  customerName: string
  customerPhone: string
  fulfillment: 'pickup' | 'delivery'
  address: string
  note: string
}

export type NewOrder = CheckoutDetails & {
  items: { productId: number; quantity: number }[]
}

export type OrderReceipt = { number: string; total: number }
