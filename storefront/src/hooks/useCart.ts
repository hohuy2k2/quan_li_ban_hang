import { useCallback, useMemo, useState } from 'react'
import type { CartItems, CartLine, Product } from '../types'

/** Quản lý số lượng trong giỏ; chỉ sản phẩm còn trong danh mục mới được gửi đơn. */
export function useCart(products: Product[]) {
  const [items, setItems] = useState<CartItems>({})

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
