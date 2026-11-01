# Dreamy Birthday Date Planner (04.11.2026) 🩵
> **Thiệp mời sinh nhật & Kế hoạch hẹn hò mộng mơ dành riêng cho bạn thân**

Ứng dụng web trọn vẹn (Full-Stack), tương tác trực tiếp, lưu trữ cơ sở dữ liệu bền vững (persistent), bảo mật quản trị và hỗ trợ triển khai thực tế.

---

## 🌸 1. Tổng Quan Ứng Dụng

Ứng dụng được thiết kế theo phong cách kết hợp:
1. **Korean Pastel-Blue Scrapbook**: Giấy kẻ sọc mộng mơ, đám mây bồng bềnh, ngôi sao lấp lánh, nơ và sticker đáng yêu, khung ảnh polaroid nghiêng nghệ thuật, vệt băng dính washi tape thủ công, font chữ viết tay ấm áp.
2. **Card-Based Selection Minimal UI**: Giao diện chọn món ăn, cafe, workshop, rạp phim và lịch hẹn tối giản, trực quan, phân cấp rõ ràng, hỗ trợ đầy đủ thiết bị di động (Mobile-first).

### 2 Trải nghiệm tách biệt:
- **Khách mời (Public Invitation)**: Mở bằng liên kết chia sẻ, không cần đăng ký tài khoản. Tự do quyết định tham gia hoặc bỏ qua từng hạng mục (`Có chứ! Chọn thôi 🩵` / `Bỏ qua lần này →`), chọn ngày giờ và nhận thông báo xác nhận ngay sau khi hệ thống lưu thành công. Khách tuyệt đối không thể truy cập bảng quản trị hay xem lựa chọn của người khác.
- **Quản trị viên (Admin Dashboard)**: Đăng nhập bảo mật bằng phiên làm việc đã mã hóa (PBKDF2 SHA-512 + Session Token / Supabase Auth), toàn quyền quản lý danh mục ẩm thực, quán xá, workshop, phim rạp, ngày giờ, xem danh sách kế hoạch đã gửi, lọc trạng thái (`New`, `Reviewed`, `Confirmed`, `Completed`), sao chép tin nhắn Zalo và xuất file CSV (Excel).

---

## 🎨 2. Bảng Màu & Thẩm Mỹ Thiết Kế

- **Baby Blue**: `#DCEEFF` (Nền nút, badge trang trí)
- **Powder Blue**: `#B9D9F5` (Viền thẻ, hiệu ứng phát sáng nhẹ)
- **Cloud White**: `#F8FBFF` (Nền trang trí dạng mây)
- **Pale Lavender**: `#E9E5F7` (Điểm nhấn mộng mơ)
- **Soft Periwinkle**: `#C9D7F7` (Băng dính washi tape)
- **Muted Blue Text**: `#526B91` (Chữ phụ, nhãn thông tin)
- **Dark Readable Text**: `#34445E` (Chữ chính dễ đọc)

---

## 📁 3. Cấu Trúc Dự Án

```
birthday-date-planner/
├── package.json               # Node.js 22+ & 24+ native test & scripts
├── .env.example               # Biến môi trường mẫu
├── .env                       # Biến môi trường cục bộ
├── README.md                  # Hướng dẫn chi tiết triển khai & sử dụng
├── supabase/
│   └── migrations/
│       └── 20261104000000_birthday_date_planner.sql # Schema PostgreSQL & RLS Policies
├── src/
│   ├── config.js              # Cấu hình hệ thống & load biến môi trường
│   ├── server.js              # Server HTTP REST API & static file serving
│   ├── db/
│   │   ├── schema.sql         # Schema SQLite cục bộ
│   │   ├── database.js        # Khởi tạo kết nối SQLite WAL mode
│   │   ├── create_admin.js    # Script tạo tài khoản Admin đầu tiên
│   │   └── seed.js            # Seed dữ liệu mẫu phong phú
│   ├── middleware/
│   │   └── security.js        # Xác thực Admin session, cookie parser & rate limiter
│   ├── services/
│   │   ├── authService.js     # Mã hóa mật khẩu PBKDF2 & quản lý session
│   │   ├── invitationService.js# Quản lý cài đặt thiệp & lời chúc
│   │   ├── activityService.js # Quản lý CRUD thực đơn, cafe, workshop, phim
│   │   ├── scheduleService.js # Quản lý ngày giờ & kiểm tra hợp lệ
│   │   └── submissionService.js# Lưu trữ snapshot bền vững, xuất CSV, sao chép tin nhắn
│   └── public/
│       ├── index.html         # Giao diện chính SPA (Landing, Wizard, Success, Admin)
│       ├── css/
│       │   └── style.css      # Hệ thống thiết kế Korean Pastel Scrapbook & Responsive
│       └── js/
│           ├── icons.js       # Bộ sưu tập icon SVG nhẹ nhàng
│           ├── app.js         # Luồng tương tác thiệp mời, wizard & gửi đơn
│           └── admin.js       # Bảng điều khiển quản trị viên
└── tests/
    ├── 01_wizard_scenarios.test.js      # Kịch bản 1 đến 5 (Chọn/Bỏ qua/Đổi ý)
    ├── 02_security_and_integrity.test.js# Kịch bản 6 đến 14 (Bảo mật/Chống duplicate/Snapshot)
    └── 03_server_integration.test.js   # Kịch bản 15 (HTTP live flow, CSV, Mobile responsive)
```

