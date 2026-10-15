import { useId, useMemo, useState } from 'react'
import type { Product } from '../types'
import { searchKey } from '../utils/format'
import './stock-product-picker.css'

type Props = {
  products: Product[]
  value: number
  onChange: (id: number) => void
}

export function StockProductPicker({ products, value, onChange }: Props) {
  const id = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selected = products.find(product => product.id === value)
  const term = searchKey(query ?? '')
  const matches = useMemo(() => term ? products.filter(product =>
    searchKey(product.code + ' ' + product.name).includes(term)
  ) : [], [products, term])
  const results = matches.slice(0, 20)
  const expanded = query !== null

  function choose(product: Product) {
    onChange(product.id)
    setQuery(null)
    setActiveIndex(-1)
  }

  return <div className="stock-product-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setQuery(null)
      setActiveIndex(-1)
    }
  }}>
    <label htmlFor={id}>Sản phẩm</label>
    <input id={id} role="combobox" autoComplete="off"
      aria-expanded={expanded} aria-controls={`${id}-results`} aria-autocomplete="list"
      aria-activedescendant={expanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      required={!selected}
      value={query ?? (selected ? `${selected.code} · ${selected.name}` : '')}
      placeholder="Tìm tên hoặc mã sản phẩm..."
      onFocus={() => { setQuery(''); setActiveIndex(-1) }}
      onChange={event => { setQuery(event.target.value); setActiveIndex(-1) }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setQuery(null)
          setActiveIndex(-1)
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (!expanded) { setQuery(''); return }
          if (!results.length) return
          const next = event.key === 'ArrowDown'
            ? Math.min(activeIndex + 1, results.length - 1)
            : Math.max(activeIndex - 1, 0)
          setActiveIndex(next)
          document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' })
        } else if (event.key === 'Enter' && expanded) {
          event.preventDefault()
          const exact = results.find(product => searchKey(product.code) === term)
          const product = activeIndex >= 0 ? results[activeIndex] : exact ?? (matches.length === 1 ? results[0] : undefined)
          if (product) choose(product)
        }
      }} />
    {expanded && <div className="stock-product-menu">
      <div id={`${id}-results`} role="listbox" aria-label="Sản phẩm phù hợp" className="stock-product-results">
        {results.map((product, index) => <button type="button" role="option"
          id={`${id}-option-${index}`} key={product.id} aria-selected={index === activeIndex}
          className={index === activeIndex ? 'active' : ''}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(product)}>
          <strong>{product.name}</strong><small>{product.code} · Tồn: {product.quantity}</small>
        </button>)}
      </div>
      <p role="status">{!term ? 'Gõ tên hoặc mã để tìm (có thể gõ không dấu).'
        : !matches.length ? 'Không tìm thấy sản phẩm.'
          : matches.length > 20 ? `Hiển thị 20/${matches.length} kết quả. Gõ thêm để thu hẹp.`
            : `${matches.length} kết quả. Chọn sản phẩm để thêm vào dòng.`}</p>
    </div>}
    {selected && <small className="stock-product-selected">Đã chọn: {selected.code} · {selected.name} · Tồn: {selected.quantity}</small>}
  </div>
}
