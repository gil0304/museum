#!/usr/bin/env node
// src/ のフォルダ間の依存ルールを点検する（TMS 31）。依存パッケージなし。
// ルールの正本は docs/ARCHITECTURE.md の「フォルダと依存ルール」。違反があれば終了コード 1。
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

// フォルダごとに import してよい相手（同じフォルダ内は常に可）。'three' は外部パッケージ。
// 表に無いフォルダ（spikes など）と src 直下（main.ts）は制限しない。
const ALLOW = {
  types: [],
  data: ['types'],
  ui: ['types'],
  scene: ['types', 'three'],
  exhibits: ['types', 'scene', 'three'],
  editor: ['types', 'scene', 'exhibits', 'data', 'three'],
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(ts|tsx|mts)$/.test(d.name) ? [p] : [];
  });
}

const topOf = (file) => {
  const rel = relative(SRC, file).split(sep);
  return rel.length > 1 ? rel[0] : '(root)';
};

const violations = [];
let checked = 0;
for (const file of walk(SRC)) {
  const from = topOf(file);
  const allow = ALLOW[from];
  if (!allow) continue;
  checked++;
  const text = readFileSync(file, 'utf8');
  // import ... from '...'; / import '...'; / export ... from '...'; / import('...')
  const specs = [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1] ?? m[2],
  );
  for (const spec of specs) {
    let target;
    if (spec.startsWith('.')) {
      const abs = resolve(dirname(file), spec);
      if (!abs.startsWith(SRC)) continue;
      target = topOf(abs.endsWith('.ts') ? abs : abs + '.ts');
      if (target === '(root)') target = 'main';
    } else {
      target = spec.split('/')[0];
    }
    if (target === from || allow.includes(target)) continue;
    violations.push(`${relative(SRC, file)}: ${from}/ から ${target} を import している（'${spec}'）`);
  }
}

console.log(`依存ルール点検: ${checked} ファイル`);
for (const v of violations) console.error(`✗ ${v}`);
if (violations.length) process.exit(1);
console.log('✓ 違反なし（types ← data / ui / scene ← main）');