---

## 🚀 4. Hướng Dẫn Khởi Chạy Nhanh (Local Development)

### Bước 1: Di chuyển vào thư mục dự án
```powershell
cd C:\Users\Dell\.gemini\antigravity\scratch\birthday-date-planner
```

### Bước 2: Nạp dữ liệu mẫu và tạo tài khoản Admin
```powershell
node src/db/seed.js
```
*Tài khoản quản trị mặc định:*
- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `DreamyBestie2026!`

### Bước 3: Khởi động máy chủ
```powershell
node src/server.js
```
Mở trình duyệt truy cập: **`http://localhost:3000`**

### Bước 4: Chạy bộ kiểm thử tự động (16 Tests)
```powershell
node --test --test-concurrency=1 tests/*.test.js
```

---

## 🔒 5. Hướng Dẫn Thiết Lập Supabase & Triển Khai Sản Phẩm

### Thiết lập Supabase:
1. Đăng nhập [supabase.com](https://supabase.com) và tạo một Project mới.
2. Vào mục **SQL Editor** trong bảng điều khiển Supabase.
3. Mở file `supabase/migrations/20261104000000_birthday_date_planner.sql` trong dự án, dán toàn bộ nội dung vào SQL Editor và nhấn **Run**.
4. Toàn bộ bảng dữ liệu, ràng buộc quan hệ, Trigger và các chính sách **Row Level Security (RLS)** sẽ được thiết lập tự động:
   - Khách vãng lai chỉ có quyền `SELECT` các nội dung đã công khai (`is_active = TRUE`, `is_published = TRUE`).
   - Khách chỉ có quyền `INSERT` đơn kế hoạch mới.
   - Tuyệt đối **không cho phép khách đọc danh sách đơn của người khác**.
   - Chỉ người dùng có quyền Admin mới được quyền `SELECT`, `UPDATE`, `DELETE` tất cả các bảng.

### Tạo tài khoản Admin trên Supabase:
1. Vào mục **Authentication -> Users** trên Supabase, nhấn **Add User** -> tạo email và mật khẩu cho bạn.
2. Vào **SQL Editor**, chạy câu lệnh sau để cấp quyền Admin cho tài khoản vừa tạo:
```sql
INSERT INTO public.admin_profiles (id, username, display_name, role)
VALUES ('<UUID_CỦA_USER_TRÊN_SUPABASE>', 'admin', 'Host Sinh Nhật 🩵', 'admin');
```

### Triển khai lên Vercel:
1. Cấu hình biến môi trường trên Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL dự án Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon Public Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Secret Key (chỉ dùng phía Server)
   - `SESSION_SECRET`: Chuỗi ngẫu nhiên bảo mật
2. Deploy mã nguồn lên Vercel.

---

## 💡 6. Hướng Dẫn Sử Dụng Bảng Quản Trị

1. **Đăng nhập**: Trên thanh điều hướng đầu trang, nhấn nút **"Quản Trị 🔒"**, nhập `admin` / `DreamyBestie2026!`.
2. **Quản lý Thực đơn & Quán ăn**:
   - Thêm danh mục món (ví dụ: Món nướng, Món Nhật, Lẩu, Đồ ngọt...).
   - Thêm món ăn và danh sách quán ăn (tên quán, địa chỉ, ảnh minh họa, link Google Maps, lời nhắn riêng).
3. **Quản lý Cafe & Quán nước**:
   - Thêm phong cách quán (Cafe Hàn Quốc, Cafe ngắm hoàng hôn, Cafe sân vườn, Cafe mèo...).
   - Gán quán cafe vào một hoặc nhiều phong cách tương ứng.
4. **Quản lý Workshop**:
   - Tạo danh mục (Làm nến thơm, Tô tượng, Làm vòng tay handmade, Xoay gốm...).
   - Nhập thời lượng ước tính, giá/người, ca hoạt động trong ngày.
5. **Quản lý Phim**:
   - Thêm poster, thể loại, rạp chiếu mong muốn và ghi chú ngắn.
6. **Lịch ngày & Khung giờ**:
   - Thêm các ngày đi chơi có thể lựa chọn (ví dụ: Thứ Tư 04/11/2026, Thứ Bảy 07/11/2026...).
   - Thêm các khung giờ cụ thể cho từng ngày (Sáng, Chiều, Tối).
7. **Chia sẻ thiệp mời**:
   - Vào tab **"Cài đặt thiệp & Link ⚙️"**, nhấn nút **"Sao chép link"** để gửi link cho bạn thân qua Zalo, Messenger hoặc SMS.
   - Có thể bật/tắt tạm đóng thiệp bất cứ lúc nào mà không làm mất dữ liệu.

---

## ✅ 7. Kết Quả Kiểm Thử (15 Kịch Bản Toàn Diện)

| STT | Kịch bản kiểm thử | Trạng thái | Ghi chú kiểm thử |
|---|---|:---:|---|
| 1 | Khách chọn cả 4 hạng mục hoạt động | **PASS** | Đầy đủ thông tin món ăn, cafe, workshop, phim |
| 2 | Khách bỏ qua cả 4 hạng mục hoạt động | **PASS** | Ghi nhận rõ ràng trạng thái "Bỏ qua lần này" |
| 3 | Khách chọn ăn & cafe, bỏ qua workshop & phim | **PASS** | Không hiển thị thẻ trống, lưu đúng lựa chọn |
| 4 | Khách quay lại bước trước để đổi lựa chọn | **PASS** | Dữ liệu cũ được cập nhật mượt mà không mất nháp |
| 5 | Gửi kế hoạch hợp lệ thành công | **PASS** | Backend xác nhận thành công trước khi hiển thị màn hình chúc mừng |
| 6 | Dữ liệu tồn tại bền vững sau khi tải lại trang | **PASS** | Truy vấn lại từ database SQLite/Postgres toàn vẹn |
| 7 | Admin đăng nhập từ thiết bị khác để xem đơn | **PASS** | Xác thực phiên làm việc độc lập qua token/cookie |
| 8 | Khách thứ hai không đọc được đơn của khách thứ nhất | **PASS** | Không có endpoint công khai danh sách đơn, bảo mật RLS |
| 9 | Khách chưa đăng nhập bị chặn khỏi API quản trị | **PASS** | Trả về mã lỗi 401 Unauthorized |
| 10 | Khách công khai không thể sửa nội dung hoạt động | **PASS** | Mọi API ghi đều yêu cầu quyền Admin |
| 11 | Từ chối ngày và khung giờ không hợp lệ | **PASS** | Báo lỗi tiếng Việt chi tiết nếu ngày/giờ bị xóa |
| 12 | Chống gửi trùng lặp do bấm nút liên tục | **PASS** | Idempotency hash chặn các lượt click trùng trong 10s |
| 13 | Lưu bản nháp an toàn nếu lỗi mạng | **PASS** | Tự động đồng bộ `localStorage` và cho phép thử lại |
| 14 | Xóa hoạt động cũ không làm hỏng đơn đã nộp | **PASS** | Lưu dưới dạng immutable snapshot JSON độc lập |
| 15 | Giao diện chuẩn mực trên màn hình di động nhỏ | **PASS** | Responsive CSS Media Query, Viewport meta chuẩn |
