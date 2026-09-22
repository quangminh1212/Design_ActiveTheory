#!/usr/bin/env node
/**
 * build-uil.mjs — Tách `uil.json` monolithic thành các module theo scene/shader.
 *
 * Nguồn : _scrape/uil.json  (2593 key, flattened key-value)
 * Đích  : assets/data/uil.json        (manifest + index)
 *         assets/data/uil/  (các module con, .json)
 *
 * NGUYÊN TẮC QUAN TRỌNG
 * ---------------------
 * Script này phân loại 1:1 — mỗi key nguồn đi vào ĐÚNG MỘT file đích, và
 * `merge-uil.mjs` dựng lại được file gốc deep-equal. Nếu bạn sửa bảng phân
 * loại ở đây, phải chạy `npm run roundtrip` để xác nhận vẫn khớp.
 *
 * Thứ tự phân loại có ý nghĩa: key nào khớp rule đầu tiên thì dừng, nên các
 * rule hẹp (shader, editor state) phải đứng TRƯỚC rule rộng (scene).
 *
 * Chạy: npm run build:uil  [-- --source <path> --out <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- tham số CLI

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const SRC = path.resolve(ROOT, args.source || '_scrape/uil.json');
const OUT = path.resolve(ROOT, args.out || 'assets/data');

// ------------------------------------------------------------------ phân loại

/**
 * Scene chuẩn hoá: key chứa token → slug file.
 * Thứ tự dài-trước-ngắn để `home_scene` không bị `Home` nuốt.
 */
const SCENE_RULES = [
  ['home_scene', 'home-scene'],
  ['work_page', 'work-page'],
  ['work_scene', 'work-scene'],
  ['WorkDetail', 'work-detail'],
  ['CleanRoom', 'clean-room'],
  ['TreeScene', 'tree-scene'],
  ['ParticleTest', 'particle-test'],
  ['particleTest', 'particle-test'],
  ['JellyfishDemo', 'jellyfish-demo'],
  ['ContactUs', 'contact-us'],
  ['Contact', 'contact'],
  ['Footer', 'footer'],
  ['About', 'about'],
];

