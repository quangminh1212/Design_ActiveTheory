# Design · Active Theory

Bản lưu trữ (archive) cấu trúc web của **Active Theory** — studio thiết kế & phát triển trải nghiệm số.
Repo chứa HTML entry gốc, bundle JavaScript đã build và file dữ liệu UIL của site.

> ⚠️ Đây là tài liệu tham khảo/archival. Toàn bộ nội dung, mã nguồn và thiết kế thuộc bản quyền của Active Theory.

## Cấu trúc

```
.
├── index_orig.html      # HTML entry gốc (chứa loader, meta, font-face, bootstrap script)
└── _scrape/
    ├── uil.json         # UIL (Universal Interface Layout) — cấu hình scene, camera, element
    └── js/
        └── app.js       # Bundle JavaScript production của ứng dụng
```

## Chi tiết các phần

### `index_orig.html`
Trang HTML gốc của site. Bao gồm:
- Meta tags (SEO, Open Graph, Twitter Card)
- Khai báo `@font-face` cho font **nbarchitekt** (Light / Regular / Bold)
- Inline CSS cho `#Stage`, accessibility helpers, scrollbar
- Bootstrap script: set `_ENV_`, `_CMS_`, `_CACHE_`, preload `app.<cache>.js`, kiểm tra optional chaining và fallback về `unsupported.html`
- openclaw Tag Manager (gtag)

### `_scrape/uil.json`
File cấu hình UIL dạng phẳng (flattened key-value). Mỗi key mã hoá một thuộc tính của scene/element:

```
<CAMERA|ELEMENT>_Element_<id>_<Scene><thuộc_tính>
```

Các thuộc tính phổ biến: `position`, `rotation`, `fov`, `groupPos`, `lookAt`, `moveXY`, `wobbleStrength`.
Dùng để dựng lại layout, vị trí camera và hành vi chuyển động giữa các scene (`home`, `Footer`, `CleanRoom`, ...).

### `_scrape/js/app.js`
Bundle production (WebGL / 3D runtime). Chứa logic render, quản lý scene, animation và interaction.
Đã qua minify/build — không phải source gốc.

## Ghi chú

- `_CACHE_` trong `index_orig.html` (`1780406240914`) là build timestamp, dùng để versioning asset.
- Site yêu cầu JavaScript và hỗ trợ optional chaining (`?.`), nếu không sẽ redirect sang trang unsupported.
