// 床・壁の通り抜け防止（TMS 38）の自動テスト。npm test で実行（Node の型除去機能で .ts を直接読む）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollider, BODY_RADIUS } from '../src/scene/collision.ts';
import { sampleMuseum } from '../src/data/sampleMuseum.ts';
import type { MuseumDocument } from '../src/types/museum.ts';

type P = [number, number, number];
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-3, `${a} ≒ ${b}`);

function walk(doc: MuseumDocument, start: P, dx: number, dz: number, steps = 300): P {
  const c = createCollider(doc);
  let pos = start;
  for (let i = 0; i < steps; i++) pos = c.constrain(pos, [pos[0] + dx, pos[1], pos[2] + dz]);
  return pos;
}

test('壁の内面から体の半径だけ手前で止まる（奥・右・手前）', () => {
  near(walk(sampleMuseum, [0, 1.6, 2.2], 0, -0.06)[2], -3.9 + BODY_RADIUS);
  near(walk(sampleMuseum, [0, 1.6, 2.2], 0.06, 0)[0], 4.9 - BODY_RADIUS);
  near(walk(sampleMuseum, [0, 1.6, 2.2], 0, 0.06)[2], 3.9 - BODY_RADIUS);
});

test('展示台も通り抜けない', () => {
  near(walk(sampleMuseum, [2.65, 1.6, 2.5], 0, -0.06)[2], 1.275 + BODY_RADIUS);
});

test('斜めにぶつかると壁に沿って滑る', () => {
  const p = walk(sampleMuseum, [0, 1.6, 2.2], 0.03, -0.05, 200);
  near(p[0], 4.9 - BODY_RADIUS);
  near(p[2], -3.9 + BODY_RADIUS);
});

test('1 フレームの最大移動（速歩き 3.4m/s × 0.05s）でも壁を抜けない', () => {
  const c = createCollider(sampleMuseum);
  const p = c.constrain([0, 1.6, 3.5], [0, 1.6, 3.67]);
  assert.ok(p[2] <= 3.9 - BODY_RADIUS + 1e-9);
});

test('壁の無い床だけの部屋では床の端で止まる', () => {
  const floorOnly = { ...sampleMuseum, objects: sampleMuseum.objects.filter((o) => o.type === 'floor') };
  near(walk(floorOnly, [0, 1.6, 0], 0.06, 0)[0], 5);
});

test('すでに壁に埋まっている位置からは出られる', () => {
  const c = createCollider(sampleMuseum);
  assert.deepEqual(c.constrain([0, 1.6, -4], [0, 1.6, -3.8]), [0, 1.6, -3.8]);
});

test('目の高さ（Y）は変えない', () => {
  assert.equal(walk(sampleMuseum, [0, 1.6, 2.2], 0.05, -0.05)[1], 1.6);
});
