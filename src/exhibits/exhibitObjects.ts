// 作品の 3D 表示（TMS 44〜53）。美術館データの配置（ExhibitPlacement）と作品ライブラリ（ExhibitAsset）から
// 種類ごとの表示物を作る。座標の決まりは docs/EXHIBITS.md（壁の作品は壁の表面の点から手前へ、床の作品は台座の底から上へ）。
// ライブラリ（data 層）は直接 import せず、main.ts から resolve 関数で受け取る。
import * as THREE from 'three';
import type { ExhibitAsset, ExhibitPlacement, MuseumDocument, RoomPart } from '../types/museum';

export type ResolveAsset = (id: string) => ExhibitAsset | undefined;

/** 床の作品の台座の高さ（m） */
export const PEDESTAL_HEIGHT = 0.85;
const PEDESTAL_COLOR = '#eeebe5';
const FRAME_COLOR = '#262c30';
const FRAME_DEPTH = 0.06;
const ART_DEPTH = 0.04;

export interface ExhibitView {
  placement: ExhibitPlacement;
  asset: ExhibitAsset;
  /** 作品全体（クリック判定の対象） */
  group: THREE.Group;
  /** 毎フレーム（動画・回転など。必要な作品だけ） */
  update?(dt: number): void;
  dispose?(): void;
}

export interface ExhibitSet {
  views: Map<string, ExhibitView>;
  update(dt: number): void;
  dispose(): void;
}

const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function box(w: number, h: number, d: number, material: THREE.Material, z = 0, y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(0, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** 壁の作品：額縁（あれば）と作品面。作品面は壁から FRAME_DEPTH + ART_DEPTH の位置 */
function buildWallPiece(asset: ExhibitAsset, face: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const [w, h] = asset.size;
  let front = 0;
  if (asset.frameSize) {
    const [fw, fh] = asset.frameSize;
    g.add(box(fw, fh, FRAME_DEPTH, standard(FRAME_COLOR), FRAME_DEPTH / 2));
    front = FRAME_DEPTH;
  }
  const art = box(w, h, ART_DEPTH, face, front + ART_DEPTH / 2);
  art.name = 'face';
  g.add(art);
  return g;
}

/** 床の作品：台座と、その上の仮の立体（GLB を読み込むまで。TMS 51） */
function buildFloorPiece(asset: ExhibitAsset): THREE.Group {
  const g = new THREE.Group();
  const [pw, h] = asset.size;
  const pedestal = box(pw, PEDESTAL_HEIGHT, pw, standard(PEDESTAL_COLOR), 0, PEDESTAL_HEIGHT / 2);
  pedestal.receiveShadow = true;
  pedestal.name = 'pedestal';
  g.add(pedestal);
  const r = Math.min(pw, h) * 0.3;
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(r, r * 0.35, 84, 10),
    new THREE.MeshStandardMaterial({ color: asset.placeholderColor, metalness: 0.25, roughness: 0.4 }),
  );
  knot.position.y = PEDESTAL_HEIGHT + h / 2;
  knot.castShadow = knot.receiveShadow = true;
  knot.name = 'model';
  g.add(knot);
  return g;
}

export function buildExhibit(placement: ExhibitPlacement, asset: ExhibitAsset): ExhibitView {
  const piece =
    asset.mount === 'floor' ? buildFloorPiece(asset) : buildWallPiece(asset, standard(asset.placeholderColor));
  const group = new THREE.Group();
  group.name = placement.id;
  group.userData.exhibitId = placement.id;
  group.position.set(...placement.position);
  group.rotation.y = placement.rotationY;
  group.add(piece);
  return { placement, asset, group };
}

/** 美術館データの作品をすべて作り、scene に入れる。ライブラリに無い作品は飛ばす（壊れた JSON でも止めない） */
export function buildExhibits(scene: THREE.Scene, doc: MuseumDocument, resolve: ResolveAsset): ExhibitSet {
  const views = new Map<string, ExhibitView>();
  for (const placement of doc.exhibits) {
    const asset = resolve(placement.assetId);
    if (!asset) continue;
    const view = buildExhibit(placement, asset);
    views.set(placement.id, view);
    scene.add(view.group);
  }
  return {
    views,
    update(dt) {
      for (const v of views.values()) v.update?.(dt);
    },
    dispose() {
      for (const v of views.values()) v.dispose?.();
    },
  };
}

/** 床の作品の台座を、当たり判定用の箱として返す（通り抜け防止。TMS 38） */
export function exhibitObstacles(doc: MuseumDocument, resolve: ResolveAsset): RoomPart[] {
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
