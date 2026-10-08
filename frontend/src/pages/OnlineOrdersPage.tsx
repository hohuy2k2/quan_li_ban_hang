import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Pagination } from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'
import type { OnlineOrder } from '../types'
import { dateTime, money, searchKey } from '../utils/format'

type Props = {
  active: boolean
  orders: OnlineOrder[]
  onRefresh: () => Promise<void>
  showToast: (message: string, kind?: 'success' | 'error') => void
}

// Đơn website chưa trừ kho; nút xác nhận tạo hoá đơn và trừ kho trong một giao dịch.
export function OnlineOrdersPage({ active, orders, onRefresh, showToast }: Props) {
  const [filter, setFilter] = useState('pending')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    void onRefresh()
    const timer = window.setInterval(() => { void onRefresh() }, 20_000)
    return () => window.clearInterval(timer)
  }, [active, onRefresh])
  const matches = useMemo(() => orders.filter(order =>
    (filter === 'all' || order.status === filter) &&
    searchKey(`${order.number} ${order.customerName} ${order.customerPhone}`).includes(searchKey(query))
  ), [orders, filter, query])
  const pager = usePagination(matches.length, 20, `${filter}:${query}`)

  async function process(order: OnlineOrder, action: 'confirm' | 'cancel') {
    if (!window.confirm(action === 'confirm'
      ? `Xác nhận đơn ${order.number}? Hệ thống sẽ tạo hoá đơn và trừ kho.`
      : `Huỷ đơn ${order.number}?`)) return
    setBusyId(order.id)
    try {
      if (action === 'confirm') await api.confirmOnlineOrder(order.id)
      else await api.cancelOnlineOrder(order.id)
      await onRefresh()
      showToast(action === 'confirm' ? 'Đã tạo hoá đơn và trừ kho.' : 'Đã huỷ đơn online.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không xử lý được đơn.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return <section className="page-content online-orders-page" style={{ display: active ? undefined : 'none' }}>
    <div className="page-heading"><div><div className="eyebrow">WEBSITE BÁN HÀNG</div><h1>Đơn online</h1><p>Đơn chờ chưa giữ hàng. Khi đã chốt bán, hãy tạo hoá đơn và trừ kho.</p></div><div className="header-count">{orders.filter(o => o.status === 'pending').length} đơn chờ</div></div>
    <div className="panel online-orders-panel">
      <div className="online-orders-toolbar">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã đơn, tên hoặc số điện thoại" aria-label="Tìm đơn online" />
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Lọc trạng thái"><option value="pending">Chờ xác nhận</option><option value="confirmed">Đã xác nhận</option><option value="cancelled">Đã huỷ</option><option value="all">Tất cả</option></select>
        <button className="secondary-button" onClick={() => void onRefresh()}>Làm mới</button>
      </div>
      <div className="online-orders-list">
        {matches.length === 0 && <div className="online-orders-empty">Không có đơn phù hợp.</div>}
        {matches.slice(pager.start, pager.end).map(order => <article className="online-order" key={order.id}>
          <div className="online-order-head"><div><strong>{order.number}</strong><span>{dateTime(order.createdAt)} · {order.fulfillment === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao hàng'}</span></div><span className={`online-order-status ${order.status}`}>{order.status === 'pending' ? 'Chờ xác nhận' : order.status === 'confirmed' ? 'Đã xác nhận' : 'Đã huỷ'}</span></div>
          <div className="online-order-grid"><div><small>KHÁCH HÀNG</small><strong>{order.customerName}</strong><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></div><div><small>NHẬN HÀNG</small><span>{order.fulfillment === 'pickup' ? 'Khách đến cửa hàng' : order.address}</span>{order.note && <em>Ghi chú: {order.note}</em>}</div></div>
          <div className="online-order-lines">{order.items.map(item => <div key={item.id}><span>{item.productName} <small>× {item.quantity}</small></span><strong>{money(item.lineTotal)}</strong></div>)}</div>
          <div className="online-order-foot"><strong>Tổng {money(order.total)}</strong>{order.status === 'pending' && <div><button className="secondary-button" disabled={busyId !== null} onClick={() => void process(order, 'cancel')}>Huỷ đơn</button><button className="primary-button" disabled={busyId !== null} onClick={() => void process(order, 'confirm')}>{busyId === order.id ? 'Đang xử lý...' : 'Tạo hoá đơn'}</button></div>}{order.status === 'confirmed' && <span>Hoá đơn #{order.saleId}</span>}</div>
        </article>)}
      </div>
      {matches.length > 20 && <Pagination page={pager.page} totalPages={pager.totalPages} pageSize={20} total={matches.length} start={pager.start} end={pager.end} onPageChange={pager.setPage} noun="đơn" />}
    </div>
  </section>
}
