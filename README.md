# Phần mềm quản lý bán hàng và tồn kho

Ứng dụng chạy cục bộ trên một máy Windows. Giao diện dùng React + TypeScript; API dùng ASP.NET Core; dữ liệu lưu trong SQLite. Bán hàng tại quầy không cần Internet; gửi mã khôi phục qua email cần kết nối đến máy chủ SMTP.

## Chức năng hiện có

- Website khách hàng ở `/store/`: xem danh mục, ảnh và thông số từng sản phẩm, mua ngay hoặc thêm giỏ. Khách đăng ký/đăng nhập trước khi đặt hàng và xem lịch sử/trạng thái đơn trong **Đơn của tôi**. Mục **Đơn online** trong phần quản lý nhận thông báo tự động, cho phép xác nhận (tạo hoá đơn, trừ kho) hoặc huỷ đơn. Khi khách mới gửi đơn, tồn kho chưa bị trừ. Chưa có thanh toán online hoặc tính phí vận chuyển.
- Trang quản lý yêu cầu tài khoản admin. Sản phẩm có ảnh riêng cho website và các thông số tuỳ chọn như công suất, kích thước; ảnh không hiển thị trong bảng quản lý. Trang **Doanh thu** thống kê theo ngày, tháng và khoảng thời gian chọn, trừ tiền hoàn hàng theo ngày hoàn.
- Trang **Tài khoản** cho admin sửa hồ sơ, đổi mật khẩu, tạo tài khoản, sửa quyền, khóa/mở khóa và đặt lại mật khẩu cho người khác. Khóa tài khoản giữ nguyên lịch sử đơn hàng. Mật khẩu mới cần ít nhất 8 ký tự.
- Website báo riêng email chưa đăng ký, sai mật khẩu và tài khoản bị khóa khi đăng nhập. Khách có thể chọn **Quên mật khẩu** để nhận mã qua email đã đăng ký rồi đặt mật khẩu mới.
- Giỏ hàng website lưu mã sản phẩm và số lượng trên trình duyệt; tải lại trang vẫn còn giỏ, còn giá bán được lấy lại từ dữ liệu hiện tại. Nút mặt trăng/mặt trời chuyển sáng/tối và ghi nhớ lựa chọn trên trình duyệt.

- Thêm, xem, sửa, xoá mềm sản phẩm; lưu mã, tên, hãng, loại, giá nhập, trạng thái thuế của giá nhập, giá bán và số lượng.
- Danh sách sắp xếp theo tên; tìm theo tên, mã, hãng, loại (tìm không dấu); lọc theo hãng và loại.
- Nhật ký thêm/sửa/xoá sản phẩm và biến động số lượng.
- Trang **Nhập kho / kiểm kê** tạo phiếu nhiều sản phẩm, có ngày phiếu, nhà cung cấp, lý do, số lượng và giá nhập theo từng dòng. Phiếu kiểm kê nhập số lượng đếm thực tế; hệ thống lưu tồn trước/sau và biến động trong cùng giao dịch. Sản phẩm mới có tồn 0; muốn thay đổi tồn hãy lập phiếu thay vì sửa số lượng trong form sản phẩm.

