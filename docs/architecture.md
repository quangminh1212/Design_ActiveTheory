# Kiến trúc

Tài liệu này mô tả cách site Active Theory được dựng, dựa trên những gì quan
sát được từ `src/index.html` và bundle `assets/js/app.1780406240914.js`.

## Tổng quan

Site là một ứng dụng WebGL/3D client-side. HTML chỉ là cái vỏ; toàn bộ nội
dung, layout và animation do bundle JavaScript dựng ở runtime từ một file cấu
hình gọi là **UIL**.

```
src/index.html
  │
  │  1. set _ENV_, _CMS_, _CACHE_
  │  2. preload  assets/js/app.<_CACHE_>.js
  │  3. fetch    assets/data/uil.json          (window.UIL_STATIC_PATH)
  ▼
assets/js/app.<hash>.js   ← bundle minified, dựng toàn bộ scene
  │
  ├─ đọc UIL config      → vị trí camera, mesh, ánh sáng, uniform shader
  ├─ nạp geometry        → assets/geometry/
  ├─ nạp texture         → assets/images/
  └─ nạp font            → assets/fonts/
```

## Luồng bootstrap

Đoạn script inline trong `src/index.html` là điểm vào:

```js
window._ENV_  = 'production';
window._CMS_  = '%CMS%';            // placeholder, thay lúc deploy
window._CACHE_ = '1780406240914';   // build timestamp, dùng để version asset

// Feature detect: nếu không hỗ trợ optional chaining → trang unsupported
try { eval("let obj = {}; obj?.prop") }
catch (e) { location.replace('unsupported.html'); return }

window.UIL_STATIC_PATH = 'assets/data/uil.json';

// Preload rồi nạp bundle
const src = 'assets/js/app.' + window._CACHE_ + '.js';
```

Vài điểm đáng chú ý:

- **`_CACHE_` là cache-buster.** Mọi asset được gắn timestamp này. Khi build
  mới, giá trị đổi và mọi URL đổi theo — đây là cơ chế versioning, không phải
  hash nội dung. Vì vậy tên file bundle trong repo giữ nguyên timestamp gốc
  `1780406240914` để khớp với HTML.
- **Feature detect bằng `eval`.** Bundle dùng optional chaining (`?.`) nhưng
  không transpile nó xuống. Thay vì polyfill, site từ chối chạy trên trình
  duyệt cũ và chuyển sang `unsupported.html`.
- **`_CMS_` là placeholder** (`%CMS%`), được thay bằng giá trị thật lúc deploy.
  Trong bản scrape này nó chưa được thay.

## UIL — Universal Interface Layout

UIL là định dạng scene graph của Active Theory. Nó là một **object phẳng**:
mỗi key là một đường dẫn mã hoá, giá trị là config của nút đó.

### Cấu trúc key

Key có dạng tổng quát:

```
<Loại>_<Element|Config>_<id>_<ĐịnhDanh><thuộc_tính>
```

Ví dụ thật:

```
CAMERA_Element_3_home_sceneposition   → [0, 0, 8]
MESH_Element_0_Aboutposition          → [0, 0, -5]
INPUT_Config_0_Contact_name           → "tree"
GROUP_CleanRoom_group_0_name          → "room"
SHADOW_Element_9_home_scenesize       → 1024
```

Phần `<ĐịnhDanh>` là tên nút trong scene graph (thường là tên scene hoặc tên
element), phần `<thuộc_tính>` là thuộc tính được set (`position`, `rotation`,
`fov`, `lookAt`, `moveXY`, `lerpSpeed`, `wobbleStrength`, ...).

### Cấu trúc shader

Shader uniform có dạng đường dẫn có dấu `/`:

```
WorkGlassShader/WorkGlassShader/uAlpha          → 0.5
TreeWaterShader/TreeWaterShader/uSpeed          → 2
UnrealBloomComposite/UnrealBloomComposite/home/bloomStrength → 0.8
```

Đây là đường dẫn trong graph: `ShaderName/ShaderName/.../uniformName`.

### Các nhóm key

| Nhóm | Số key | Ý nghĩa |
|---|---:|---|
| `INPUT_*` | 1266 | Config đầu vào của node — tên, render order, layer |
| `<Shader>/...` | 709 | Uniform của shader (màu, tốc độ, cường độ) |
| `MESH_*` | 333 | Transform của mesh: position, rotation, scale |
| `L_*`, `am_*`, `sl_*` | 170 | Ánh sáng, antimatter, scene layout, post-process |
| `CAMERA_*`, `SHADOW_*`, `GROUP_*` | 82 | Camera theo scene, cấu hình shadow, group |
| `UIL_*` | 25 | Trạng thái editor (graph đang mở, particle layer) |
| `P_Element_*` | 7 | Định nghĩa particle layer |
| `undefined_tx_*` | 7 | Texture ref bị mất prefix lúc scrape |

Phân tích đầy đủ và cách phân loại: xem `docs/uil-schema.md` và
`scripts/build-uil.mjs`.

## Cây asset

Bundle tham chiếu cấu trúc asset sau (đọc trực tiếp từ bundle):

```
assets/
├── js/
│   ├── app.<_CACHE_>.js              ← bundle chính     [ĐÃ CÓ]
│   ├── app/config/UILAssetsConfig.js ← config asset     [THIẾU]
│   └── lib/
│       ├── _draco/                   ← giải nén Draco   [THIẾU]
│       ├── _resonance/               ← audio             [THIẾU]
│       ├── basis_transcoder.js       ← nén texture       [THIẾU]
│       └── qrious.js                 ← sinh QR           [THIẾU]
├── data/
│   ├── uil.json                      ← manifest UIL     [ĐÃ TÁCH]
│   ├── uil-partial.json              ← UIL rút gọn       [THIẾU]
│   └── timeline-*                    ← data timeline     [THIẾU]
├── geometry/                         ← .bin hình học     [THIẾU]
├── images/                           ← texture, UI icon [THIẾU]
├── fonts/                            ← nbarchitekt       [THIẾU]
└── meta/                             ← favicon, manifest [THIẾU]
```

Chi tiết cách lấy phần còn thiếu: xem `docs/scraping.md`.

## Trạng thái repo hiện tại

Repo **chưa chạy được**. Nó có đủ vỏ HTML, bundle và dữ liệu UIL, nhưng thiếu
geometry/texture/font và các thư viện phụ. Chạy `npm run validate` để xem
danh sách asset còn thiếu — script này đối chiếu `src/index.html` với đĩa và
liệt kê những gì chưa có.

Việc tách module UIL ở đây chuẩn bị sẵn chỗ cho asset rơi vào đúng vị trí,
chứ không giả vờ rằng repo đã hoàn chỉnh.
