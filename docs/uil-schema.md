# UIL schema

Ghi chú về định dạng `uil.json` của Active Theory, dựa trên phân tích 2593 key
trong bản scrape.

## Bản chất định dạng

Không có schema chính thức đi kèm. Định dạng là một **object phẳng** — mỗi key
là một đường dẫn được mã hoá thành chuỗi, giá trị là config của nút cuối.

Đặc điểm quan trọng: **đây không phải JSON có cấu trúc lồng nhau.** Mọi thứ bị
làm phẳng thành `<path><property> = value`. Việc dựng lại cây scene graph là
trách nhiệm của bundle khi đọc file.

## Ngữ pháp key

### Dạng 1 — element node

```
<từ_loại>_<Element>_<số>_<Tên><thuộc_tính>
```

```
CAMERA_Element_3_home_sceneposition
└──┬──┘ └──┬───┘ └┬┘ └───┬────┘└──┬───┘
  loại   Element  id   tên nút  thuộc tính
```

### Dạng 2 — input config

```
INPUT_<Config>_<số>_<Tên>_<thuộc_tính>
```

```
INPUT_Config_0_Contact_name        → "tree"
INPUT_Config_0_Contact_renderOrder → 0
INPUT_Config_0_Contact_sortIndex   → 0
```

### Dạng 3 — shader uniform (đường dẫn có `/`)

```
<Shader>/<Shader>/<phạm_vi?>/<uniform>
```

```
WorkGlassShader/WorkGlassShader/uAlpha
TreeWaterShader/TreeWaterShader/uSpeed
UnrealBloomComposite/UnrealBloomComposite/home/bloomStrength
```

Uniform luôn bắt đầu bằng `u` + chữ hoa (`uAlpha`, `uSpeed`), trừ uniform của
post-process (`bloomStrength`, `luminosityThreshold`).

### Dạng 4 — uniform dính liền (không có `/`)

Một số uniform bị mất dấu phân cách lúc serialize:

```
homeParticleCurluCurlNoiseScale
     └────┬─────┘└──────┬──────┘
      shader       uniform
```

Cắt tại `u` cuối cùng trước một chữ hoa để tách tên shader khỏi tên uniform.

## Bảng nhóm key

| Tiền tố / mẫu | Số key | Nhóm | Ghi chú |
|---|---:|---|---|
| `INPUT_` | 1266 | inputs | Config node — chiếm gần nửa file |
| `<X>/<X>/...` | 709 | shaders | Uniform, gồm cả post-process |
| `MESH_` | 333 | meshes | Transform: position/rotation/scale |
| `L_` | 15 | lights | Ánh sáng: intensity, color |
| `am_` | 56 | lights | Antimatter params |
| `sl_` | 46 | lights | Scene layout: deleted, order |
| `CAMERA_` | 66 | camera | Camera theo scene |
| `SHADOW_` | 10 | camera | Cấu hình shadow map |
| `GROUP_` | 4 | camera | Group node |
| `groupBridge_` | 2 | camera | Liên kết group |
| `UIL_graph_` | 9 | editor | Trạng thái graph đang mở |
| `UIL_P_` | 3 | editor | Trạng thái particle layer |
| `LIST_` | 3 | editor | Config list |
| `P_Element_*_code_list_items` | 4 | editor | Định nghĩa particle layer |
| `undefined_tx_*` | 7 | orphan | Texture ref mất prefix |

## Các scene

Token scene xuất hiện trong key (dùng để phân loại):

| Token | Slug | Số key (mọi loại) |
|---|---|---:|
| `CleanRoom` | clean-room | 501 |
| `TreeScene` | tree-scene | 393 |
| `home_scene` | home-scene | 347 |
| `ParticleTest` / `particleTest` | particle-test | 222 |
| `WorkDetail` | work-detail | 195 |
| `work_page` | work-page | 73 |
| `About` | about | 61 |
| `Work` | work | 56 |
| `Contact` | contact | 34 |
| `Footer` | footer | 32 |
| `work_scene` | work-scene | 21 |
| `ContactUs` | contact-us | 12 |
| `JellyfishDemo` | jellyfish-demo | 11 |
| `Home` | home | 9 |

**Lưu ý về cách phân loại:** key dạng `GlassCubeShader/GlassCubeShader/Element_0_home_scene/uAlpha`
vừa chứa token shader vừa chứa token scene. Trong repo này nó được xếp vào
**shader**, không phải scene — vì khi cần sửa uniform, ta tìm theo shader.
Hệ quả: bucket `scenes/` chỉ còn 1 key, còn phần lớn config của scene nằm rải
trong `inputs/`, `meshes/`, `camera/` và `shaders/`.

Đây là đánh đổi có chủ ý. Nếu bạn muốn xếp theo scene thay vì shader, sửa thứ
tự rule trong `scripts/build-uil.mjs` (đưa `SCENE_RULES` lên trước
`KIND_RULES`), rồi chạy lại `npm run build:uil && npm run roundtrip`.

## Ví dụ giá trị

```jsonc
// Vector 3 thành phần
"CAMERA_Element_3_home_sceneposition": [0, 0, 8]
"MESH_Element_0_Aboutposition": [0, 0, -5]

// Số
"WorkGlassShader/WorkGlassShader/uAlpha": 0.5
"homeParticleShapeuPlaneScale": 2.86

// Chuỗi
"INPUT_Config_0_Contact_name": "tree"
"GROUP_CleanRoom_group_0_name": "room"

// Boolean
"SHADOW_Element_9_home_scenestatic": true

// Object
"undefined_tx_tBaseColor": {
  "compressed": false,
  "filename": "prop_lightmap.jpg"
}

// Mảng chuỗi (danh sách layer)
"P_Element_19_home_scene_code_list_items": "[\"P_Element_19_...\", ...]"
```

## Toàn vẹn dữ liệu

Việc tách module giữ nguyên mọi thứ. Roundtrip được kiểm chứng:

```
npm run build:uil      # tách
npm run roundtrip      # kiểm tra dựng lại khớp file gốc
```

Kết quả hiện tại: **2593/2593 key khớp cả giá trị lẫn thứ tự.**

`assets/data/uil.json` (manifest) ghi `sha256` và `bytes` của file gốc, nên
`npm run validate` phát hiện được nếu file gốc bị đổi.
