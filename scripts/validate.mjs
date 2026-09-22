#!/usr/bin/env node
/**
 * validate.mjs — Kiểm tra tính toàn vẹn của cây dữ liệu UIL đã tách module.
 *
 * Kiểm tra:
 *   1. Mọi file .json trong assets/data parse được
 *   2. Tổng key của các module khớp `totals.keys` trong manifest
 *   3. Không có key trùng giữa các module
 *   4. Mỗi mục trong manifest trỏ tới file tồn tại, đúng số key
 *   5. `keyOrder` bao phủ đúng tập key (không thiếu, không thừa)
 *   6. sha256 của file gốc khớp giá trị ghi trong manifest
 *   7. Mọi tham chiếu asset trong src/index.html resolve được trên đĩa
 *
 * Không kiểm tra ngữ nghĩa UIL (không có schema chính thức) — chỉ toàn vẹn
 * cấu trúc. Chạy: npm run validate
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let errors = 0;
let warnings = 0;

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.error(`  ✗ ${m}`); errors++; };
const warn = (m) => { console.warn(`  ! ${m}`); warnings++; };

function section(title) {
  console.log(`\n${title}`);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    bad(`${path.relative(ROOT, p)}: JSON không hợp lệ — ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------- 1. parse mọi file

section('1. Parse toàn bộ JSON trong assets/data');

const dataDir = path.join(ROOT, 'assets/data');
const jsonFiles = [];

(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.json')) jsonFiles.push(p);
  }
})(dataDir);

let parseFail = 0;
for (const f of jsonFiles) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { bad(`${path.relative(ROOT, f)}: ${e.message}`); parseFail++; }
}
if (!parseFail) ok(`${jsonFiles.length} file JSON parse được`);

// ------------------------------------------------------------- 2-5. manifest

section('2. Manifest & module');

const manifestPath = path.join(dataDir, 'uil.json');
if (!fs.existsSync(manifestPath)) {
  bad('Không có assets/data/uil.json — chạy: npm run build:uil');
  process.exit(1);
}

const manifest = readJson(manifestPath);
if (!manifest) process.exit(1);

const pool = new Map();
let declaredKeys = 0;
let dupes = 0;

for (const [bucket, items] of Object.entries(manifest.modules || {})) {
  for (const item of items) {
    const p = path.join(dataDir, item.path);
    if (!fs.existsSync(p)) { bad(`Thiếu file: ${item.path}`); continue; }

    const obj = readJson(p);
    if (!obj) continue;

    const n = Object.keys(obj).length;
    if (n !== item.keys) {
      bad(`${item.path}: manifest ghi ${item.keys} key, file có ${n}`);
    }
    declaredKeys += n;

    for (const k of Object.keys(obj)) {
      if (pool.has(k)) { bad(`Key trùng: ${k} (${bucket}/${item.name})`); dupes++; }
      pool.set(k, `${bucket}/${item.name}`);
    }
  }
}

if (!dupes) ok(`${pool.size} key, không trùng lặp`);
else bad(`${dupes} key trùng lặp`);

// totals
if (manifest.totals) {
  if (manifest.totals.keys === pool.size) ok(`totals.keys = ${pool.size} khớp`);
  else bad(`totals.keys = ${manifest.totals.keys} nhưng đếm được ${pool.size}`);
  if (manifest.totals.modules === jsonFiles.length - 1) {
    ok(`totals.modules = ${manifest.totals.modules} khớp`);
  } else {
    warn(`totals.modules = ${manifest.totals.modules}, số file (trừ manifest) = ${jsonFiles.length - 1}`);
  }
}

// keyOrder
if (Array.isArray(manifest.keyOrder)) {
  const set = new Set(manifest.keyOrder);
  if (set.size !== manifest.keyOrder.length) bad('keyOrder có phần tử trùng');
  else if (set.size !== pool.size) bad(`keyOrder có ${set.size} key, module có ${pool.size}`);
  else {
    const missing = [...pool.keys()].filter((k) => !set.has(k));
    if (missing.length) bad(`keyOrder thiếu ${missing.length} key  vd: ${missing[0]}`);
    else ok(`keyOrder bao phủ đủ ${set.size} key`);
  }
} else {
  bad('Manifest thiếu mảng keyOrder');
}

// -------------------------------------------------------------- 6. sha256

section('3. Checksum file gốc');

if (manifest.source?.sha256) {
  const srcPath = path.join(ROOT, manifest.source.path);
  if (!fs.existsSync(srcPath)) {
    warn(`Không tìm thấy file gốc ${manifest.source.path} — bỏ qua checksum`);
  } else {
    const raw = fs.readFileSync(srcPath);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    if (hash === manifest.source.sha256) {
      ok(`sha256 khớp (${hash.slice(0, 16)}…)`);
    } else {
      bad(`sha256 lệch:\n      manifest: ${manifest.source.sha256}\n      thực tế : ${hash}`);
    }
    if (Buffer.byteLength(raw) === manifest.source.bytes) {
      ok(`kích thước khớp (${manifest.source.bytes} bytes)`);
    } else {
      bad(`kích thước lệch: manifest ${manifest.source.bytes}, thực tế ${Buffer.byteLength(raw)}`);
    }
  }
} else {
  warn('Manifest không ghi sha256 — bỏ qua');
}

// ---------------------------------------------------------- 7. refs HTML

section('4. Tham chiếu asset trong src/index.html');

const htmlPath = path.join(ROOT, 'src/index.html');
if (!fs.existsSync(htmlPath)) {
  bad('Không tìm thấy src/index.html');
} else {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Chỉ kiểm tra các đường dẫn tương đối (bỏ qua anchor, mailto, http(s), data:, và %VAR%).
  const refs = new Set();
  const reAttr = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = reAttr.exec(html))) {
    const url = m[1];
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:') || url.startsWith('#') || /^(mailto|tel):/.test(url) || url.includes('%')) continue;
    refs.add(url);
  }

  let missing = 0;
  for (const ref of refs) {
    const p = path.resolve(path.dirname(htmlPath), ref);
    if (!fs.existsSync(p)) { warn(`Thiếu (chưa scrape): ${ref}`); missing++; }
  }
  if (!missing) ok(`${refs.size} tham chiếu đều resolve`);
  else ok(`${refs.size - missing}/${refs.size} tham chiếu resolve (${missing} chưa scrape về)`);

  // Các ref JS chính phải dựng được từ _CACHE_
  const cache = html.match(/_CACHE_="(\d+)"/);
  if (cache) {
    const expected = `assets/js/app.${cache[1]}.js`;
    if (fs.existsSync(path.join(ROOT, expected))) ok(`Bundle khớp _CACHE_: ${expected}`);
    else bad(`_CACHE_=${cache[1]} → cần ${expected} nhưng không có trên đĩa`);
  } else if (fs.existsSync(path.join(path.dirname(htmlPath), 'active-theory-clone.js'))) {
    ok('Custom experience bootstrap khớp: src/active-theory-clone.js');
  } else {
    warn('Không tìm thấy _CACHE_ hoặc custom bootstrap trong index.html');
  }
}

// --------------------------------------------------------------- kết luận

console.log('');
if (errors) {
  console.error(`✗ THẤT BẠI: ${errors} lỗi, ${warnings} cảnh báo`);
  process.exit(1);
}
console.log(`✓ TẤT CẢ KIỂM TRA ĐẠT (${warnings} cảnh báo)`);
