// 床・壁の通り抜け防止（TMS 38）。美術館データの床・壁・展示台から、上から見た四角形（XZ）の当たり判定を作る。
// 鑑賞者は半径 BODY_RADIUS の円として扱い、壁・展示台に重ならず、床の上からはみ出さないように動く。
// ぶつかったときは動けない向きの成分だけ止め、壁に沿って滑る。three.js の描画には依存しない純粋な計算。
import type { MuseumDocument, RoomPart } from '../types/museum';
import type { MoveConstraint } from './firstPersonControls';

/** 体の半径（m）。壁に掛けた作品（壁から約 0.2m 手前まで出る）に顔がめり込まない大きさ */
export const BODY_RADIUS = 0.35;

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const rectOf = ({ position: [x, , z], size: [w, , d] }: RoomPart): Rect => ({
  minX: x - w / 2,
  maxX: x + w / 2,
  minZ: z - d / 2,
  maxZ: z + d / 2,
});

/** 円（中心 x, z）が四角形に重なるか */
function circleHitsRect(x: number, z: number, r: number, rect: Rect) {
  const nx = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nz = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return (x - nx) ** 2 + (z - nz) ** 2 < r * r;
}

const inside = (x: number, z: number, rect: Rect) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;

export interface Collider {
  /** その位置に立てるか（床の上で、壁・展示台に重ならない） */
  canStand(x: number, z: number): boolean;
  /** 一人称の移動に渡す補正 */
  constrain: MoveConstraint;
}

export function createCollider(doc: MuseumDocument, radius = BODY_RADIUS): Collider {
  const floors = doc.objects.filter((p) => p.type === 'floor').map(rectOf);
  const obstacles = doc.objects.filter((p) => p.type === 'wall' || p.type === 'pedestal').map(rectOf);

  // 床は複数のマスに分かれていてもよい（つなぎ目で止まらないよう、中心点が床のどれかの上にあれば立てる）
  const onFloor = (x: number, z: number) => floors.length === 0 || floors.some((f) => inside(x, z, f));
  const blocked = (x: number, z: number) => obstacles.some((o) => circleHitsRect(x, z, radius, o));
  const canStand = (x: number, z: number) => onFloor(x, z) && !blocked(x, z);

  const constrain: MoveConstraint = (from, to) => {
    const [fx, fy, fz] = from;
    const [tx, , tz] = to;
    // 編集で壁を置いた・読み込んだデータなどで、すでに埋まっている位置からは自由に出られるようにする
    if (!canStand(fx, fz)) return to;
    if (canStand(tx, tz)) return to;
    // 壁に沿って滑る：X だけ、Z だけの移動を試す。どちらも無理なら、ぶつかる直前まで詰める
    if (canStand(tx, fz)) return [tx, fy, approach(tx, fz, tx, tz, false)];
    if (canStand(fx, tz)) return [approach(fx, tz, tx, tz, true), fy, tz];
    const x = approach(fx, fz, tx, fz, true);
    return [x, fy, approach(x, fz, x, tz, false)];
  };

  /**
   * (sx, sz) から片方の軸だけ目標へ近づけ、立てる範囲でいちばん近い値を返す（二分探索 8 回 ≒ 1 フレームの移動の 1/256 の精度）。
   * 1 歩の大きさに関係なく、壁にぴったり寄れるようにする。
   */
  function approach(sx: number, sz: number, tx: number, tz: number, alongX: boolean): number {
    const start = alongX ? sx : sz;
    const goal = alongX ? tx : tz;
    if (canStand(alongX ? goal : sx, alongX ? sz : goal)) return goal;
    let ok = start;
    let ng = goal;
    for (let i = 0; i < 8; i++) {
      const mid = (ok + ng) / 2;
      if (canStand(alongX ? mid : sx, alongX ? sz : mid)) ok = mid;
      else ng = mid;
    }
    return ok;
  }

  return { canStand, constrain };
}
