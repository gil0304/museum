#!/usr/bin/env node
// 公開前に dist/ を点検する（TMS 30）。依存パッケージなし。
// ロリポップ！デプロイナウの静的サイトは「アップロードしたフォルダがそのまま公開」されるため、
// dist/ だけで完結しているか・上限内か・秘密情報が混ざっていないかを確認する。
// 使い方: npm run build && npm run verify:dist   （失敗時は終了コード 1）
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// URL.pathname は日本語のパスを %エンコードのまま返すので fileURLToPath を使う
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const LIMIT_BYTES = 100 * 1024 * 1024; // デプロイナウ Free プランのデプロイ上限
const WARN_BYTES = 30 * 1024 * 1024; // 体験の快適さのための目安
const TEXT_EXT = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg', '.map', '.md']);
const SECRET_PATTERNS = [
  /client_secret/i,
  /refresh_token"\s*:/i,
  /ya29\.[0-9A-Za-z_-]{20,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{30,}/,
  /sk-[A-Za-z0-9]{30,}/,
];

const errors = [];
const warnings = [];

if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST);
let total = 0;
const byExt = new Map();

for (const file of files) {
  const rel = relative(DIST, file);
  const size = statSync(file).size;
  total += size;
  const ext = extname(file).toLowerCase() || '(なし)';
  byExt.set(ext, (byExt.get(ext) ?? 0) + size);

  if (rel.split('/').some((seg) => seg.startsWith('.'))) {
    warnings.push(`「.」で始まるファイルは公開されない: ${rel}`);
  }
  if (!TEXT_EXT.has(ext)) continue;
  const text = readFileSync(file, 'utf8');
  for (const re of SECRET_PATTERNS) {
    if (re.test(text)) errors.push(`秘密情報の可能性（${re}）: ${rel}`);
  }
  if (ext === '.html') {
    if (/(src|href)="\/src\//.test(text)) errors.push(`ビルドされていないソースを参照している: ${rel}`);
    // ルート基準の絶対パスは、サブパスで配信されると壊れる（vite.config.ts の base: './' で相対にしている）
    const abs = [...text.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
    if (abs.length) errors.push(`ルート基準の絶対パス参照: ${rel} → ${abs.join(', ')}`);
  }
}

if (!existsSync(join(DIST, 'index.html'))) errors.push('dist/index.html がない（ルートURLが404になる）');
if (total > LIMIT_BYTES) errors.push(`合計サイズ ${mb(total)} がデプロイ上限 100MB を超えている`);
else if (total > WARN_BYTES) warnings.push(`合計サイズ ${mb(total)} が目安 30MB を超えている（読み込みが重くなる）`);

function mb(n) {
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

console.log(`dist/ 点検: ${files.length} ファイル / 合計 ${mb(total)}（上限 100MB）`);
for (const [ext, size] of [...byExt].sort((a, b) => b[1] - a[1])) console.log(`  ${ext.padEnd(8)} ${mb(size)}`);
for (const w of warnings) console.log(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) process.exit(1);
console.log('✓ 公開可能（index.html あり・相対パス・上限内・秘密情報なし）');
