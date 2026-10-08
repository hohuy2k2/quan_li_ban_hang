import { useEffect, useState } from 'react'
import { Boxes, FileClock, Search } from 'lucide-react'
import { api } from '../api'
import { InvoiceDetailModal } from '../components/InvoiceDetailModal'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { ProductAudit, Sale, StockMovement } from '../types'
import { dateTime, historyDetails } from '../utils/format'

type Props = {
  active: boolean
  audits: ProductAudit[]
  movements: StockMovement[]
  showToast: (message: string, kind?: 'success' | 'error') => void
}
type HistoryTab = 'edits' | 'stock'
type EditFilter = '' | 'created' | 'updated' | 'deleted'
type StockFilter = '' | 'in' | 'out'

/** Nhật ký sản phẩm và tồn kho được lọc trước khi chia trang. */
export function HistoryPage({ active, audits, movements, showToast }: Props) {
  const [historyTab, setHistoryTab] = useState<HistoryTab>('edits')
  const [editFilter, setEditFilter] = useState<EditFilter>('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('')
  const [editSearch, setEditSearch] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [searchedAudits, setSearchedAudits] = useState<ProductAudit[] | null>(null)
  const [searchedMovements, setSearchedMovements] = useState<StockMovement[] | null>(null)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  useEffect(() => {
    if (!active || historyTab !== 'edits' || (!editFilter && !editSearch.trim())) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api.history({ action: editFilter, query: editSearch.trim() }).then(result => {
        if (!cancelled) setSearchedAudits(result)
      }).catch(error => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Không tìm được lịch sử.', 'error')
      })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [active, historyTab, editFilter, editSearch, audits, showToast])

  useEffect(() => {
    if (!active || historyTab !== 'stock' || (!stockFilter && !stockSearch.trim())) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api.movements({ direction: stockFilter, query: stockSearch.trim() }).then(result => {
        if (!cancelled) setSearchedMovements(result)
      }).catch(error => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Không tìm được biến động kho.', 'error')
      })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [active, historyTab, stockFilter, stockSearch, movements, showToast])

  const visibleAudits = editFilter || editSearch.trim() ? searchedAudits ?? [] : audits
  const visibleMovements = stockFilter || stockSearch.trim() ? searchedMovements ?? [] : movements
  const auditPager = usePagination(visibleAudits.length, 25, JSON.stringify([editFilter, editSearch]))
  const movementPager = usePagination(visibleMovements.length, 25, JSON.stringify([stockFilter, stockSearch]))

  async function openInvoice(number: string) {
    try {
      setSelectedSale(await api.saleByNumber(number))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không mở được hoá đơn.', 'error')
    }
  }

  return (
    <>
      <section className="page-content" style={{ display: active ? undefined : 'none' }}>
        <div className="page-heading"><div><div className="eyebrow">NHẬT KÝ HỆ THỐNG</div><h1>Lịch sử thay đổi</h1><p>Theo dõi thêm, sửa, xoá sản phẩm và biến động tồn kho.</p></div></div>
        <div className="history-tabs"><button className={historyTab === 'edits' ? 'selected' : ''} onClick={() => setHistoryTab('edits')}>Chỉnh sửa sản phẩm</button><button className={historyTab === 'stock' ? 'selected' : ''} onClick={() => setHistoryTab('stock')}>Biến động tồn kho</button></div>
        {historyTab === 'edits' ? <>
          <div className="history-controls"><div className="search-field"><Search size={18} /><input value={editSearch} onChange={event => { setEditSearch(event.target.value); setSearchedAudits(null) }} placeholder="Tìm tên hoặc mã sản phẩm..." /></div><div className="history-filter-buttons">{([['', 'Tất cả'], ['created', 'Đã thêm'], ['updated', 'Đã sửa'], ['deleted', 'Đã xoá']] as const).map(([value, label]) => <button key={value} className={editFilter === value ? 'selected' : ''} onClick={() => { setEditFilter(value); setSearchedAudits(null) }}>{label}</button>)}</div></div>
          <div className="panel history-panel">{visibleAudits.length ? visibleAudits.slice(auditPager.start, auditPager.end).map(audit => {
            const details = historyDetails(audit)
            return <div className="history-row" key={audit.id}><span className={`history-icon ${audit.action}`}><FileClock size={18} /></span><div className="history-content"><strong>{audit.summary}</strong><span>{audit.productName} <code>{audit.productCode}</code></span>{details.length > 0 && <ul>{details.map(detail => <li key={detail}>{detail}</li>)}</ul>}</div><time>{dateTime(audit.at)}</time></div>
          }) : <div className="table-empty"><FileClock size={30} /><strong>Không có thay đổi phù hợp</strong></div>}</div>
          <Pagination total={visibleAudits.length} pageSize={25} page={auditPager.page} totalPages={auditPager.totalPages} start={auditPager.start} end={auditPager.end} onPageChange={auditPager.setPage} noun="mục lịch sử" />
        </> : <>
          <div className="history-controls"><div className="search-field"><Search size={18} /><input value={stockSearch} onChange={event => { setStockSearch(event.target.value); setSearchedMovements(null) }} placeholder="Tìm mã sản phẩm, lý do hoặc mã hoá đơn..." /></div><div className="history-filter-buttons">{([['', 'Tất cả'], ['in', 'Tăng kho'], ['out', 'Giảm kho']] as const).map(([value, label]) => <button key={value} className={stockFilter === value ? 'selected' : ''} onClick={() => { setStockFilter(value); setSearchedMovements(null) }}>{label}</button>)}</div></div>
          <div className="panel history-panel">{visibleMovements.length ? visibleMovements.slice(movementPager.start, movementPager.end).map(movement => <div className="history-row" key={movement.id}><span className={`history-icon ${movement.change >= 0 ? 'created' : 'deleted'}`}><Boxes size={18} /></span><div className="history-content"><strong>{movement.reason}</strong><span>{movement.productCode}{movement.reference && <> · {movement.reference.startsWith('HD-') ? <button className="history-invoice-link" onClick={() => void openInvoice(movement.reference)}>{movement.reference}</button> : movement.reference}</>}</span></div><b className={movement.change >= 0 ? 'positive-change' : 'negative-change'}>{movement.change > 0 ? '+' : ''}{movement.change}</b><time>{dateTime(movement.at)}</time></div>) : <div className="table-empty"><Boxes size={30} /><strong>Không có biến động kho phù hợp</strong></div>}</div>
          <Pagination total={visibleMovements.length} pageSize={25} page={movementPager.page} totalPages={movementPager.totalPages} start={movementPager.start} end={movementPager.end} onPageChange={movementPager.setPage} noun="biến động kho" />
        </>}
      </section>
      {selectedSale && <InvoiceDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </>
  )
}
