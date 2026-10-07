# Phần mềm quản lý bán hàng và tồn kho

Ứng dụng chạy cục bộ trên một máy Windows. Giao diện dùng React + TypeScript; API dùng ASP.NET Core; dữ liệu lưu trong SQLite. Không cần Internet khi sử dụng tại cửa hàng.

## Chức năng hiện có

- Thêm, xem, sửa, xoá mềm sản phẩm; lưu mã, tên, hãng, loại, giá nhập, trạng thái thuế của giá nhập, giá bán và số lượng.
- Danh sách sắp xếp theo tên; tìm theo tên, mã, hãng, loại (tìm không dấu); lọc theo hãng và loại.
- Nhật ký thêm/sửa/xoá sản phẩm và biến động số lượng.
- In tem 50 × 30 mm gồm tên, giá bán và mã vạch Code 128.
- Bán hàng bằng mã quét hoặc tìm thủ công. Quét lại cùng mã tăng số lượng trong đơn.
- Nhập tên, số điện thoại khách và xem thời gian, tổng tiền ở bên phải. Thanh toán lưu hoá đơn và trừ kho trong cùng giao dịch.
- Xem hoá đơn và tải bản sao lưu cơ sở dữ liệu.

Mục **Có thuế / Chưa thuế** hiện chỉ ghi lại trạng thái của **giá nhập**. Ứng dụng chưa tự tính thuế vì chưa có thuế suất và quy tắc tính được xác định.

## Cài công cụ và thư viện (bạn tự chạy)

Cài **Node.js** và **.NET SDK 10** trên máy lập trình. Sau đó mở PowerShell tại thư mục dự án:

```powershell
cd frontend
npm install
cd ..
dotnet restore backend\backend.csproj
```

`npm install` cài các thư viện được khai báo trong `frontend/package.json`. `dotnet restore` tải gói SQLite cho backend. Mã nguồn không tự cài thư viện lúc chạy ứng dụng bán hàng.

## Chạy khi lập trình

Mở hai cửa sổ PowerShell tại thư mục dự án:

```powershell
dotnet run --project backend\backend.csproj --urls http://127.0.0.1:5000
```

```powershell
cd frontend
npm run dev
```

Mở địa chỉ Vite hiển thị trong cửa sổ thứ hai. Giao diện sẽ gửi yêu cầu API tới backend ở cổng 5000.

## Đóng gói để dùng tại cửa hàng

Sau khi cài thư viện, chạy một lần khi phát hành phiên bản mới:

```powershell
.\scripts\Build-Release.ps1
```

Thư mục `release` chứa ứng dụng đã đóng gói. Sau đó có thể nhấp đúp `scripts\Start-Local.cmd`: chương trình sẽ khởi động ứng dụng và mở `http://127.0.0.1:5000` trong trình duyệt. Người bán hàng không phải chạy `npm run build`.

Để tự chạy sau khi đăng nhập Windows, tạo một tác vụ trong **Task Scheduler** chạy `scripts\Start-Local.cmd` với tài khoản Windows dùng tại quầy. Máy in tem cần được cài driver và khổ giấy 50 × 30 mm trước khi in.

## Dữ liệu và sao lưu

Tệp dữ liệu mặc định nằm tại `%LOCALAPPDATA%\QuanLyBanHang\inventory.db`. Có thể đổi thư mục bằng biến môi trường `INVENTORY_DATA_DIR`. Nút **Sao lưu dữ liệu** tải một bản sao SQLite. Để khôi phục, đóng ứng dụng rồi thay tệp `inventory.db` bằng bản sao đã tải, sau khi giữ thêm một bản của tệp hiện tại.

Mỗi món hàng cùng loại dùng chung mã vạch. Mã vạch lưu **mã sản phẩm**, không lưu giá. Khi sửa giá, hãy in lại tem giá cho hàng còn trên kệ.
