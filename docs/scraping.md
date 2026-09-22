# Scraping — asset còn thiếu

Repo hiện có vỏ HTML, bundle và dữ liệu UIL, nhưng **chưa chạy được** vì thiếu
asset. Tài liệu này liệt kê chính xác những gì còn thiếu và cách lấy.

Chạy `npm run validate` để xem danh sách cập nhật theo thời gian thực.

## Cách lấy

Site gốc: `https://activetheory.net`. Bundle là static, phục vụ từ:

| Host | Dùng cho |
|---|---|
| `activetheory.net/assets/...` | JS, data, font |
| `storage.openclaw.com/activetheory-v6.appspot.com/media/...` | ảnh social, media |

Vì `src/index.html` có `<base href="../">`, mọi đường dẫn tương đối resolve về
gốc repo. Tải asset về đúng vị trí tương ứng là chạy được (khi đã có đủ).

```bash
# Ví dụ tải 1 file
mkdir -p assets/meta
curl -o assets/meta/favicon-32x32.png \
  https://activetheory.net/assets/meta/favicon-32x32.png
```

## Danh sách thiếu

### 1. Meta / favicon — `assets/meta/`

Được `src/index.html` tham chiếu trực tiếp. Nhỏ, dễ lấy.

- [ ] `apple-touch-icon.png`
- [ ] `favicon-32x32.png`
- [ ] `favicon-16x16.png`
- [ ] `manifest.json`
- [ ] `safari-pinned-tab.svg`

### 2. Thư viện phụ — `assets/js/lib/`

Bundle tham chiếu; thiếu thì một số tính năng hỏng nhưng app vẫn boot.

- [ ] `_draco/` — giải nén geometry nén Draco (`.drc`)
- [ ] `_resonance/resonance-audio.min.js` — spatial audio
- [ ] `basis_transcoder.js` + `.wasm` — giải nén texture Basis
- [ ] `qrious.js` — sinh QR code

### 3. Config asset — `assets/js/app/config/`

- [ ] `UILAssetsConfig.js` — ánh xạ tên asset → đường dẫn. **Quan trọng**:
  thiếu file này thì bundle không biết nạp asset nào.

### 4. Data — `assets/data/`

- [ ] `uil-partial.json` — UIL rút gọn (nạp nhanh trước)
- [ ] `timeline-*.json` — data timeline animation

### 5. Hình học — `assets/geometry/`

Bundle tham chiếu trực tiếp:

- [ ] `hand_indexed.bin`
- [ ] `hexgrid/hexagon_gem.bin`
- [ ] các file `.bin` khác

### 6. Texture / ảnh — `assets/images/`

Cấu trúc quan sát được từ bundle:

```
assets/images/
├── _lighting/arealights.json
├── _lightvolume/light.jpg, light-mask.jpg
├── _scenelayout/black.jpg, invert.cube, mask.jpg, uv.jpg
├── pbr/
│   ├── corsica_beach-diffuse-RGBM.png
│   ├── corsica_beach-specular-RGBM.png
│   ├── damaged_road_basecolor.png
│   ├── damaged_road_mro.png
│   ├── damaged_road_normal.jpg / .png
│   ├── lut.png
│   └── ...
├── room/matcap-test.jpg
├── ui/arrow.png, close.svg, globe.png, ig.png, in.png, star.png, tw.png
└── lab.gif
```

### 7. Font — `assets/fonts/`

`src/index.html` khai báo `@font-face` cho font **nbarchitekt**, 3 weight:

- [ ] `NBArchitektStd-Regular-export/` — `.woff2`, `.woff`, `.otf`
- [ ] `NBArchitektStd-Light-export/` — `.woff2`, `.woff`, `.otf`
- [ ] `NBArchitektStd-Bold-export/` — `.woff2`, `.woff`, `.otf`

## Sau khi tải về

```bash
npm run validate
```

Script sẽ đối chiếu `src/index.html` với đĩa và báo còn thiếu gì. Khi hết
cảnh báo "chưa scrape", chạy thử:

```bash
npx serve .     # hoặc bất kỳ static server nào
```

Mở `http://localhost:3000/src/` — cần serve từ **gốc repo** để `<base href="../">`
resolve đúng.

## Ghi chú pháp lý

Toàn bộ asset, code và thiết kế thuộc bản quyền **Active Theory**. Đây là bản
lưu trữ cho mục đích tham khảo/học tập. Không dùng cho mục đích thương mại và
không tuyên bố sở hữu. Xem thêm `assets/js/VENDOR.md`.
