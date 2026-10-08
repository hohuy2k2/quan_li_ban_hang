# Test case kiểm thử thủ công

Tài liệu này dành cho bạn tự kiểm thử các chức năng đăng nhập, sản phẩm, doanh thu và website bán hàng. Đánh dấu ô vuông sau mỗi trường hợp đã chạy.

## Chuẩn bị

1. Dừng backend cũ, cập nhật bản chạy theo [README.md](README.md), rồi tạo tài khoản admin bằng `dotnet run --project backend -- --create-admin` nếu chưa có.
2. Mở trang quản lý và `/store/` ở hai cửa sổ trình duyệt. Dùng thêm cửa sổ ẩn danh để thử tài khoản khách khác.
3. Tạo hai sản phẩm thử có **giá bán** và **số lượng** dễ đối chiếu. Ví dụ: bóng đèn A giá 80.000 ₫, quạt B giá 150.000 ₫. Sản phẩm mới có tồn 0; dùng **Nhập kho / kiểm kê** để nhập ít nhất 3 món mỗi loại.
4. Ghi lại mã sản phẩm, số lượng tồn ban đầu và ngày kiểm thử. Nên dùng dữ liệu thử để các thao tác tạo đơn, hoàn tiền và sao lưu không lẫn với dữ liệu kinh doanh.

## Tài khoản và quyền truy cập

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| A00 | Với DB đang dùng, dừng backend; mở PowerShell trong thư mục `backend` và chạy `dotnet run -- --create-admin`. Nhập email cùng mật khẩu hai lần, rồi chạy lại ứng dụng. | Lệnh hiện lời nhắc tạo admin, không còn lỗi `FormatException`; sản phẩm và hoá đơn cũ vẫn còn sau khi đăng nhập. Có thể chạy lại lệnh để đổi mật khẩu mà không lỗi nâng cấp DB. | ☐ |
| A00b | Khi backend đang chạy, mở `http://127.0.0.1:5000/api/health` và `http://127.0.0.1:5000/api/auth/csrf` trong trình duyệt, rồi đăng nhập admin. | Health trả JSON có `apiVersion: 2`, CSRF trả JSON có `token`; không có trang `<!doctype` hoặc lỗi `Unexpected token '<'`. | ☐ |
| A01 | Mở trang quản lý khi chưa đăng nhập. | Thấy màn hình **Đăng nhập quản lý**; không thấy kho, hoá đơn và báo cáo. | ☐ |
| A02 | Đăng nhập bằng email admin và mật khẩu sai, sau đó nhập đúng. | Mật khẩu sai có thông báo; mật khẩu đúng mở được trang quản lý. | ☐ |
| A03 | Đăng xuất admin, tải lại trang. | Quay về màn hình đăng nhập; dữ liệu quản lý không hiện ra. | ☐ |
| A04 | Trên `/store/`, đăng ký bằng email khách và mật khẩu đúng 8 ký tự; đăng xuất rồi đăng nhập lại. | Tài khoản được tạo; sau khi đăng nhập lại, nút đầu trang hiển thị **Đơn của tôi**. | ☐ |
| A05 | Dùng tài khoản khách mở trang quản lý. | Không vào được phần quản lý. | ☐ |
| A06 | Đăng ký lại bằng email khách đã dùng hoặc đăng nhập sai mật khẩu. | Hiện thông báo lỗi; không tạo tài khoản trùng hoặc đăng nhập sai. | ☐ |
| A07 | Đăng ký khách trên `/store/`, mở **Tài khoản** ở trang quản lý và tải lại danh sách. | Danh sách có tài khoản khách vừa tạo, đúng email và quyền **Khách hàng**; nếu API lỗi thì trang giữ thông báo cùng nút **Thử tải lại**. | ☐ |
| A08 | Ở website, đăng nhập bằng email chưa đăng ký, sau đó dùng email đã đăng ký với mật khẩu sai và thử tài khoản bị khóa. | Lần lượt hiện thông báo chưa có tài khoản, sai mật khẩu và tài khoản bị khóa. | ☐ |
| A09 | Điền Gmail và mật khẩu ứng dụng trong `backend/mailsettings.local.json`, khởi động lại backend, bấm **Quên mật khẩu**, nhập email khách đã đăng ký và kiểm tra hộp thư. | Nhận mã 6 chữ số; nhập mã cùng mật khẩu mới từ 8 ký tự thì đăng nhập bằng mật khẩu mới được, mật khẩu cũ không dùng được. | ☐ |
| A10 | Thử mã sai 5 lần, mã hết hạn sau 10 phút, dùng lại mã đã đổi mật khẩu, hoặc yêu cầu gửi lại trong vòng 1 phút. | Không đặt lại được bằng mã sai/hết hạn/đã dùng; không gửi thêm email trong 1 phút. | ☐ |
| A11 | Yêu cầu khôi phục cho email chưa đăng ký, sau đó thử khi chưa cấu hình SMTP. | Email chưa đăng ký nhận phản hồi chung và không bị lộ sự tồn tại tài khoản; thiếu SMTP hiện thông báo cần liên hệ cửa hàng. | ☐ |

