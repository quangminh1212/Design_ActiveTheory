# VENDOR — code không phải của repo này

File trong thư mục này là **bundle đã build của Active Theory**, không phải
mã nguồn của người duy trì repo.

## `app.1780406240914.js`

| | |
|---|---|
| Nguồn | `https://activetheory.net/assets/js/app.1780406240914.js` |
| Chủ sở hữu | Active Theory |
| Kích thước | 1 817 616 bytes |
| Dạng | Bundle production, minified (4 dòng) |
| Cờ runtime | `window._MINIFIED_ = true`, `window._BUILT_ = true` |

Số `1780406240914` là **build timestamp**, không phải hash nội dung. Nó khớp
với `window._CACHE_` trong `src/index.html`. Đổi tên file sẽ làm bundle không
được nạp — vì vậy tên được giữ nguyên.

### Không thể tách thành module

Đây là **artifact build**, không phải source. Toàn bộ file nằm trên 4 dòng đã
được minify và không có source map. Không có cách nào tách nó thành các ES
module có ý nghĩa mà không có source gốc.

Nếu cần bản đọc được, phải xin source từ Active Theory. Việc "module hoá" trong
repo này áp dụng cho **cấu trúc asset và dữ liệu UIL**, không áp dụng cho
bundle này.

### Không sửa file này

File được giữ **byte-for-byte** như bản gốc. Mọi thay đổi sẽ:

- làm lệch checksum so với bản đang chạy trên site
- không thể phục hồi (không có source, không có source map)
- vi phạm mục đích lưu trữ của repo

Nếu cần vá hành vi, viết script riêng đọc bundle ở runtime thay vì sửa file.

## Ghi chú pháp lý

Bundle này là tài sản của Active Theory, được lưu trữ ở đây cho mục đích tham
khảo và học tập. Repo không tuyên bố sở hữu, không cấp phép lại, và không dùng
cho mục đích thương mại.

Nếu bạn là chủ sở hữu và muốn gỡ nội dung này, hãy mở issue.
