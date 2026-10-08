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

export type StockDocumentKind = 'receipt' | 'count'
export interface StockDocumentLine {
  id: number
  productId: number
  productCode: string
  productName: string
  quantityBefore: number
  quantityChange: number
  quantityAfter: number
  purchasePrice: number | null
  purchasePriceIncludesTax: boolean | null
}
export interface StockDocument {
  id: number
  number: string
  kind: StockDocumentKind
  documentDate: string
  supplier: string
  reason: string
  createdAt: string
  lines: StockDocumentLine[]
}
export interface StockDocumentInput {
  kind: StockDocumentKind
  documentDate: string
  supplier: string
  reason: string
  items: { productId: number; quantity: number; purchasePrice: number | null; purchasePriceIncludesTax: boolean | null }[]
}

export interface SaleItem {
  id: number
  productId: number
  productCode: string
  productName: string
  unitPrice: number
  discountPerUnit: number
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
  isDeleted: boolean
  deletedAt: string | null
  items: SaleItem[]
  returns: SaleReturn[]
}

export interface OnlineOrderItem {
  id: number
  productId: number
  productCode: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OnlineOrder {
  id: number
  number: string
  customerName: string
  customerPhone: string
  fulfillment: 'pickup' | 'delivery'
  address: string
  note: string
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: string
  processedAt: string | null
  saleId: number | null
  total: number
  items: OnlineOrderItem[]
}

export type ReturnDisposition = 'restock' | 'warranty' | 'discard'

export interface SaleReturnItem {
  id: number
  saleReturnId: number
  saleItemId: number
  productId: number
  productCode: string
  productName: string
  unitPrice: number
  quantity: number
  disposition: ReturnDisposition
  refundAmount: number
  warrantyResolution: '' | 'returned_to_customer' | 'discard'
  warrantyResolvedAt: string | null
}

export interface SaleReturn {
  id: number
  saleId: number
  number: string
  reason: string
  returnedAt: string
  totalRefund: number
  items: SaleReturnItem[]
}

export interface SaleInput {
  customerName: string
  customerPhone: string
  items: { productId: number; quantity: number; discountPerUnit: number }[]
}

export interface ReturnInput {
  reason: string
  items: { saleItemId: number; quantity: number; disposition: ReturnDisposition; refund: boolean }[]
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

export type WarrantyStatus = 'received' | 'sent' | 'ready' | 'returned_to_customer' | 'restocked' | 'discarded'

export interface WarrantyEvent {
  id: number
  warrantyCaseId: number
  status: WarrantyStatus
  note: string
  at: string
}

export interface WarrantyUnit {
  id: number
  warrantyCaseId: number
  serialNumber: string
  warrantyExpiresOn: string
}

export interface WarrantyCase {
  id: number
  number: string
  source: 'customer' | 'internal'
  saleNumber: string
  saleReturnItemId: number | null
  productId: number
  productCode: string
  productName: string
  quantity: number
  customerName: string
  customerPhone: string
  issue: string
  partner: string
  expectedReturnOn: string
  status: WarrantyStatus
  createdAt: string
  updatedAt: string
  completedAt: string | null
  events: WarrantyEvent[]
  units: WarrantyUnit[]
}