- In tem 35 × 22 mm hoặc 50 × 30 mm gồm tên, giá bán và mã vạch Code 128.
- Bán hàng bằng mã quét hoặc tìm thủ công. Sau khi quét xong, sản phẩm tự vào đơn mà không cần Enter; quét lại cùng mã tăng số lượng.
- Giảm giá bằng số tiền trên mỗi món trong giỏ hàng; hóa đơn lưu giá gốc, mức giảm và thành tiền. Khi trả hàng, tiền hoàn dựa trên giá đã trả sau giảm.
- Nhập tên, số điện thoại khách và xem thời gian, tổng tiền ở bên phải. Thanh toán lưu hoá đơn và trừ kho trong cùng giao dịch.
- Lọc hoá đơn theo ngày hoặc khoảng ngày; sửa hoá đơn trước khi có hàng trả. Chênh lệch số lượng khi sửa sẽ tự điều chỉnh tồn kho.
- Danh sách sản phẩm, hoá đơn, lịch sử và bảo hành được chia trang sau khi tìm kiếm/lọc (20 mục/trang, lịch sử 25 mục/trang).
- Có thể xoá hoá đơn chưa có hàng trả: hóa đơn được ẩn khỏi danh sách và doanh thu, hàng đã bán được cộng lại kho. Dấu vết hóa đơn và biến động kho vẫn giữ để đối chiếu. Hoá đơn đã có hàng trả/bảo hành không được xoá.
- Trả một phần hoặc toàn bộ hàng theo hoá đơn: hàng khách không còn nhu cầu sử dụng được nhập lại kho và hoàn tiền; hàng lỗi có thể đi bảo hành hoặc bỏ đi, không hoàn tiền và không tăng tồn kho. Có thể đánh dấu hàng bảo hành đã trả lại khách hoặc bỏ đi.
- Trang **Bảo hành** tập hợp hàng khách trả đi bảo hành, hàng khách gửi trực tiếp và hàng lỗi tách từ kho. Có thể ghi nhận nơi bảo hành, ghi chú, các bước đã gửi/đã sửa xong, rồi trả khách, nhập lại kho hoặc bỏ đi theo nguồn hàng. Mỗi lần đổi trạng thái được lưu trong lịch sử phiếu. Phiếu khách gửi trực tiếp chỉ lưu mã hóa đơn tham khảo, không tự ghi nhận trả hàng trong hóa đơn.
- Phiếu bảo hành lưu serial/IMEI và hạn bảo hành riêng cho từng món; nơi bảo hành và ngày hẹn trả được lưu theo phiếu. Có thể cập nhật thông tin này cho cả phiếu cũ; lịch sử phiếu ghi nhận lần cập nhật.

- Lọc và tìm lịch sử sản phẩm, biến động kho; nhấn mã hoá đơn trong lịch sử kho để xem chi tiết. Tải bản sao lưu ZIP gồm cơ sở dữ liệu và ảnh sản phẩm.

Mục **Có thuế / Chưa thuế** hiện chỉ ghi lại trạng thái của **giá nhập**. Ứng dụng chưa tự tính thuế vì chưa có thuế suất và quy tắc tính được xác định.

Khi đã ghi nhận hàng trả, hoá đơn được giữ nguyên để đối chiếu và không thể sửa nữa. Hàng bảo hành vẫn thuộc khách hàng nên không được cộng vào tồn kho bán được. Doanh thu hôm nay là tiền bán hôm nay trừ tiền hoàn trả hôm nay.

## Cấu trúc giao diện

- `frontend/src/App.tsx`: khung ứng dụng, điều hướng và tải dữ liệu chung.
- `frontend/src/pages/`: các màn hình bán hàng, sản phẩm, phiếu kho, hoá đơn, đơn online, doanh thu, bảo hành và lịch sử. Mỗi màn hình giữ trạng thái của chức năng mình.
- `frontend/src/components/`: biểu mẫu sản phẩm, hộp thoại in tem, chi tiết hoá đơn và bộ điều khiển phân trang dùng chung (`Pagination.tsx`).
- `frontend/src/utils/format.ts`: định dạng tiền, ngày giờ, tìm kiếm và nội dung lịch sử.
- `frontend/src/hooks/usePagination.ts`: tính trang hiện tại và tự quay về trang 1 khi bộ lọc thay đổi.
- `frontend/src/api.ts` và `frontend/src/types.ts`: gọi backend và khai báo kiểu dữ liệu.
- `storefront/`: website React riêng cho khách hàng. `src/App.tsx` ghép các phần và giữ trạng thái dùng chung; `src/components/` chứa đầu trang, danh mục, chi tiết sản phẩm, giỏ hàng, tài khoản và biểu mẫu đặt hàng; `src/hooks/` quản lý sản phẩm và giỏ hàng; `src/api.ts` gọi backend; `src/types.ts` khai báo dữ liệu. API `/api/store/products` chỉ xuất thông tin bán hàng, không xuất giá nhập hoặc số tồn chính xác.

## Cài công cụ và thư viện (bạn tự chạy)

Cài **Node.js** và **.NET SDK 10** trên máy lập trình. Sau đó mở PowerShell tại thư mục dự án:

