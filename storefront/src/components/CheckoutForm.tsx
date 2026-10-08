import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { createOrder } from '../api'
import type { CartLine, CheckoutDetails } from '../types'
import { money } from '../utils/format'

type Props = {
  lines: CartLine[]
  total: number
  onSuccess: (number: string) => void
  onError: (message: string) => void
}

const emptyDetails: CheckoutDetails = {
  customerName: '', customerPhone: '', fulfillment: 'pickup', address: '', note: '',
}

/** Thu thông tin khách và gửi đơn; chỉ báo thành công khi backend đã lưu. */
export function CheckoutForm({ lines, total, onSuccess, onError }: Props) {
  const [details, setDetails] = useState<CheckoutDetails>(emptyDetails)
  const [submitting, setSubmitting] = useState(false)

  /** Tạo danh sách mã sản phẩm/số lượng, còn giá được backend tự tính lại. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lines.length || submitting) return
    setSubmitting(true)
    try {
      const result = await createOrder({
        ...details,
        items: lines.map(line => ({ productId: line.product.id, quantity: line.quantity })),
      })
      onSuccess(result.number)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Không đặt được hàng. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="checkout-form" onSubmit={event => void submit(event)}>
    <h3>Thông tin nhận hàng</h3>
    <label>Họ tên <span>*</span>
      <input required minLength={2} maxLength={120} value={details.customerName}
        onChange={event => setDetails({ ...details, customerName: event.target.value })} placeholder="Tên của bạn" />
    </label>
    <label>Số điện thoại <span>*</span>
      <input required type="tel" minLength={9} maxLength={20} value={details.customerPhone}
        onChange={event => setDetails({ ...details, customerPhone: event.target.value })} placeholder="Số để cửa hàng liên hệ" />
    </label>
    <div className="fulfillment">
      <span>Cách nhận hàng</span>
      <label><input type="radio" name="fulfillment" checked={details.fulfillment === 'pickup'}
        onChange={() => setDetails({ ...details, fulfillment: 'pickup' })} /> Nhận tại cửa hàng</label>
      <label><input type="radio" name="fulfillment" checked={details.fulfillment === 'delivery'}
        onChange={() => setDetails({ ...details, fulfillment: 'delivery' })} /> Giao hàng</label>
    </div>
    {details.fulfillment === 'delivery' && <label>Địa chỉ giao hàng <span>*</span>
      <textarea required minLength={10} maxLength={300} value={details.address}
        onChange={event => setDetails({ ...details, address: event.target.value })}
        placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" />
    </label>}
    <label>Ghi chú
      <textarea maxLength={500} value={details.note}
        onChange={event => setDetails({ ...details, note: event.target.value })}
        placeholder="Thông tin thêm (nếu có)" />
    </label>
    <div className="checkout-total"><span>Tạm tính</span><strong>{money(total)}</strong></div>
    <p className="checkout-note">Chưa bao gồm phí giao hàng (nếu có). Cửa hàng sẽ gọi xác nhận tổng tiền trước khi giao.</p>
    <button className="checkout-submit" disabled={submitting}>
      {submitting ? 'Đang gửi đơn...' : 'Gửi đơn đặt hàng'} <ArrowRight size={18} />
    </button>
  </form>
}
