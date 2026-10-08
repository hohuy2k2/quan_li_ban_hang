
type Props = {
  total: number
  pageSize: number
  page: number
  totalPages: number
  start: number
  end: number
  onPageChange: (page: number) => void
  noun: string
}

/** Điều khiển chuyển trang dùng chung cho các danh sách quản lý. */
export function Pagination({ total, pageSize, page, totalPages, start, end, onPageChange, noun }: Props) {
  return <div className="pagination">
    <span>{total ? `Hiển thị ${start + 1}–${end} / ${total} ${noun}` : `0 ${noun}`}</span>
    {total > pageSize && <nav aria-label={`Chuyển trang ${noun}`}>
      <button type="button" disabled={page === 1} onClick={() => onPageChange(1)}>Đầu</button>
      <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Trước</button>
      <strong>Trang {page}/{totalPages}</strong>
      <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>Tiếp</button>
      <button type="button" disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>Cuối</button>
    </nav>}
  </div>
}