```powershell
cd frontend
npm.cmd install
cd ..
cd storefront
npm.cmd install
cd ..
dotnet restore backend\backend.csproj
```

`npm install` cài các thư viện được khai báo trong `frontend/package.json`. `dotnet restore` tải gói SQLite và MailKit cho backend. Mã nguồn không tự cài thư viện lúc chạy ứng dụng bán hàng.

## Cấu hình email khôi phục mật khẩu

Mở `backend/mailsettings.local.json` trong VS Code và điền hai mục `User` (địa chỉ Gmail dùng để gửi thư) và `Password` (mật khẩu **ứng dụng gồm 16 ký tự** của Gmail). Máy chủ `smtp.gmail.com` và cổng 587 đã được điền sẵn. Email gửi đi sẽ dùng địa chỉ trong `User`; email nhận là địa chỉ khách đã đăng ký. Sau khi sửa tệp, khởi động lại backend. Không cần đặt biến môi trường trong PowerShell.

Google yêu cầu bật xác minh 2 bước trước khi tạo [mật khẩu ứng dụng](https://support.google.com/accounts/answer/185833). Đây là mật khẩu dành cho ứng dụng, không phải mật khẩu đăng nhập Gmail thông thường. Nếu không thấy mục tạo mật khẩu ứng dụng, xem các trường hợp Google liệt kê ở trang hướng dẫn đó. `mailsettings.local.json` được Git bỏ qua để mật khẩu không được thêm vào commit; `mailsettings.example.json` là mẫu không chứa mật khẩu. Khi đóng gói bằng `scripts/Build-Release.ps1`, tệp cấu hình cục bộ được sao chép vào thư mục `release`.

Khi chưa điền tài khoản gửi hoặc mật khẩu ứng dụng, website báo rõ chưa thể gửi mã. Mã gồm 6 chữ số, hết hạn sau 10 phút, tối đa 5 lần nhập sai và chỉ dùng một lần. Yêu cầu mã mới chỉ được gửi lại sau ít nhất 1 phút. Mật khẩu tài khoản khách sau khi đặt lại sẽ làm phiên đăng nhập cũ hết hiệu lực.

## Tạo tài khoản quản trị

Sau khi cập nhật mã, dừng backend cũ rồi chạy lệnh sau **một lần trên máy chủ** tại thư mục dự án:

```powershell
dotnet run --project backend -- --create-admin
```

Nếu chạy từ bản `release` đã đóng gói, dùng `.\release\backend.exe --create-admin` sau khi chạy `.\scripts\Build-Release.ps1`.

Nhập email và mật khẩu tối thiểu 8 ký tự theo lời nhắc. Lệnh này cũng dùng để đặt lại mật khẩu admin cùng email; các phiên cũ sẽ hết hiệu lực. Không có tài khoản hay mật khẩu mặc định. Sau đó chạy backend như bình thường và đăng nhập trên trang quản lý. Tài khoản khách được đăng ký ở website; khách không vào được API quản trị.

## Chạy khi lập trình

Mở hai cửa sổ PowerShell tại thư mục dự án:

```powershell
dotnet run --project backend
```

```powershell
cd frontend
npm.cmd run dev
```

Mở địa chỉ Vite hiển thị trong cửa sổ thứ hai. Giao diện sẽ gửi yêu cầu API tới backend ở cổng 5000.

Nếu trang đăng nhập báo API trả về HTML hoặc `Unexpected token '<'`, hãy kiểm tra `http://127.0.0.1:5000/api/health` có `apiVersion: 2` và `http://127.0.0.1:5000/api/auth/csrf` có trường `token`. Sau khi đăng nhập admin, mở `/api/accounts` trên **cùng địa chỉ gốc với trang quản lý** (ví dụ `http://localhost:5173/api/accounts` nếu đang dùng Vite); API phải trả JSON chứa admin và các khách đã đăng ký trên cùng cơ sở dữ liệu. Nếu thấy HTML hoặc lỗi API không tồn tại, hãy kiểm tra tiến trình đang chiếm cổng 5000 và bản backend đã đóng gói; khi chạy `release/backend.exe` cần đóng gói lại để nhận mã mới. `Start-Local.cmd` cũng sẽ báo rõ khi phát hiện bản backend cũ. Nếu danh sách chỉ có admin, kiểm tra các lần chạy backend có dùng cùng tài khoản Windows và cùng giá trị `INVENTORY_DATA_DIR`. Lệnh `--create-admin` chỉ tạo tài khoản và kết thúc; sau đó vẫn cần chạy backend bình thường.

Để chạy thử website khách hàng, mở cửa sổ PowerShell thứ ba:

```powershell
cd storefront
npm.cmd run dev
```

Mở `http://127.0.0.1:5174/store/`. Cần giữ backend đang chạy. Website chỉ hiển thị sản phẩm đang còn hàng hoặc đã hết hàng; sản phẩm đã xoá không xuất hiện. Hiện mọi sản phẩm chưa xoá đều hiện trên website.

## Đóng gói để dùng tại cửa hàng

Sau khi cài thư viện, chạy một lần khi phát hành phiên bản mới:

```powershell
.\scripts\Build-Release.ps1
```

Thư mục `release` chứa ứng dụng đã đóng gói. Sau đó có thể nhấp đúp `scripts\Start-Local.cmd`: chương trình sẽ khởi động ứng dụng và mở `http://127.0.0.1:5000` trong trình duyệt. Người bán hàng không phải chạy `npm run build`.

Sau khi đóng gói, website khách hàng chạy trên cùng máy tại `http://127.0.0.1:5000/store/`.

## Đưa website lên Internet

API quản lý nay yêu cầu quyền admin; tài khoản khách chỉ được xem đơn của mình. Trước khi đưa lên Internet vẫn cần cấu hình tên miền/HTTPS, sao lưu tự động và vận hành máy chủ an toàn. Không công bố cổng chạy thử cục bộ trực tiếp. Backend và dữ liệu cần chạy ở máy chủ hoặc có cơ chế đồng bộ rõ ràng; không đặt tệp SQLite đang mở trong Google Drive. Chỉ đồng bộ bản sao lưu ZIP được tạo an toàn.

Để tự chạy sau khi đăng nhập Windows, tạo một tác vụ trong **Task Scheduler** chạy `scripts\Start-Local.cmd` với tài khoản Windows dùng tại quầy. Máy in tem cần được cài driver Windows; chọn đúng khổ giấy 35 × 22 mm hoặc 50 × 30 mm trong hộp thoại in và driver.

## Dữ liệu và sao lưu

Tệp dữ liệu mặc định nằm tại `%LOCALAPPDATA%\QuanLyBanHang\inventory.db`; ảnh sản phẩm ở thư mục `product-images` cạnh tệp DB. Có thể đổi thư mục bằng biến môi trường `INVENTORY_DATA_DIR`. Nút **Sao lưu dữ liệu và ảnh** tải ZIP chứa `inventory.db` cùng thư mục `product-images`. Để khôi phục, đóng ứng dụng, giữ thêm một bản của dữ liệu hiện tại rồi giải nén hai thành phần này vào `%LOCALAPPDATA%\QuanLyBanHang`. Tài khoản admin và khách nằm trong DB; nếu không còn phiên đăng nhập, hãy đăng nhập lại sau khi khôi phục. Có thể giữ ZIP trong Google Drive; phần mềm chưa tự đồng bộ Drive.

Trước lần chạy đầu sau khi cập nhật phần nhập kho, kiểm kê và bảo hành, hãy dùng nút **Sao lưu dữ liệu** trên bản cũ. Bản mới sẽ tự bổ sung cột giảm giá, các cột đánh dấu hoá đơn đã xoá và các bảng bảo hành, phiếu kho và trường theo dõi serial/ngày hẹn vào cơ sở dữ liệu hiện có; dữ liệu sản phẩm và hoá đơn cũ được giữ lại. Nếu đang chạy backend, dừng tiến trình đó rồi khởi động lại để nạp mã mới.

Mỗi món hàng cùng loại dùng chung mã vạch. Mã vạch lưu **mã sản phẩm**, không lưu giá. Khi sửa giá, hãy in lại tem giá cho hàng còn trên kệ.
