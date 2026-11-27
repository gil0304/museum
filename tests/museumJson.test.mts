// 美術館データの JSON 書き出し・読み込み（TMS 55〜57）の自動テスト。npm test で実行
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMuseum, serializeMuseum, exportFileName } from '../src/data/museumJson.ts';
import { sampleMuseum } from '../src/data/sampleMuseum.ts';
import { emptyRoom } from '../src/data/emptyRoom.ts';

test('書き出して読み込むと同じ美術館に戻る（サンプル・空の部屋）', () => {
  for (const doc of [sampleMuseum, emptyRoom]) {
    const r = parseMuseum(serializeMuseum(doc));
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(JSON.parse(serializeMuseum(r.doc)), JSON.parse(serializeMuseum(doc)));
  }
});

test('壊れた JSON・形式違いは読み込まない（理由つき）', () => {
  for (const bad of ['{', '[]', 'null', '{"schemaVersion":2,"objects":[],"exhibits":[]}', '{"schemaVersion":1}']) {
    const r = parseMuseum(bad);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.ok(r.error.length > 0);
  }
});

test('同梱にない作品・範囲外の位置は飛ばし、警告を返す', () => {
  const doc = JSON.parse(serializeMuseum(sampleMuseum));
  doc.exhibits.push({ id: 'x', assetId: 'https://evil.example/a.html', type: 'interactive-html', mount: 'wall', position: [0, 1, 0], rotationY: 0 });
  doc.exhibits.push({ id: 'y', assetId: 'toString', type: 'image', mount: 'wall', position: [0, 1, 0], rotationY: 0 });
  doc.objects.push({ id: 'far', type: 'wall', position: [999, 0, 0], size: [1, 1, 1] });
  const r = parseMuseum(JSON.stringify(doc));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.doc.exhibits.length, sampleMuseum.exhibits.length);
  assert.equal(r.doc.objects.length, sampleMuseum.objects.length);
  assert.equal(r.warnings.length, 3);
});

test('知らない項目は捨て、種類・置き方はライブラリの値に直す', () => {
  const doc = JSON.parse(serializeMuseum(sampleMuseum));
  doc.extra = '<script>alert(1)</script>';
  doc.exhibits[0].onclick = 'alert(1)';
  doc.exhibits[0].type = 'image'; // 本当は interactive-html
  doc.objects[0].color = 'red; background:url(x)';
  const r = parseMuseum(JSON.stringify(doc));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal('extra' in r.doc, false);
  assert.equal('onclick' in r.doc.exhibits[0], false);
  assert.equal(r.doc.exhibits[0].type, 'interactive-html');
  assert.equal(r.doc.objects[0].color, undefined);
});

test('id の重複は付け直し、題名は 60 文字までに切る', () => {
  const doc = JSON.parse(serializeMuseum(sampleMuseum));
  doc.objects[1].id = doc.objects[0].id;
  doc.title = 'あ'.repeat(100);
  const r = parseMuseum(JSON.stringify(doc));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.notEqual(r.doc.objects[0].id, r.doc.objects[1].id);
  assert.equal(r.doc.title.length, 60);
});

test('大きすぎるファイルは読み込まない', () => {
  const r = parseMuseum(' '.repeat(1_000_001));
  assert.equal(r.ok, false);
});

test('書き出しのファイル名', () => {
  assert.equal(exportFileName(sampleMuseum, new Date(2026, 10, 27)), 'museum-サンプル美術館-2026-11-27.json');
});

test('雰囲気（色と光）を書き出して読み込める。おかしな値は既定に戻して警告', () => {
  const doc = { ...sampleMuseum, style: { wall: '#3a3d45', floor: '#26262b', light: 0.55, warmth: -0.45 } };
  const r = parseMuseum(serializeMuseum(doc));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.doc.style, doc.style);
  const bad = JSON.parse(serializeMuseum(doc));
  bad.style.light = 99;
  const r2 = parseMuseum(JSON.stringify(bad));
  assert.ok(r2.ok);
  if (!r2.ok) return;
  assert.equal(r2.doc.style, undefined);
  assert.equal(r2.warnings.length, 1);
});
