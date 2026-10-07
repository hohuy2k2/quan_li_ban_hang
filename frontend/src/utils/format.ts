import type { ProductAudit } from '../types'

export const money = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'

export const dateTime = (value: string | Date) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value))

export const searchKey = (value: string) => value.toLocaleLowerCase('vi-VN')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim()

const historyNames: Record<string, string> = {
  Code: 'Mã', Name: 'Tên', Brand: 'Hãng', Category: 'Loại',
  PurchasePrice: 'Giá nhập', PurchasePriceIncludesTax: 'Thuế', SalePrice: 'Giá bán',
  Quantity: 'Số lượng', LowStockThreshold: 'Mức cảnh báo',
}

export function historyDetails(audit: ProductAudit): string[] {
  if (audit.action !== 'updated') return []
  try {
    const data = JSON.parse(audit.changesJson) as { before: Record<string, unknown>; after: Record<string, unknown> }
    return Object.keys(data.after).filter(key => data.before[key] !== data.after[key]).map(key => {
      const display = (value: unknown) => key === 'PurchasePriceIncludesTax'
        ? (value ? 'Có thuế' : 'Chưa thuế')
        : key.includes('Price') ? money(Number(value)) : String(value || '—')
      return `${historyNames[key] ?? key}: ${display(data.before[key])} → ${display(data.after[key])}`
    })
  } catch { return [] }
}
