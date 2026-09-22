# Design · Active Theory

Bản lưu trữ (archive) cấu trúc web của **Active Theory** — studio thiết kế &
phát triển trải nghiệm số.

> ⚠️ **Đây là tài liệu tham khảo/học tập.** Toàn bộ nội dung, mã nguồn và thiết
> kế thuộc bản quyền của Active Theory. Repo không tuyên bố sở hữu và không
> cấp phép lại. Xem `assets/js/VENDOR.md`.

## Trạng thái

Repo **chưa chạy được** — có vỏ HTML, bundle và dữ liệu UIL, nhưng thiếu
geometry, texture, font và thư viện phụ. Chạy `npm run validate` để xem danh
sách asset còn thiếu.

## Cấu trúc

```
.
├── src/
│   └── index.html                  HTML entry (từ bản scrape gốc)
│
├── assets/
│   ├── js/
│   │   ├── app.1780406240914.js    bundle production — vendor, không sửa
│   │   ├── VENDOR.md               nguồn gốc + ghi chú pháp lý
│   │   └── app/config/             [chờ UILAssetsConfig.js]
│   ├── data/
│   │   ├── uil.json                manifest + index các module UIL
│   │   └── uil/                    66 module đã tách
│   │       ├── inputs.json         1266 key — config node đầu vào
│   │       ├── meshes.json          333 key — transform mesh
│   │       ├── camera.json           82 key — camera, shadow, group
│   │       ├── lights.json          170 key — ánh sáng
│   │       ├── shaders/             709 key — 56 file uniform shader
│   │       ├── scenes/               config cấp scene
│   │       └── editor.json          trạng thái editor
│   ├── fonts/  geometry/  images/  meta/     [chờ scrape]
│
├── docs/
│   ├── architecture.md             luồng bootstrap, UIL, cây asset
│   ├── uil-schema.md               ngữ pháp key UIL + ví dụ
│   └── scraping.md                 asset còn thiếu + cách lấy
│
└── scripts/
    ├── build-uil.mjs               tách uil.json → 66 module
    ├── merge-uil.mjs               dựng lại + kiểm tra roundtrip
    └── validate.mjs                kiểm tra toàn vẹn
```

## Bắt đầu

```bash
npm run validate     # kiểm tra toàn vẹn + liệt kê asset thiếu
npm run roundtrip    # xác nhận tách module không mất dữ liệu
npm run build:uil    # tách lại uil.json từ _scrape/uil.json
npm run merge:uil    # dựng ngược lại file phẳng
```

## Về dữ liệu UIL

`uil.json` gốc là một object phẳng **2593 key** trong 1 file 223KB. Repo này
tách nó thành **66 module** theo scene và shader để dễ bảo trì.

Việc tách được kiểm chứng là không mất mát:

```
Key gốc       : 2593
Key dựng lại  : 2593
✓ Tất cả key khớp giá trị.
✓ Thứ tự key khớp bản gốc.
```

Manifest `assets/data/uil.json` ghi `sha256` và kích thước file gốc, nên
`npm run validate` phát hiện được nếu file gốc bị thay đổi.

Chi tiết ngữ pháp key và cách phân loại: `docs/uil-schema.md`.

## Về bundle `app.js`

`assets/js/app.1780406240914.js` là **artifact build đã minify** (4 dòng), không
phải source code. Nó **không thể tách thành ES module** — không có source map
và không có source gốc. File được giữ byte-for-byte.

Việc module hoá trong repo áp dụng cho **cấu trúc asset và dữ liệu UIL**, không
áp dụng cho bundle.

## Ghi chú kỹ thuật

- `window._CACHE_` (`1780406240914`) là build timestamp dùng làm cache-buster,
  không phải hash nội dung. Tên file bundle phải khớp giá trị này.
- `<base href="../">` trong `src/index.html` để mọi đường dẫn tương đối resolve
  về gốc repo. Cần serve từ gốc repo.
- Site dùng optional chaining (`?.`) và từ chối chạy trên trình duyệt cũ, tự
  chuyển sang `unsupported.html`.
- `_CMS_` là placeholder (`%CMS%`), được thay lúc deploy.
