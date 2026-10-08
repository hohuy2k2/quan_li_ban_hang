# Phần mềm quản lý bán hàng và tồn kho

Ứng dụng chạy cục bộ trên một máy Windows. Giao diện dùng React + TypeScript; API dùng ASP.NET Core; dữ liệu lưu trong SQLite. Không cần Internet khi sử dụng tại cửa hàng.

## Chức năng hiện có

- Website khách hàng ở `/store/`: xem danh mục, tìm/lọc sản phẩm, thêm giỏ hàng và gửi đơn để cửa hàng xác nhận. Mục **Đơn online** trong phần quản lý cho phép xác nhận (tạo hoá đơn, trừ kho) hoặc huỷ đơn. Khi khách mới gửi đơn, tồn kho chưa bị trừ. Chưa có thanh toán online hoặc tính phí vận chuyển.

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

- Lọc và tìm lịch sử sản phẩm, biến động kho; nhấn mã hoá đơn trong lịch sử kho để xem chi tiết. Tải bản sao lưu cơ sở dữ liệu.

Mục **Có thuế / Chưa thuế** hiện chỉ ghi lại trạng thái của **giá nhập**. Ứng dụng chưa tự tính thuế vì chưa có thuế suất và quy tắc tính được xác định.

Khi đã ghi nhận hàng trả, hoá đơn được giữ nguyên để đối chiếu và không thể sửa nữa. Hàng bảo hành vẫn thuộc khách hàng nên không được cộng vào tồn kho bán được. Doanh thu hôm nay là tiền bán hôm nay trừ tiền hoàn trả hôm nay.

## Cấu trúc giao diện

- `frontend/src/App.tsx`: khung ứng dụng, điều hướng và tải dữ liệu chung.
- `frontend/src/pages/`: sáu màn hình bán hàng, sản phẩm, phiếu kho, hoá đơn, bảo hành và lịch sử. Mỗi màn hình giữ trạng thái của chức năng mình.
- `frontend/src/components/`: biểu mẫu sản phẩm, hộp thoại in tem, chi tiết hoá đơn và bộ điều khiển phân trang dùng chung (`Pagination.tsx`).
- `frontend/src/utils/format.ts`: định dạng tiền, ngày giờ, tìm kiếm và nội dung lịch sử.
- `frontend/src/hooks/usePagination.ts`: tính trang hiện tại và tự quay về trang 1 khi bộ lọc thay đổi.
- `frontend/src/api.ts` và `frontend/src/types.ts`: gọi backend và khai báo kiểu dữ liệu.
- `storefront/`: website React riêng cho khách hàng. `src/App.tsx` chỉ ghép các phần và giữ trạng thái dùng chung; `src/components/` chứa đầu trang, danh mục, giỏ hàng và biểu mẫu đặt hàng; `src/hooks/` quản lý sản phẩm và giỏ hàng; `src/api.ts` gọi backend; `src/types.ts` khai báo dữ liệu; `src/utils/format.ts` định dạng tiền và tìm kiếm. Các hàm chính có ghi chú ngay trong mã. API `/api/store/products` chỉ xuất thông tin bán hàng, không xuất giá nhập hoặc số tồn chính xác.

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

`npm install` cài các thư viện được khai báo trong `frontend/package.json`. `dotnet restore` tải gói SQLite cho backend. Mã nguồn không tự cài thư viện lúc chạy ứng dụng bán hàng.

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

Phiên bản này dùng để chạy thử trên máy cửa hàng. **Không mở cổng backend hiện tại ra Internet**: các API quản lý sản phẩm, hoá đơn và sao lưu chưa có đăng nhập. Khi đưa website lên mạng, cần chuyển API/DB dùng chung lên máy chủ hoặc xây cơ chế đồng bộ, tách API công khai khỏi API quản trị, thêm đăng nhập và giới hạn yêu cầu đặt hàng. Không dùng tệp SQLite đang mở trong thư mục Google Drive làm database trực tiếp; chỉ đồng bộ bản sao lưu được tạo an toàn.

Để tự chạy sau khi đăng nhập Windows, tạo một tác vụ trong **Task Scheduler** chạy `scripts\Start-Local.cmd` với tài khoản Windows dùng tại quầy. Máy in tem cần được cài driver Windows; chọn đúng khổ giấy 35 × 22 mm hoặc 50 × 30 mm trong hộp thoại in và driver.

## Dữ liệu và sao lưu

Tệp dữ liệu mặc định nằm tại `%LOCALAPPDATA%\QuanLyBanHang\inventory.db`. Có thể đổi thư mục bằng biến môi trường `INVENTORY_DATA_DIR`. Nút **Sao lưu dữ liệu** tải một bản sao SQLite. Để khôi phục, đóng ứng dụng rồi thay tệp `inventory.db` bằng bản sao đã tải, sau khi giữ thêm một bản của tệp hiện tại.

Trước lần chạy đầu sau khi cập nhật phần nhập kho, kiểm kê và bảo hành, hãy dùng nút **Sao lưu dữ liệu** trên bản cũ. Bản mới sẽ tự bổ sung cột giảm giá, các cột đánh dấu hoá đơn đã xoá và các bảng bảo hành, phiếu kho và trường theo dõi serial/ngày hẹn vào cơ sở dữ liệu hiện có; dữ liệu sản phẩm và hoá đơn cũ được giữ lại. Nếu đang chạy backend, dừng tiến trình đó rồi khởi động lại để nạp mã mới.

Mỗi món hàng cùng loại dùng chung mã vạch. Mã vạch lưu **mã sản phẩm**, không lưu giá. Khi sửa giá, hãy in lại tem giá cho hàng còn trên kệ.
