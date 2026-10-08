import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const storageKey = 'inventory-theme'

/** Lưu lựa chọn giao diện trên trình duyệt và đồng bộ giữa các tab. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(storageKey, theme) } catch { /* Không có localStorage. */ }
  }, [theme])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey) setTheme(event.newValue === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return { theme, toggleTheme: () => setTheme(value => value === 'dark' ? 'light' : 'dark') }
}
