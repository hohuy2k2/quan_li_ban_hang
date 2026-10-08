import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CartItems, CartLine, Product } from '../types'

const storageKey = 'inventory-store-cart-v1'

/** Chỉ khôi phục mã sản phẩm và số lượng hợp lệ; giá luôn lấy lại từ danh mục mới. */
function loadCart(): CartItems {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown>
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    const valid: CartItems = {}
    for (const [id, quantity] of Object.entries(stored)) {
      if (Number.isSafeInteger(Number(id)) && Number(id) > 0 &&
        typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
        valid[Number(id)] = quantity
        if (Object.keys(valid).length === 50) break
      }
    }
    return valid
  } catch { return {} }
}

/** Quản lý số lượng trong giỏ; chỉ sản phẩm còn trong danh mục mới được gửi đơn. */
export function useCart(products: Product[]) {
  const [items, setItems] = useState<CartItems>(loadCart)

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(items)) }
    catch { /* Trình duyệt chặn lưu trữ: giỏ vẫn dùng được cho phiên hiện tại. */ }
  }, [items])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === storageKey) setItems(loadCart()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const lines = useMemo<CartLine[]>(() => products
    .filter(product => (items[product.id] ?? 0) > 0)
    .map(product => ({ product, quantity: items[product.id] })), [products, items])
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0)

  /** Tăng, giảm hoặc bỏ sản phẩm; mỗi dòng tối đa 99 món. */
  const setQuantity = useCallback((productId: number, quantity: number) => {
    setItems(previous => {
      const next = { ...previous }
      if (quantity < 1) delete next[productId]
      else next[productId] = Math.min(quantity, 99)
      return next
    })
  }, [])

  /** Dùng cập nhật theo trạng thái mới nhất khi khách bấm thêm liên tiếp. */
  const add = useCallback((productId: number) => {
    setItems(previous => ({ ...previous, [productId]: Math.min((previous[productId] ?? 0) + 1, 99) }))
  }, [])

  /** Xoá giỏ sau khi backend nhận đơn thành công. */
  const clear = useCallback(() => setItems({}), [])

  return { lines, count, total, setQuantity, add, clear }
}
