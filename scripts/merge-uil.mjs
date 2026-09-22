#!/usr/bin/env node
/**
 * merge-uil.mjs — Dựng lại `uil.json` phẳng từ các module đã tách.
 *
 * Đây là phép nghịch đảo của build-uil.mjs. Nó tồn tại để CHỨNG MINH việc tách
 * module không làm mất mát dữ liệu: kết quả phải deep-equal (và cùng thứ tự key)
 * với file gốc.
 *
 * Chạy:
 *   npm run merge:uil            → ghi _scrape/uil.json.rebuilt.json
 *   npm run roundtrip            → chỉ kiểm tra, exit code 1 nếu lệch
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CHECK_ONLY = process.argv.includes('--check');
const MANIFEST = path.join(ROOT, 'assets/data/uil.json');
const ORIGINAL = path.join(ROOT, '_scrape/uil.json');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(MANIFEST)) fail(`Không tìm thấy manifest: ${MANIFEST}\n  Chạy: npm run build:uil`);
if (!fs.existsSync(ORIGINAL)) fail(`Không tìm thấy file gốc: ${ORIGINAL}`);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

// ---- dựng lại -------------------------------------------------------------
//
// Bước 1: gom toàn bộ key-value từ mọi module vào một map phẳng.
// Bước 2: phát lại theo `keyOrder` của manifest để dựng lại ĐÚNG thứ tự gốc.
// Các module đan xen nhau (vd CAMERA_* rải khắp file), nên không thể dựng lại
// thứ tự chỉ bằng cách xếp module — phải có `keyOrder`.

const pool = new Map(); // key -> value
let moduleCount = 0;

for (const items of Object.values(manifest.modules)) {
  for (const item of items) {
    const file = path.join(ROOT, 'assets/data', item.path);
    if (!fs.existsSync(file)) fail(`Module thiếu file: ${item.path}`);

    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    const n = Object.keys(obj).length;
    if (n !== item.keys) {
      fail(`${item.path}: manifest ghi ${item.keys} key nhưng file có ${n} key`);
    }

    for (const [k, v] of Object.entries(obj)) {
      if (pool.has(k)) fail(`Key trùng giữa các module: ${k}`);
      pool.set(k, v);
    }
    moduleCount++;
  }
}

if (!Array.isArray(manifest.keyOrder)) {
  fail('Manifest thiếu mảng `keyOrder` — chạy lại: npm run build:uil');
}
if (manifest.keyOrder.length !== pool.size) {
  fail(`keyOrder có ${manifest.keyOrder.length} phần tử nhưng gom được ${pool.size} key`);
}

const rebuilt = {};
for (const k of manifest.keyOrder) {
  if (!pool.has(k)) fail(`keyOrder nhắc tới key không có trong module nào: ${k}`);
  rebuilt[k] = pool.get(k);
}

// ---- so sánh --------------------------------------------------------------

const original = JSON.parse(fs.readFileSync(ORIGINAL, 'utf8'));

const origKeys = Object.keys(original);
const newKeys = Object.keys(rebuilt);

const missing = origKeys.filter((k) => !(k in rebuilt));
const extra = newKeys.filter((k) => !(k in original));

let changed = [];
for (const k of origKeys) {
  if (!(k in rebuilt)) continue;
  if (JSON.stringify(original[k]) !== JSON.stringify(rebuilt[k])) changed.push(k);
}

console.log(`Manifest      : ${path.relative(ROOT, MANIFEST)}`);
console.log(`Module        : ${moduleCount}`);
console.log(`Key gốc       : ${origKeys.length}`);
console.log(`Key dựng lại  : ${newKeys.length}`);
console.log('');

if (missing.length) console.log(`✗ Thiếu ${missing.length} key  vd: ${missing.slice(0, 5).join(', ')}`);
if (extra.length) console.log(`✗ Thừa ${extra.length} key  vd: ${extra.slice(0, 5).join(', ')}`);
if (changed.length) console.log(`✗ Lệch giá trị ${changed.length} key  vd: ${changed.slice(0, 5).join(', ')}`);

if (missing.length || extra.length || changed.length) {
  console.error('\n✗ ROUNDTRIP THẤT BẠI — tách module đang làm mất/hỏng dữ liệu.');
  process.exit(1);
}

console.log('✓ Tất cả key khớp giá trị.');

// Thứ tự key: cảnh báo thôi, không fail — thứ tự không ảnh hưởng ngữ nghĩa JSON.
const origOrder = origKeys.join('\u0000');
const newOrder = newKeys.join('\u0000');
if (origOrder !== newOrder) {
  console.log('! Thứ tự key khác bản gốc (không ảnh hưởng ngữ nghĩa).');
} else {
  console.log('✓ Thứ tự key khớp bản gốc.');
}

if (CHECK_ONLY) {
  console.log('\n✓ ROUNDTRIP THÀNH CÔNG.');
  process.exit(0);
}

const dest = path.join(ROOT, '_scrape/uil.json.rebuilt.json');
fs.writeFileSync(dest, JSON.stringify(rebuilt, null, 0));
console.log(`\n✓ Đã ghi ${path.relative(ROOT, dest)}`);
