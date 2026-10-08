import { ArrowRight, Check, ClipboardCheck, Lightbulb, Search, ShieldCheck, Truck, Zap } from 'lucide-react'

/** Giới thiệu ngắn về cửa hàng và cách đặt hàng. */
export function Hero() {
  return <section className="hero">
    <div className="site-container hero-grid">
      <div className="hero-copy">
        <div className="hero-kicker"><span /> ĐỒ ĐIỆN CHO MỌI NHÀ</div>
        <h1>Đủ đồ điện.<br /><em>Dễ chọn, dễ mua.</em></h1>
        <p>Tìm sản phẩm bạn cần, gửi đơn đặt hàng trong vài phút. Cửa hàng sẽ liên hệ để xác nhận số lượng và cách nhận hàng.</p>
        <a className="hero-cta" href="#products">Xem sản phẩm <ArrowRight size={18} /></a>
        <div className="hero-proof">
          <span><Check size={16} /> Giá bán rõ ràng</span>
          <span><Check size={16} /> Xác nhận qua điện thoại</span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="art-card art-card-back"><Lightbulb size={48} /></div>
        <div className="art-card art-card-front"><Zap size={65} strokeWidth={1.5} fill="currentColor" /></div>
        <div className="art-badge">SẴN SÀNG<br /><strong>CHO MỌI CÔNG TRÌNH</strong></div>
      </div>
    </div>
  </section>
}

/** Ba bước mua hàng được hiển thị ngay dưới phần giới thiệu. */
export function Benefits() {
  return <section className="benefits site-container" id="how-it-works">
    <div><span className="benefit-icon"><Search size={24} /></span><strong>Tìm sản phẩm</strong><p>Tra theo tên, mã, hãng hoặc loại.</p></div>
    <div><span className="benefit-icon"><ClipboardCheck size={24} /></span><strong>Gửi đơn đặt hàng</strong><p>Chọn số lượng và cách nhận hàng.</p></div>
    <div><span className="benefit-icon"><Truck size={24} /></span><strong>Cửa hàng xác nhận</strong><p>Chúng tôi gọi lại trước khi giao hoặc hẹn nhận.</p></div>
  </section>
}

/** Lối vào giỏ hàng ở cuối danh mục. */
export function ClosingCallout({ onOpenCart }: { onOpenCart: () => void }) {
  return <section className="closing site-container">
    <div><span><ShieldCheck size={28} /></span><div>
      <h2>Mua sắm đơn giản, rõ ràng</h2>
      <p>Giỏ hàng hiển thị giá dự kiến. Cửa hàng sẽ gọi xác nhận trước khi hoàn tất đơn.</p>
    </div></div>
    <button onClick={onOpenCart}>Xem giỏ hàng <ArrowRight size={18} /></button>
  </section>
}

/** Thông tin cố định ở chân trang. */
export function SiteFooter() {
  return <footer><div className="site-container footer-inner">
    <div className="footer-brand"><Zap size={19} fill="currentColor" /> CỬA HÀNG ĐỒ ĐIỆN</div>
    <span>Đơn đặt hàng được xác nhận qua điện thoại.</span>
  </div></footer>
}
