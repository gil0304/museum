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
    if (!a || a.mount !== 'floor' || a.walkable) continue; // ラグなど上を歩ける物は除く
    // 台座・置き物の床の上の四角（幅×奥行き）を回して、それを囲む軸に沿った四角にする
    const [fw, fd] = a.footprint ?? [a.size[0], a.size[0]];
    const c = Math.abs(Math.cos(p.rotationY));
    const sn = Math.abs(Math.sin(p.rotationY));
    const h = a.type === 'object' ? a.size[1] : PEDESTAL_HEIGHT;
    out.push({ id: `obstacle-${p.id}`, type: 'pedestal', position: [p.position[0], h / 2, p.position[2]], size: [fw * c + fd * sn, h, fw * sn + fd * c] });
  }
  return out;
}