## Sản phẩm, ảnh và thông số

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| P01 | Tạo bóng đèn A, chọn ảnh PNG/JPEG/WebP dưới 3 MB, thêm thông số `Công suất = 12 W`, rồi lưu. | Sản phẩm được lưu; ảnh và thông số xuất hiện trên `/store/`; bảng sản phẩm quản lý không hiển thị ảnh. | ☐ |
| P02 | Mở sửa sản phẩm A, đổi ảnh và sửa thông số thành `Công suất = 15 W`; thêm `Điện áp = 220 V`. | Website hiển thị ảnh và hai thông số mới sau khi tải lại; giá nhập không xuất hiện ở website. | ☐ |
| P03 | Tạo hoặc sửa quạt B với thông số `Kích thước = 30 × 30 cm`. | Chi tiết quạt hiển thị thông số riêng của quạt; không tự có thông số `Công suất` của bóng đèn. | ☐ |
| P04 | Nhập hai thông số trùng tên hoặc một dòng chỉ có tên mà thiếu giá trị, rồi lưu. | Hiện thông báo hợp lệ; dữ liệu không bị lưu sai. | ☐ |
| P05 | Chọn ảnh lớn hơn 3 MB để lưu sản phẩm. | Hệ thống từ chối ảnh và báo giới hạn dung lượng. | ☐ |
| P06 | Bấm ảnh, tên và vùng thẻ sản phẩm trên website; đóng hộp thoại. | Hộp thoại hiện đúng ảnh, tên, mã, hãng, loại, giá, trạng thái hàng và thông số; đóng được bằng nút **X** hoặc bấm nền ngoài. | ☐ |
| P07 | Xem sản phẩm chưa có ảnh hoặc hết hàng. | Sản phẩm vẫn hiển thị được; nút mua của hàng hết tạm không cho đặt. | ☐ |

## Giỏ hàng, mua ngay và lịch sử đơn

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| O01 | Khi chưa đăng nhập, thêm A vào giỏ và mở giỏ. | Thấy lời nhắc **Đăng nhập để đặt hàng**; có thể mở hộp thoại đăng nhập/đăng ký. | ☐ |
| O02 | Sau khi đăng nhập, thêm A vào giỏ; bấm **Mua ngay** ở B. | Khung **Mua ngay** chỉ có B. Đóng khung rồi mở **Giỏ hàng**: A vẫn còn trong giỏ. | ☐ |
| O03 | Bấm **Mua ngay** ở A, nhập thông tin nhận hàng hợp lệ và gửi. | Có mã đơn `OD-...`; chỉ A nằm trong đơn đó. Nút **Xem đơn hàng** mở lịch sử. | ☐ |
| O04 | Mở **Đơn của tôi** sau khi đặt hàng, rồi tải lại website và đăng nhập lại. | Đơn vẫn xuất hiện với mã, thời gian, từng món, tổng tiền và trạng thái **Chờ xác nhận**. | ☐ |
| O05 | Dùng tài khoản khách khác xem **Đơn của tôi**. | Không nhìn thấy đơn của tài khoản khách thứ nhất. | ☐ |
| O06 | Thử nhập địa chỉ giao hàng quá ngắn khi chọn **Giao hàng**, hoặc số điện thoại không hợp lệ. | Biểu mẫu/API không nhận đơn; thông tin cần sửa được báo rõ. | ☐ |

## Đơn online và doanh thu

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| R01 | Giữ trang quản lý đang mở, đặt một đơn từ cửa sổ khách khác. Không tải lại trang quản lý. | Số đơn chờ ở mục **Đơn online** tự cập nhật; mở mục này thấy đơn mới. | ☐ |
| R02 | Xác nhận đơn online vừa đặt. | Đơn chuyển sang **Đã xác nhận**, hoá đơn được tạo, tồn kho giảm đúng số lượng. Khách mở lại **Đơn của tôi** thấy trạng thái mới. | ☐ |
| R03 | Tạo một đơn khác rồi huỷ khi còn chờ. | Đơn chuyển sang **Đã huỷ**; không tạo hoá đơn và không trừ kho. | ☐ |
| R04 | Tạo một hoá đơn 80.000 ₫ trong ngày, mở **Doanh thu** và chọn đúng ngày đó. | Tiền bán tăng 80.000 ₫, số hoá đơn tăng 1 và doanh thu ròng tăng 80.000 ₫. | ☐ |
| R05 | Hoàn 1 món của hoá đơn thử theo luồng trả hàng có hoàn tiền. | Trong ngày hoàn, **Tiền hoàn** tăng đúng số đã hoàn; **Doanh thu ròng = Tiền bán − Tiền hoàn**. | ☐ |
| R06 | Đổi khoảng ngày, chuyển **Theo ngày** và **Theo tháng**. | Chỉ tính giao dịch trong khoảng đã chọn; tổng tiền khớp giữa hai cách nhóm. | ☐ |