/** Rule không theo scene — soi trước vì hẹp hơn. */
const KIND_RULES = [
  // Shader uniforms: "<Shader>/<Shader>/..." (có thể lồng "Shader/Shader/scene/uFoo")
  [/^[A-Za-z][\w./-]*\/[A-Za-z][\w./-]*\//, (k) => ({ bucket: 'shaders', name: shaderSlug(k) })],
  // Shader uniforms dạng dính liền, không có dấu "/": "homeParticleCurluCurlNoiseScale"
  // → gom theo tiền tố trước "u" viết hoa đầu tiên.
  [/^[a-z][A-Za-z0-9]*u[A-Z]/, (k) => ({ bucket: 'shaders', name: inlineShaderSlug(k) })],
  // Particle layer definitions: "P_Element_<id>_<Name>_code_list_items"
  [/^P_Element_\d+_.*_code_(list_items|config)$/, () => ({ bucket: 'editor', name: 'particle-layers' })],
  // Editor state
  [/^UIL_graph_/, () => ({ bucket: 'editor', name: 'editor' })],
  [/^UIL_P_/, () => ({ bucket: 'editor', name: 'editor' })],
  [/^LIST_/, () => ({ bucket: 'editor', name: 'editor' })],
  [/^UIL_/, () => ({ bucket: 'editor', name: 'editor' })],
  // Input config
  [/^INPUT_/, () => ({ bucket: 'inputs', name: 'inputs' })],
  // Mesh transform
  [/^MESH_/, () => ({ bucket: 'meshes', name: 'meshes' })],
  // Camera / shadow / group
  [/^CAMERA_/, () => ({ bucket: 'camera', name: 'camera' })],
  [/^SHADOW_/, () => ({ bucket: 'camera', name: 'camera' })],
  [/^GROUP_/, () => ({ bucket: 'camera', name: 'camera' })],
  [/^groupBridge_/, () => ({ bucket: 'camera', name: 'camera' })],
  // Lights / antimatter / scene-layout / post-process globals
  [/^L_/, () => ({ bucket: 'lights', name: 'lights' })],
  [/^am_/, () => ({ bucket: 'lights', name: 'lights' })],
  [/^sl_/, () => ({ bucket: 'lights', name: 'scene-layout' })],
  [/^(UnrealBloom|GlobalComposite|HomeComposite|WorkComposite|WorkPageComposite|TreeSceneComposite|CleanRoomComposite|VolumetricLight|SceneLayout|LightVolume|HomeSceneVFX)/,
    (k) => ({ bucket: 'lights', name: 'post-processing' })],
  // Texture refs bị mất prefix lúc scrape ("undefined_tx_tBaseColor")
  [/^(undefined_)?_?tx_/, () => ({ bucket: 'orphan', name: 'textures-orphan' })],
];

/** "WorkGlassShader/WorkGlassShader/uAlpha" → "work-glass" */
function shaderSlug(key) {
  const head = key.split('/')[0];
  return head
    .replace(/Shader$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'misc';
}

/**
 * "homeParticleCurluCurlNoiseScale" → "home-particle-curl"
 * Cắt tại "u" cuối cùng trước một chữ hoa (quy ước uniform của Three.js).
 */
function inlineShaderSlug(key) {
  const m = key.match(/^(.*?)u[A-Z]/);
  const head = m ? m[1] : key;
  return head
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'misc';
}

function classify(key) {
  for (const [re, fn] of KIND_RULES) {
    if (re.test(key)) return fn(key);
  }
  for (const [token, slug] of SCENE_RULES) {
    if (key.includes(token)) return { bucket: 'scenes', name: slug };
  }
  // Còn lại: camera/global scene token dạng CamelCase (Home*, Work*)
  if (/Home[A-Z]/.test(key)) return { bucket: 'camera', name: 'camera' };
  if (/Work[A-Z]/.test(key)) return { bucket: 'camera', name: 'camera' };
  return { bucket: 'orphan', name: 'orphan' };
}

// --------------------------------------------------------------- thực thi

const raw = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(raw);
const sourceKeys = Object.keys(data);

// Ghi file
//
// Thứ tự key trong mỗi module giữ nguyên thứ tự xuất hiện trong file gốc, và
// manifest ghi lại thứ tự module theo key đầu tiên của nó. Nhờ vậy
// merge-uil.mjs dựng lại được ĐÚNG thứ tự key gốc → diff sạch, roundtrip chặt.
const buckets = new Map();      // id -> object các key
const index = new Map();        // bucket -> [{name, keys, path}]
const firstKeyOrder = new Map(); // id -> index của key đầu tiên
let orphanCount = 0;

// Tra cứu O(1) thay vì indexOf trong vòng lặp (2593 key)
const keyPosition = new Map(sourceKeys.map((k, i) => [k, i]));

for (const key of sourceKeys) {
  const { bucket, name } = classify(key);
  if (bucket === 'orphan') orphanCount++;

  const id = `${bucket}/${name}`;
  if (!buckets.has(id)) {
    buckets.set(id, {});
    firstKeyOrder.set(id, keyPosition.get(key));
  }
  buckets.get(id)[key] = data[key];
}

const written = [];
for (const [id, obj] of [...buckets.entries()].sort(
  ([a], [b]) => firstKeyOrder.get(a) - firstKeyOrder.get(b),
)) {
  const [bucket, name] = id.split('/');
  const dir = bucket === 'shaders'
    ? path.join(OUT, 'uil', 'shaders')
    : bucket === 'scenes'
      ? path.join(OUT, 'uil', 'scenes')
      : path.join(OUT, 'uil');
  fs.mkdirSync(dir, { recursive: true });

  const rel = path.relative(OUT, path.join(dir, `${name}.json`)).split(path.sep).join('/');
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(obj, null, 2) + '\n');

  written.push({ bucket, name, keys: Object.keys(obj).length, path: rel });
  if (!index.has(bucket)) index.set(bucket, []);
  index.get(bucket).push({
    bucket,
    name,
    keys: Object.keys(obj).length,
    path: rel,
  });
}

// Manifest
//
// `keyOrder` là mảng tên key theo ĐÚNG thứ tự gốc. Đây là thứ cho phép
// merge-uil.mjs dựng lại byte-identical thứ tự, kể cả khi các module đan xen
// nhau (vd `CAMERA_*` nằm rải rác khắp file). Tốn ~60KB nhưng đổi lấy
// roundtrip chặt — đáng.
const manifest = {
  $schema: './uil.schema-note.json',
  description:
    'Manifest cho UIL config đã tách module. File gốc là một object phẳng ' +
    '2593 key; các module con hợp lại (deep-equal) tái tạo chính xác file gốc.',
  source: {
    path: path.relative(ROOT, SRC).split(path.sep).join('/'),
    bytes: Buffer.byteLength(raw),
    keys: sourceKeys.length,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  },
  totals: {
    modules: written.length,
    keys: written.reduce((n, w) => n + w.keys, 0),
    orphans: orphanCount,
  },
  modules: Object.fromEntries(
    [...index.entries()].sort(([, a], [, b]) =>
      firstKeyOrder.get(`${a[0].bucket}/${a[0].name}`) -
      firstKeyOrder.get(`${b[0].bucket}/${b[0].name}`)),
  ),
  // Thứ tự key tuyệt đối của file gốc — nguồn chân lý cho merge.
  keyOrder: sourceKeys,
  note:
    'Chạy `npm run merge:uil` để dựng lại file gốc, ' +
    '`npm run roundtrip` để kiểm tra tính toàn vẹn.',
};

fs.writeFileSync(path.join(OUT, 'uil.json'), JSON.stringify(manifest, null, 2) + '\n');

// Báo cáo
console.log(`Nguồn : ${path.relative(ROOT, SRC)} (${sourceKeys.length} key, ${Buffer.byteLength(raw)} bytes)`);
console.log(`Đích  : ${path.relative(ROOT, OUT)}`);
console.log('');
for (const [bucket, items] of [...index.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const total = items.reduce((n, i) => n + i.keys, 0);
  console.log(`  ${bucket.padEnd(10)} ${String(items.length).padStart(3)} file  ${String(total).padStart(5)} key`);
}
console.log('');
console.log(`Tổng  : ${written.length} module, ${written.reduce((n, w) => n + w.keys, 0)} key`);
if (orphanCount) {
  console.log(`Cảnh báo: ${orphanCount} key rơi vào bucket "orphan" — xem ${path.relative(ROOT, path.join(OUT, 'uil', 'orphan.json'))}`);
}
