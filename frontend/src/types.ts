export interface Product {
  id: number
  code: string
  name: string
  brand: string
  category: string
  purchasePrice: number
  purchasePriceIncludesTax: boolean
  salePrice: number
  quantity: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

export interface SaleItem {
  id: number
  productId: number
  productCode: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface Sale {
  id: number
  number: string
  customerName: string
  customerPhone: string
  soldAt: string
  total: number
  items: SaleItem[]
}

export interface ProductAudit {
  id: number
  productId: number
  productCode: string
  productName: string
  action: string
  summary: string
  changesJson: string
  at: string
}

export interface StockMovement {
  id: number
  productId: number
  productCode: string
  change: number
  reason: string
  reference: string
  at: string
}

export interface Summary {
  productCount: number
  stockUnits: number
  lowStockCount: number
  salesToday: number
  revenueToday: number
}
