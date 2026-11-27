// 床の作品の台座の当たり判定（TMS 38・44）。three.js や DOM に依存しない計算だけ（Node のテストからも読む）。
import type { ExhibitAsset, MuseumDocument, RoomPart } from '../types/museum';

/** 床の作品の台座の高さ（m） */
export const PEDESTAL_HEIGHT = 0.85;

export type ResolveAssetFn = (id: string) => ExhibitAsset | undefined;

/** 床の作品の台座を、当たり判定用の箱として返す（通り抜け防止。TMS 38） */
export function exhibitObstacles(doc: MuseumDocument, resolve: ResolveAssetFn): RoomPart[] {
  const out: RoomPart[] = [];
  for (const p of doc.exhibits) {
    const a = resolve(p.assetId);
    if (!a || a.mount !== 'floor') continue;
    // 回した正方形の台座を囲む軸に沿った正方形（一辺 = 幅 ×（|cos| + |sin|））
    const w = a.size[0] * (Math.abs(Math.cos(p.rotationY)) + Math.abs(Math.sin(p.rotationY)));
    out.push({ id: `obstacle-${p.id}`, type: 'pedestal', position: [p.position[0], PEDESTAL_HEIGHT / 2, p.position[2]], size: [w, PEDESTAL_HEIGHT, w] });
  }
  return out;
}

