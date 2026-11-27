// 美術館データの JSON 書き出し・読み込み（TMS 55〜57）。描画にも画面にも依存しない純粋な処理（Node のテストからも読む）。
// 読み込むときは、型・値の範囲を確かめたうえで**作り直す**（知らない項目は捨てる）。作品はライブラリにある id だけ。
// 任意の URL・HTML・スクリプトは受け付けない（CLAUDE.md の安全方針。データからは同梱の素材を id で選ぶだけ）。
// Node のテスト（tests/）から直接読むため、値の import には拡張子 .ts を付ける
import { ROOM_GRID, type ExhibitPlacement, type MuseumDocument, type MuseumStyle, type RoomPart, type Vec3 } from '../types/museum.ts';
import { findAsset } from './library.ts';

/** 読み込める JSON の大きさの上限（文字数）。サンプル美術館は 3KB ほど */
export const MAX_JSON_CHARS = 1_000_000;
const MAX_PARTS = 400;
const MAX_EXHIBITS = 60;
const MAX_TITLE = 60;
/** 座標の範囲：グリッド（±6m）に壁の厚さの余裕を足したもの */
const LIMIT = (ROOM_GRID.maxCells * ROOM_GRID.cell) / 2 + 0.5;

/** 書き出す形（読みやすいよう 2 文字字下げ）。保存（TMS 57）にも同じものを使う */
export function serializeMuseum(doc: MuseumDocument): string {
  const out: MuseumDocument = {
    schemaVersion: 1,
    id: doc.id,
    title: doc.title,
    objects: doc.objects.map((p) => ({ id: p.id, type: p.type, position: p.position, size: p.size, ...(p.color ? { color: p.color } : {}) })),
    exhibits: doc.exhibits.map((e) => ({
      id: e.id,
      assetId: e.assetId,
      type: e.type,
      mount: e.mount,
      position: e.position,
      rotationY: e.rotationY,
      ...(e.title ? { title: e.title } : {}),
      ...(e.description ? { description: e.description } : {}),
    })),
    ...(doc.style ? { style: doc.style } : {}),
  };
  return JSON.stringify(out, null, 2);
}

export type ParseResult = { ok: true; doc: MuseumDocument; warnings: string[] } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const vec3 = (v: unknown, min: number, max: number): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((x) => num(x, min, max));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const ID = /^[A-Za-z0-9_\-.]{1,64}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** JSON の文字列を確かめて美術館データにする。直せない問題は ok: false、飛ばした項目は warnings */
export function parseMuseum(json: string): ParseResult {
  if (json.length > MAX_JSON_CHARS) return { ok: false, error: 'ファイルが大きすぎます（1MB まで）' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON として読めませんでした' };
  }
  if (!isObj(raw)) return { ok: false, error: '美術館のデータではありません' };
  if (raw.schemaVersion !== 1) return { ok: false, error: '対応していない形式です（schemaVersion 1 のみ）' };
  if (!Array.isArray(raw.objects) || !Array.isArray(raw.exhibits)) return { ok: false, error: '床・壁（objects）と作品（exhibits）がありません' };
  if (raw.objects.length > MAX_PARTS) return { ok: false, error: `床・壁が多すぎます（${MAX_PARTS} 個まで）` };
  if (raw.exhibits.length > MAX_EXHIBITS) return { ok: false, error: `作品が多すぎます（${MAX_EXHIBITS} 点まで）` };

  const warnings: string[] = [];
  const ids = new Set<string>();
  const uniq = (id: unknown, fallback: string) => {
    let base = typeof id === 'string' && ID.test(id) ? id : fallback;
    for (let i = 2; ids.has(base); i++) base = `${fallback}-${i}`;
    ids.add(base);
    return base;
  };

  const objects: RoomPart[] = [];
  raw.objects.forEach((o, i) => {
    if (!isObj(o) || (o.type !== 'floor' && o.type !== 'wall' && o.type !== 'pedestal')) return warnings.push(`床・壁 ${i + 1} 番目：種類が不明なので飛ばしました`);
    if (!vec3(o.position, -LIMIT, LIMIT) || !vec3(o.size, 0.01, LIMIT * 2)) return warnings.push(`床・壁 ${i + 1} 番目：位置か大きさが範囲外なので飛ばしました`);
    objects.push({
      id: uniq(o.id, `${o.type}-${i}`),
      type: o.type,
      position: [...o.position] as Vec3,
      size: [...o.size] as Vec3,
      ...(typeof o.color === 'string' && COLOR.test(o.color) ? { color: o.color } : {}),
    });
  });

  const exhibits: ExhibitPlacement[] = [];
  raw.exhibits.forEach((e, i) => {
    const asset = isObj(e) && typeof e.assetId === 'string' ? findAsset(e.assetId) : undefined;
    if (!isObj(e) || !asset) return warnings.push(`作品 ${i + 1} 番目：同梱の作品にない id なので飛ばしました`);
    if (!vec3(e.position, -LIMIT, LIMIT) || !num(e.rotationY ?? 0, -100, 100)) return warnings.push(`作品 ${i + 1} 番目：位置か向きが範囲外なので飛ばしました`);
    const title = text(e.title, MAX_TITLE);
    const description = text(e.description, 2000);
    exhibits.push({
      id: uniq(e.id, `ex-${i}`),
      assetId: asset.id,
      type: asset.type, // 種類・置き方はライブラリの値を正とする
      mount: asset.mount,
      position: [...e.position] as Vec3,
      rotationY: typeof e.rotationY === 'number' ? e.rotationY : 0,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    });
  });

  // 雰囲気（色と光）。おかしな値なら無し（既定の雰囲気）にする
  let style: MuseumStyle | undefined;
  const st = raw.style;
  if (isObj(st) && typeof st.wall === 'string' && COLOR.test(st.wall) && typeof st.floor === 'string' && COLOR.test(st.floor) && num(st.light, 0.4, 1.6) && num(st.warmth, -1, 1)) {
    style = { wall: st.wall, floor: st.floor, light: st.light as number, warmth: st.warmth as number };
  } else if (st !== undefined) warnings.push('雰囲気（色と光）の値が正しくないので既定にしました');

  return {
    ok: true,
    doc: {
      ...(style ? { style } : {}),
      schemaVersion: 1,
      id: text(raw.id, 64) && ID.test(raw.id as string) ? (raw.id as string) : 'imported',
      title: text(raw.title, MAX_TITLE)?.trim() || '読み込んだ美術館',
      objects,
      exhibits,
    },
    warnings,
  };
}

/** ファイル名に使えるよう、美術館の名前と日付から作る（例 museum-サンプル美術館-2026-11-27.json） */
export function exportFileName(doc: MuseumDocument, date = new Date()) {
  const safe = doc.title.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'museum';
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `museum-${safe}-${d}.json`;
}
