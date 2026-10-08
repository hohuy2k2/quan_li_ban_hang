import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { RevenueReport } from '../types'
import { money } from '../utils/format'

type Props = { active: boolean; showToast: (message: string, kind?: 'success' | 'error') => void }

const today = () => new Date().toLocaleDateString('sv-SE')
const daysAgo = (count: number) => {
  const date = new Date()
  date.setDate(date.getDate() - count)
  return date.toLocaleDateString('sv-SE')
}

/** Báo cáo doanh thu ròng theo từng ngày hoặc tháng trong khoảng đã chọn. */
export function RevenuePage({ active, showToast }: Props) {
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(today)
  const [group, setGroup] = useState<'day' | 'month'>('day')
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!active || !from || !to || from > to) return
    let cancelled = false
    setLoading(true)
    void api.revenue(from, to).then(value => { if (!cancelled) setReport(value) })
      .catch(error => { if (!cancelled) showToast(error instanceof Error ? error.message : 'Không tải được doanh thu.', 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active, from, to, showToast])

  const rows = useMemo(() => group === 'day' ? report?.days ?? [] : report?.months ?? [], [report, group])

  return <section className="page-content" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">THỐNG KÊ BÁN HÀNG</div><h1>Doanh thu</h1><p>Tiền bán trừ tiền hoàn trả theo ngày hoặc tháng.</p></div></div>
    <div className="panel revenue-panel">
      <div className="revenue-controls">
        <label>Từ ngày<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
        <div className="revenue-group"><button className={group === 'day' ? 'selected' : ''} onClick={() => setGroup('day')}>Theo ngày</button><button className={group === 'month' ? 'selected' : ''} onClick={() => setGroup('month')}>Theo tháng</button></div>
      </div>
      {loading && <div className="filter-loading">Đang tính doanh thu...</div>}
      {report && <>
        <div className="revenue-summary"><div><span>Doanh thu ròng</span><strong>{money(report.revenue)}</strong></div><div><span>Tiền bán</span><strong>{money(report.sales)}</strong></div><div><span>Tiền hoàn</span><strong>{money(report.refunds)}</strong></div><div><span>Hoá đơn</span><strong>{report.orders}</strong></div></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>{group === 'day' ? 'NGÀY' : 'THÁNG'}</th><th>HOÁ ĐƠN</th><th>TIỀN BÁN</th><th>TIỀN HOÀN</th><th>DOANH THU RÒNG</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.period}><td><strong>{row.period.split('-').reverse().join('/')}</strong></td><td>{row.orders}</td><td>{money(row.sales)}</td><td>{money(row.refunds)}</td><td><strong>{money(row.revenue)}</strong></td></tr>) : <tr><td colSpan={5} className="revenue-empty">Chưa có doanh thu trong khoảng đã chọn.</td></tr>}</tbody></table></div>
      </>}
    </div>
  </section>
}
