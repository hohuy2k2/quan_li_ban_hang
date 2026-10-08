import { X } from 'lucide-react'

/** Thông báo ngắn khi thêm giỏ hoặc gặp lỗi đặt hàng. */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null
  return <div className="site-toast" role="status">
    {message}<button onClick={onClose} aria-label="Đóng"><X size={15} /></button>
  </div>
}
