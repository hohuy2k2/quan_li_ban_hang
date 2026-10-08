import { useCallback, useEffect, useState } from 'react'
import { getProducts } from '../api'
import type { Product } from '../types'

/** Nạp danh mục và cho phép tải lại sau khi khách gửi đơn. */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setProducts(await getProducts())
      setError('')
    } catch {
      setError('Chưa tải được sản phẩm. Hãy thử lại sau.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return { products, loading, error, reload }
}
