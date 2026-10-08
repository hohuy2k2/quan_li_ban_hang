import { useState } from 'react'

type PageState = { key: string; page: number }

// A filter change resets the visible page to 1 without a state-setting effect.
export function usePagination(total: number, pageSize: number, key: string) {
  const [state, setState] = useState<PageState>({ key, page: 1 })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(state.key === key ? state.page : 1, totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(total, start + pageSize)
  const setPage = (next: number) => setState({ key, page: Math.max(1, Math.min(totalPages, next)) })
  return { page, totalPages, start, end, setPage }
}