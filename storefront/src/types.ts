export type Product = {
  id: number
  code: string
  name: string
  brand: string
  category: string
  salePrice: number
  available: boolean
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
