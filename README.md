# dithub

Giao diện dashboard (style GitHub, nền tối) cho đồ án **Quản lý bảo hành điện thoại** — MongoDB.

## Nội dung
- `index.html` — giao diện tĩnh, tự chứa (HTML/CSS/JS thuần), dùng dữ liệu mẫu trong bộ nhớ để minh họa các nghiệp vụ: hãng sản xuất, sản phẩm, phiếu bảo hành, khách hàng, và dashboard thống kê.
- `TruyVanNC.js` — bộ câu lệnh truy vấn MongoDB gốc (chạy trong mongosh / NoSQLBooster) mà giao diện này mô phỏng lại.

## Chạy thử
Mở trực tiếp `index.html` bằng trình duyệt, hoặc dùng GitHub Pages để host:
Settings → Pages → Deploy from branch → `main` / root.

## Lưu ý
Giao diện hiện chưa kết nối tới MongoDB thật — dữ liệu là dữ liệu mẫu, các thao tác "Thêm" chỉ lưu tạm trong phiên trình duyệt.
