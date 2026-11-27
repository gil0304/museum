// 床・壁の通り抜け防止（TMS 38）の自動テスト。npm test で実行（Node の型除去機能で .ts を直接読む）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollider, BODY_RADIUS } from '../src/scene/collision.ts';
import { sampleMuseum } from '../src/data/sampleMuseum.ts';
import { findAsset } from '../src/data/library.ts';
import { exhibitObstacles } from '../src/exhibits/obstacles.ts';
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

test('床の作品の台座も通り抜けない（TMS 44 から台座は作品に付属）', () => {
  const extra = exhibitObstacles(sampleMuseum, findAsset);
  assert.equal(extra.length, 1);
  const c = createCollider(sampleMuseum, extra);
  const [px, , pz] = extra[0].position;
  const half = extra[0].size[2] / 2;
  let pos: P = [px, 1.6, 2.5];
  for (let i = 0; i < 300; i++) pos = c.constrain(pos, [pos[0], pos[1], pos[2] - 0.06]);
  near(pos[2], pz + half + BODY_RADIUS);
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

test('置き物はぶつかる（回転した大きさで）。ラグは上を歩ける', () => {
  const doc = {
    ...sampleMuseum,
    exhibits: [
      { id: 'b', assetId: 'obj-bench', type: 'object' as const, mount: 'floor' as const, position: [0, 0, 0] as P, rotationY: Math.PI / 2 },
      { id: 'r', assetId: 'obj-rug', type: 'object' as const, mount: 'floor' as const, position: [2, 0, 0] as P, rotationY: 0 },
    ],
  };
  const extra = exhibitObstacles(doc, findAsset);
  assert.equal(extra.length, 1); // ラグは障害物にならない
  near(extra[0].size[0], 0.5); // 90° 回したベンチ：幅 0.5 × 奥行き 1.6
  near(extra[0].size[2], 1.6);
});
