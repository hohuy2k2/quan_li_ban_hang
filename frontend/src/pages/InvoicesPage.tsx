import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ReceiptText, Search } from 'lucide-react'
import { api } from '../api'
import { InvoiceDetailModal } from '../components/InvoiceDetailModal'
import { InvoiceEditModal } from '../components/InvoiceEditModal'
import { ReturnModal } from '../components/ReturnModal'
import type { Product, ReturnInput, Sale, SaleInput } from '../types'
import { dateTime, money, searchKey } from '../utils/format'

type Props = {
  active: boolean
  sales: Sale[]
  products: Product[]
  onRefresh: () => Promise<void>
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function InvoicesPage({ active, sales, products, onRefresh, showToast }: Props) {
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [datedSales, setDatedSales] = useState<Sale[] | null>(null)
  const [dateLoading, setDateLoading] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [returningSale, setReturningSale] = useState<Sale | null>(null)

  useEffect(() => {
    if (!active || (!fromDate && !toDate)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api.sales({ from: fromDate, to: toDate }).then(result => {
        if (!cancelled) setDatedSales(result)
      }).catch(error => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Không lọc được hoá đơn.', 'error')
      }).finally(() => { if (!cancelled) setDateLoading(false) })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [active, fromDate, toDate, sales, showToast])

  const invoiceMatches = useMemo(() => {
    const term = searchKey(invoiceSearch)
    return (fromDate || toDate ? datedSales ?? [] : sales)
      .filter(sale => searchKey(`${sale.number} ${sale.customerName} ${sale.customerPhone}`).includes(term))
  }, [sales, datedSales, fromDate, toDate, invoiceSearch])

  function changeDate(kind: 'from' | 'to', value: string) {
    setDatedSales(null)
    setDateLoading(Boolean(value || (kind === 'from' ? toDate : fromDate)))
    if (kind === 'from') setFromDate(value)
    else setToDate(value)
  }

  async function saveEdit(input: SaleInput) {
    if (!editingSale) return
    const number = editingSale.number
    await api.updateSale(editingSale.id, input)
    setEditingSale(null)
    showToast('Đã sửa hoá đơn và điều chỉnh tồn kho.')
    await onRefresh()
    setSelectedSale(await api.saleByNumber(number))
  }

  async function saveReturn(input: ReturnInput) {
    if (!returningSale) return
    const number = returningSale.number
    await api.returnItems(returningSale.id, input)
    setReturningSale(null)
    showToast('Đã ghi nhận hàng trả và cập nhật tồn kho.')
    await onRefresh()
    setSelectedSale(await api.saleByNumber(number))
  }

  async function resolveWarranty(itemId: number, outcome: 'returned_to_customer' | 'discard') {
    if (!selectedSale) return
    const number = selectedSale.number
    if (!window.confirm(outcome === 'returned_to_customer' ? 'Xác nhận đã trả hàng bảo hành cho khách?' : 'Xác nhận bỏ món hàng bảo hành này?')) return
    try {
      await api.resolveWarranty(itemId, outcome)
      showToast('Đã cập nhật trạng thái bảo hành.')
      await onRefresh()
      setSelectedSale(await api.saleByNumber(number))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không cập nhật được trạng thái bảo hành.', 'error')
    }
  }

  return (
    <>
      <section className="page-content" style={{ display: active ? undefined : 'none' }}>
        <div className="page-heading"><div><div className="eyebrow">LỊCH SỬ BÁN HÀNG</div><h1>Hoá đơn</h1><p>Tra cứu, chỉnh sửa và ghi nhận hàng khách trả.</p></div><div className="header-count">{invoiceMatches.length} đơn hiển thị</div></div>
        <div className="panel inventory-panel">
          <div className="inventory-toolbar invoice-toolbar">
            <div className="search-field invoice-search"><Search size={18} /><input value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} placeholder="Tìm mã hoá đơn, tên hoặc số điện thoại..." /></div>
            <label>Từ ngày<input type="date" value={fromDate} max={toDate || undefined} onChange={event => changeDate('from', event.target.value)} /></label>
            <label>Đến ngày<input type="date" value={toDate} min={fromDate || undefined} onChange={event => changeDate('to', event.target.value)} /></label>
            {(fromDate || toDate) && <button className="secondary-button" onClick={() => { setFromDate(''); setToDate(''); setDatedSales(null); setDateLoading(false) }}>Xoá lọc</button>}
          </div>
          {dateLoading && <div className="filter-loading">Đang lọc hoá đơn...</div>}
          <div className="table-scroll"><table className="data-table"><thead><tr><th>MÃ HOÁ ĐƠN</th><th>THỜI GIAN</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM</th><th>TỔNG TIỀN</th><th></th></tr></thead><tbody>{invoiceMatches.length ? invoiceMatches.map(sale => <tr key={sale.id}><td><strong className="invoice-number">{sale.number}</strong></td><td>{dateTime(sale.soldAt)}</td><td><div className="stacked-cell">{sale.customerName || 'Khách lẻ'}<small>{sale.customerPhone || '—'}</small></div></td><td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm{(sale.returns?.length ?? 0) > 0 && <small className="returned-badge">Có hàng trả</small>}</td><td><strong>{money(sale.total)}</strong></td><td><button className="view-button" onClick={() => setSelectedSale(sale)}>Xem chi tiết <ArrowRight size={15} /></button></td></tr>) : <tr><td colSpan={6}><div className="table-empty"><ReceiptText size={30} /><strong>Không có hoá đơn phù hợp</strong><span>Thử thay đổi từ khoá hoặc khoảng ngày.</span></div></td></tr>}</tbody></table></div>
        </div>
      </section>
      {selectedSale && <InvoiceDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} onEdit={() => { setEditingSale(selectedSale); setSelectedSale(null) }} onReturn={() => { setReturningSale(selectedSale); setSelectedSale(null) }} onResolveWarranty={(itemId, outcome) => void resolveWarranty(itemId, outcome)} />}
      {editingSale && <InvoiceEditModal sale={editingSale} products={products} onClose={() => setEditingSale(null)} onSave={saveEdit} onError={message => showToast(message, 'error')} />}
      {returningSale && <ReturnModal sale={returningSale} onClose={() => setReturningSale(null)} onSave={saveReturn} onError={message => showToast(message, 'error')} />}
    </>
  )
}