## Sao lưu và hiển thị

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| B01 | Sau khi thêm ảnh sản phẩm, bấm **Sao lưu dữ liệu và ảnh** tại trang quản lý, mở file ZIP vừa tải. | ZIP chứa `inventory.db` và thư mục `product-images` có ảnh đã tải lên. | ☐ |
| B02 | Mở `/store/` trên máy tính và màn hình điện thoại hoặc chế độ màn hình hẹp. | Logo, nút tài khoản, giỏ hàng, thẻ sản phẩm và hộp thoại chi tiết không chồng lấn; có thể cuộn và thao tác. | ☐ |
| B03 | Cuộn xuống cuối website. | Footer hiển thị copyright với năm hiện tại. | ☐ |

## Chức năng mới: giỏ hàng, tài khoản và giao diện

| ID | Các bước | Kết quả mong đợi | Đã thử |
| --- | --- | --- | --- |
| C01 | Thêm A và B vào giỏ trên `/store/`, đổi số lượng A thành 2, rồi tải lại trang. | Giỏ vẫn có A × 2 và B × 1; tổng tiền tính theo giá sản phẩm hiện tại. | ☐ |
| C02 | Bấm **Mua ngay** ở một sản phẩm khác, đóng khung mua nhanh rồi mở giỏ thường; tải lại trang. | Giỏ thường vẫn còn A và B; sản phẩm mua nhanh không tự thêm vào giỏ thường. | ☐ |
| C03 | Đặt hàng thành công bằng giỏ thường rồi tải lại trang. | Giỏ thường trống; lịch sử đơn của khách vẫn còn. | ☐ |
| C04 | Thêm một sản phẩm vào giỏ, sửa giá bán của sản phẩm đó ở trang quản lý rồi tải lại website. | Giỏ còn sản phẩm và số lượng; giá/tổng tiền dùng giá mới. | ☐ |
| C05 | Trong trình duyệt khác hoặc chế độ ẩn danh, mở website. | Không tự thấy giỏ hàng lưu ở trình duyệt thứ nhất. | ☐ |
| C06 | Xóa mềm một sản phẩm đang nằm trong giỏ, rồi tải lại website. | Sản phẩm đã xóa không được đưa vào đơn hàng; giỏ vẫn dùng được với các món còn bán. | ☐ |
| U01 | Admin vào **Tài khoản**, đổi tên/email/số điện thoại của mình, tải lại trang, đăng xuất rồi đăng nhập bằng email mới. | Hồ sơ mới hiển thị và email mới đăng nhập được. | ☐ |
| U02 | Admin đổi mật khẩu bằng mật khẩu hiện tại và mật khẩu mới đúng 8 ký tự, đăng xuất rồi đăng nhập lại. Thử thêm trường hợp mật khẩu hiện tại sai và mật khẩu mới 7 ký tự. | Mật khẩu mới đăng nhập được; mật khẩu cũ và hai trường hợp sai bị từ chối. | ☐ |
| U03 | Admin tạo một tài khoản khách và một tài khoản quản trị mới, rồi tìm theo tên/email. | Hai tài khoản xuất hiện đúng quyền, không hiện mật khẩu trong danh sách. | ☐ |
| U04 | Admin đổi quyền một tài khoản, khóa rồi mở khóa; thử đăng nhập khi đang khóa. | Quyền mới áp dụng; tài khoản khóa không đăng nhập được, tài khoản mở khóa đăng nhập được. | ☐ |
| U05 | Admin đặt lại mật khẩu cho tài khoản khác; thử đăng nhập bằng mật khẩu mới và mật khẩu cũ. | Chỉ mật khẩu mới đăng nhập được; lịch sử đơn của tài khoản khách không mất. | ☐ |
| U06 | Admin thử sửa quyền/khóa chính tài khoản mình trong danh sách. | Giao diện hướng dùng **Hồ sơ của tôi**; không tự khóa mất tài khoản admin hiện tại. | ☐ |
| U07 | Sau khi nâng cấp DB đang có tài khoản admin và khách, đăng nhập lại từng tài khoản. | Tài khoản cũ vẫn hoạt động; danh sách tài khoản có trạng thái **Hoạt động**. | ☐ |
| T01 | Bấm nút mặt trăng trên trang quản lý và website, tải lại mỗi trang rồi bấm mặt trời. | Cả hai trang chuyển tối/sáng; lựa chọn được nhớ sau tải lại. | ☐ |
| T02 | Ở chế độ tối, mở đăng nhập, danh sách, biểu mẫu, chi tiết sản phẩm và giỏ hàng trên màn hình hẹp. | Chữ và ô nhập đọc được, nút thao tác không bị che hoặc chồng lấn. | ☐ |
| T03 | Trên `/store/`, thêm sản phẩm vào giỏ rồi kiểm tra thông báo trên máy tính và điện thoại; bấm nút đóng thông báo. | Thông báo xuất hiện ở chính giữa phía trên màn hình, đọc được toàn bộ nội dung và đóng được. | ☐ |

Nếu một trường hợp lỗi, hãy ghi lại **ID**, bước đang làm, kết quả thực tế và ảnh chụp màn hình. Tôi sẽ sửa theo trường hợp đó.
