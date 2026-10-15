export interface Product {
  id: number
  code: string
  name: string
  brand: string
  category: string
  unit: string
  purchasePrice: number
  purchasePriceIncludesTax: boolean
  salePrice: number
  imageUrl: string
  specificationsJson: string
  quantity: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'specificationsJson'> & {
  specifications: Record<string, string>
}

export type AuthUser = { id: number; displayName: string; email: string; phone: string; role: 'admin' | 'customer' }
export type Account = AuthUser & { isActive: boolean; createdAt: string }
export type AccountDetails = Pick<Account, 'displayName' | 'email' | 'phone' | 'role' | 'isActive'>

export type PartyKind = 'customer' | 'supplier'
export type PartyInput = { kind: PartyKind; name: string; phone: string; email: string; address: string; note: string }
export type Party = PartyInput & { id: number; createdAt: string; balance: number }
export type CustomerHistory = {
  party: Party
  sales: { id: number; number: string; soldAt: string; total: number; refunded: number; netTotal: number }[]
  totalSpent: number
}
export type DebtPayment = { id: number; debtAccountId: number; amount: number; paidAt: string; note: string }
export type Debt = {
  id: number; partyId: number; partyName: string; partyKind: PartyKind
  sourceType: 'sale' | 'receipt' | 'opening'; sourceId: number | null
  reference: string; principal: number; paid: number; balance: number
  dueDate: string; note: string; createdAt: string; payments: DebtPayment[]
}

export type RevenueRow = { period: string; sales: number; refunds: number; revenue: number; orders: number }
export type RevenueReport = {
  from: string; to: string; sales: number; refunds: number; revenue: number; orders: number
  days: RevenueRow[]; months: RevenueRow[]
}

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
  supplierId?: number | null
  paidAmount?: number | null
  dueDate?: string
}

export interface SaleItem {
  id: number
  productId: number
  productCode: string
  productName: string
  unit: string
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
  paidAtSale: number | null
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
  customerId?: number | null
  paidAmount?: number | null
  dueDate?: string
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
