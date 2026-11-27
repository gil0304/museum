// 編集の操作（TMS 40〜43・47）：床・壁をグリッドに置く、選ぶ、消す。作品を選んで動かす・ライブラリから置く・消す。
// 作業中の MuseumDocument を書き換え、onChange で main.ts に部屋の作り直しを頼む。
// グリッド：1マス 1m、マスの境目は整数座標。床はマス（中心 x+0.5, z+0.5）、壁はマスの境目の上に立つ（docs/DESIGN.md）。
// 作品の座標の決まりは docs/EXHIBITS.md（壁の作品は壁の表面の点、床の作品は台座の底の中心）。
import * as THREE from 'three';
import { ROOM_GRID, type ExhibitAsset, type ExhibitPlacement, type MuseumDocument, type RoomPart } from '../types/museum';
import type { RoomScene } from '../scene/room';
import { GRID_HALF } from '../scene/editOverlay';
import { createCollider } from '../scene/collision';
import { PEDESTAL_HEIGHT, pickExhibit, type ExhibitSet } from '../exhibits/exhibitObjects';
import { findAsset } from '../data/library';

export type BuildTool = 'select' | 'floor' | 'wall' | 'exhibit' | 'object' | 'style' | 'delete';

const FLOOR_COLOR = '#b9b2a8';
const WALL_COLOR = '#eeebe5';
const WALL_THICKNESS = 0.2;
const FLOOR_THICKNESS = 0.2;
const OK_COLOR = '#c9a86a'; // 置ける（真鍮色）
const NG_COLOR = '#b8322c'; // 置けない（--c-danger）
const HOVER_EMISSIVE = new THREE.Color('#3a2a10');
/** 作品を壁に沿って動かすときの刻み（m） */
const EXHIBIT_SNAP = 0.1;

/** 床のマス（左下の角の整数座標） */
interface Cell {
  kind: 'cell';
  x: number;
  z: number;
}
/** 壁を立てるマスの境目。axis 'x' は X 方向に伸びる（z = 一定の線上）、'z' は Z 方向に伸びる（x = 一定） */
interface Edge {
  kind: 'edge';
  axis: 'x' | 'z';
  /** 線の位置（整数） */
  line: number;
  /** 線に沿った区間の始まり（整数。長さ 1） */
  from: number;
}

/** 選択中のもの：建築パーツか作品 */
type Selection = { kind: 'part'; id: string } | { kind: 'exhibit'; id: string } | null;

export interface SelectionInfo {
  /** 例：「床」「壁」・作品の名前 */
  title: string;
  /** 作品・置き物なら名前を変えられ、「移動」を出す */
  exhibit: boolean;
  /** 床に置く物（回せる） */
  rotatable: boolean;
  /** 壁・床なら色を変えられる（今の色） */
  color?: string;
}

export interface Editor {
  /** プレビュー用の表示物（編集用の表示 group に add する） */
  group: THREE.Group;
  setTool(tool: BuildTool): void;
  hover(x: number, y: number): void;
  leave(): void;
  tap(x: number, y: number): void;
  /** 選択中のパーツ・作品を消す（Delete キー・情報パネルのボタン） */
  deleteSelected(): void;
  /** 選択中の作品を動かし始める（情報パネルの「移動」・M キー。TMS 47） */
  moveSelected(): void;
  /** ライブラリの作品を置き始める（作品の道具。TMS 47） */
  placeAsset(assetId: string): void;
  /** 選んだ作品の名前を変える */
  renameSelected(title: string): void;
  /** 選んだ床の物を 45° 回す（R キー） */
  rotateSelected(): void;
  /** 選んだ壁・床の色を変える */
  colorSelected(color: string): void;
  /** 選択・移動を取り消す（Esc） */
  clearSelection(): void;
  /** 部屋を作り直したあとに呼ぶ（選択の強調を付け直す） */
  afterRebuild(): void;
}

export interface EditorOptions {
  canvas: HTMLCanvasElement;
  getRoom(): RoomScene;
  getExhibits(): ExhibitSet;
  getDoc(): MuseumDocument;
  /** データを書き換えた（部屋を作り直す） */
  onChange(): void;
  /** 選択が変わった（情報パネル） */
  onSelect(info: SelectionInfo | null): void;
  /** 左下ヒントの道具の説明（グリッド座標を含む） */
  onHint(text: string): void;
  /** 置けなかった理由など */
  onMessage(text: string): void;
}

/** 作品を置く・動かす途中の状態 */
interface Placing {
  asset: ExhibitAsset;
  /** 動かしている既存の作品（新しく置くときは null） */
  existingId: string | null;
  /** 今の候補（置けない場所なら null） */
  /** blocked：場所は決まったが置けない（赤で見せる） */
  pose: { position: [number, number, number]; rotationY: number; blocked?: boolean } | null;
}

export function createEditor(opts: EditorOptions): Editor {
  let tool: BuildTool = 'select';
  let selection: Selection = null;
  let hoveredId: string | null = null;
  let placing: Placing | null = null;

  const group = new THREE.Group();
  group.name = 'edit-preview';
  const previewMat = new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
  const floorPreview = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), previewMat);
  const wallPreview = new THREE.Mesh(new THREE.BoxGeometry(1, ROOM_GRID.wallHeight, WALL_THICKNESS), previewMat);
  // 作品を置く・動かすときのプレビュー（作品の外形の箱。原点を底面・裏面に合わせて動かす）
  const exhibitPreview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), previewMat);
  for (const m of [floorPreview, wallPreview, exhibitPreview]) {
    m.visible = false;
    m.renderOrder = 2;
  }
  // 選択中の枠線（明るい壁の上でも見えるよう、真鍮色の線を壁越しにも描く）と半透明の箱
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: OK_COLOR, depthTest: false, transparent: true }),
  );
  outline.renderOrder = 3;
  const selectFill = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  selectFill.renderOrder = 2;
  outline.visible = selectFill.visible = false;
  group.add(floorPreview, wallPreview, exhibitPreview, outline, selectFill);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function setRay(x: number, y: number) {
    const rect = opts.canvas.getBoundingClientRect();
    ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, opts.getRoom().camera);
    raycaster.far = Infinity;
  }

  /** 画面の点 → 床の高さ（y=0）の点。グリッドの外なら null */
  function groundPoint(x: number, y: number): THREE.Vector3 | null {
    setRay(x, y);
    if (!raycaster.ray.intersectPlane(floorPlane, hit)) return null;
    if (Math.abs(hit.x) > GRID_HALF || Math.abs(hit.z) > GRID_HALF) return null;
    return hit;
  }

  // ---- グリッド吸着（TMS 43）----
  const snapCell = (p: THREE.Vector3): Cell => ({ kind: 'cell', x: clampCell(Math.floor(p.x)), z: clampCell(Math.floor(p.z)) });
  /** いちばん近いマスの境目。X の線と Z の線のうち近いほう */
  function snapEdge(p: THREE.Vector3): Edge {
    const dx = Math.abs(p.x - Math.round(p.x));
    const dz = Math.abs(p.z - Math.round(p.z));
    return dx < dz
      ? { kind: 'edge', axis: 'z', line: Math.round(p.x), from: clampCell(Math.floor(p.z)) }
      : { kind: 'edge', axis: 'x', line: Math.round(p.z), from: clampCell(Math.floor(p.x)) };
  }

  const doc = () => opts.getDoc();
  const parts = () => doc().objects;
  const covers = (part: RoomPart, x: number, z: number, margin = 0) =>
    Math.abs(x - part.position[0]) <= part.size[0] / 2 + margin && Math.abs(z - part.position[2]) <= part.size[2] / 2 + margin;
  const floorAt = (c: Cell) => parts().find((p) => p.type === 'floor' && covers(p, c.x + 0.5, c.z + 0.5));
  function wallAt(e: Edge) {
    const [mx, mz] = edgeMid(e);
    // 同じ向きの壁が境目の中点を覆っていれば「もうある」（直交する壁の端が触れているだけなら置ける）
    return parts().find((p) => p.type === 'wall' && sameAxis(p, e.axis) && covers(p, mx, mz, 0.01));
  }

  // ---- 建築の配置プレビュー（TMS 43）----
  function showBuildPreview(target: Cell | Edge | null) {
    floorPreview.visible = wallPreview.visible = false;
    if (!target) return;
    if (target.kind === 'cell') {
      previewMat.color.set(floorAt(target) ? NG_COLOR : OK_COLOR);
      floorPreview.position.set(target.x + 0.5, 0.03, target.z + 0.5);
      floorPreview.visible = true;
    } else {
      previewMat.color.set(wallAt(target) ? NG_COLOR : OK_COLOR);
      const [mx, mz] = edgeMid(target);
      wallPreview.position.set(mx, ROOM_GRID.wallHeight / 2, mz);
      wallPreview.rotation.y = target.axis === 'x' ? 0 : Math.PI / 2;
      wallPreview.visible = true;
    }
  }

  // ---- 作品を置く場所の計算（TMS 47）----
  /** 壁の作品：カーソルの下の壁の表面。高さは動かす前の高さ（新しく置くときは目の高さ付近） */
  function wallPose(x: number, y: number, asset: ExhibitAsset, keepY: number): Placing['pose'] {
    setRay(x, y);
    const walls = [...opts.getRoom().parts.values()].filter(
      (m) => m.userData.partType === 'wall' && (m.material as THREE.Material).opacity > 0.5, // 半透明にした手前の壁は飛ばす
    );
    const h = raycaster.intersectObjects(walls, false)[0];
    if (!h || !h.face) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    if (Math.abs(n.y) > 0.5) return null; // 壁の上面
    const part = parts().find((p) => p.id === h.object.userData.partId)!;
    const along: 'x' | 'z' = Math.abs(n.z) > Math.abs(n.x) ? 'x' : 'z'; // 壁の面が伸びる方向
    const [w] = asset.size;
    const half = (asset.frameSize?.[0] ?? w) / 2;
    const min = part.position[along === 'x' ? 0 : 2] - part.size[along === 'x' ? 0 : 2] / 2 + half;
    const max = part.position[along === 'x' ? 0 : 2] + part.size[along === 'x' ? 0 : 2] / 2 - half;
    if (min > max) return null; // 壁が作品より短い
    const t = snap(clamp(snap(along === 'x' ? h.point.x : h.point.z), min, max), 0.001);
    const surface = snap(along === 'x' ? h.point.z : h.point.x, 0.001);
    const position: [number, number, number] = along === 'x' ? [t, keepY, surface] : [surface, keepY, t];
    return { position, rotationY: snap(Math.atan2(n.x, n.z), 0.0001) };
  }

  /** 床の作品：カーソルの下の床。台座が床からはみ出さず、壁に重ならない場所だけ */
  function floorPose(x: number, y: number, asset: ExhibitAsset, rotationY: number): Placing['pose'] {
    const p = groundPoint(x, y);
    if (!p) return null;
    const px = snap(p.x);
    const pz = snap(p.z);
    // 台座・置き物の大きさの半分を体の半径にして、壁に重ならず床からはみ出さない場所だけ（ラグは床の上ならどこでも）
    const collider = createCollider(doc(), [], asset.walkable ? 0.01 : Math.max(...(asset.footprint ?? [asset.size[0] * 1.2])) * 0.5);
    return { position: [px, 0, pz], rotationY, blocked: !collider.canStand(px, pz) };
  }

  function showExhibitPreview() {
    if (!placing) return (exhibitPreview.visible = false);
    const { asset, pose } = placing;
    const blocked = !pose || pose.blocked;
    previewMat.color.set(blocked ? NG_COLOR : OK_COLOR);
    if (!pose) return (exhibitPreview.visible = false);
    const [w, h] = asset.size;
    if (asset.mount === 'wall') {
      const [fw, fh] = asset.frameSize ?? [w, h];
      exhibitPreview.scale.set(fw, fh, 0.1);
      exhibitPreview.position.set(0, 0, 0.05);
    } else {
      exhibitPreview.scale.set(w, PEDESTAL_HEIGHT + h, w);
      exhibitPreview.position.set(0, (PEDESTAL_HEIGHT + h) / 2, 0);
    }
    // 作品の向きに合わせて、原点（壁の表面の点・台座の底）からずらす
    exhibitPreview.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.rotationY).add(new THREE.Vector3(...pose.position));
    exhibitPreview.rotation.y = pose.rotationY;
    exhibitPreview.visible = true;
    return true;
  }

  // ---- 選択の強調 ----
  function pickPart(x: number, y: number): THREE.Mesh | null {
    setRay(x, y);
    const meshes = [...opts.getRoom().parts.values()].filter((m) => m.userData.partType === 'floor' || m.userData.partType === 'wall');
    const hits = raycaster.intersectObjects(meshes, false);
    // 半透明にした手前の壁は、奥のパーツを選べるよう飛ばす
    const h = hits.find((i) => ((i.object as THREE.Mesh).material as THREE.Material).opacity > 0.5) ?? null;
    return h ? (h.object as THREE.Mesh) : null;
  }
  /** 作品が建築パーツより手前にあれば作品を返す */
  function pickAny(x: number, y: number): Selection {
    const solidParts = [...opts.getRoom().parts.values()].filter((m) => (m.material as THREE.Material).opacity > 0.5);
    const view = pickExhibit(opts.getExhibits(), opts.getRoom().camera, opts.canvas, x, y, solidParts, Infinity);
    if (view) return { kind: 'exhibit', id: view.placement.id };
    const mesh = pickPart(x, y);
    return mesh ? { kind: 'part', id: mesh.userData.partId as string } : null;
  }

  const box3 = new THREE.Box3();
  function paintHighlights() {
    for (const [id, mesh] of opts.getRoom().parts) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSel = selection?.kind === 'part' && selection.id === id;
      if (id === hoveredId && !isSel) mat.emissive.copy(HOVER_EMISSIVE);
      else mat.emissive.setRGB(0, 0, 0);
    }
    outline.visible = selectFill.visible = false;
    if (!selection) return;
    if (selection.kind === 'part') {
      const sel = opts.getRoom().parts.get(selection.id);
      if (!sel) return;
      const size = (sel.geometry as THREE.BoxGeometry).parameters;
      for (const o of [outline, selectFill]) {
        o.position.copy(sel.position);
        o.rotation.set(0, 0, 0);
        o.scale.set(size.width + 0.04, size.height + 0.04, size.depth + 0.04);
      }
    } else {
      const view = opts.getExhibits().views.get(selection.id);
      if (!view) return;
      box3.setFromObject(view.group).expandByScalar(0.03);
      for (const o of [outline, selectFill]) {
        box3.getCenter(o.position);
        o.rotation.set(0, 0, 0);
        box3.getSize(o.scale);
      }
    }
    outline.visible = selectFill.visible = true;
  }

  function select(next: Selection) {
    selection = next;
    paintHighlights();
    if (!next) return opts.onSelect(null);
    if (next.kind === 'part') {
      const part = parts().find((p) => p.id === next.id);
      return opts.onSelect(part && (part.type === 'floor' || part.type === 'wall') ? describePart(part) : null);
    }
    const ex = doc().exhibits.find((e) => e.id === next.id);
    const asset = ex && findAsset(ex.assetId);
    opts.onSelect(ex && asset ? describeExhibit(ex, asset) : null);
  }

  function remove(target: NonNullable<Selection>) {
    const d = doc();
    if (target.kind === 'part') {
      const part = d.objects.find((p) => p.id === target.id);
      if (!part) return;
      d.objects = d.objects.filter((p) => p.id !== target.id);

    } else {
      const ex = d.exhibits.find((e) => e.id === target.id);
      if (!ex) return;
      d.exhibits = d.exhibits.filter((e) => e.id !== target.id);

    }
    if (selection?.id === target.id) select(null);
    hoveredId = null;
    opts.onChange();
  }

  function uniqueId(base: string, taken: Iterable<string>) {
    const ids = new Set(taken);
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  // ---- 作品を置く・動かす（TMS 47）----
  function beginPlacing(asset: ExhibitAsset, existingId: string | null) {
    placing = { asset, existingId, pose: null };
    showBuildPreview(null);
    opts.onHint(
      `${existingId ? '移動' : '配置'}：「${asset.title}」を${asset.mount === 'wall' ? '壁の上' : '床の上'}でクリックして置く（Esc で取り消し）`,
    );
  }
  function updatePlacing(x: number, y: number) {
    if (!placing) return;
    const { asset, existingId } = placing;
    const current = existingId ? doc().exhibits.find((e) => e.id === existingId) : undefined;
    placing.pose =
      asset.mount === 'wall'
        ? wallPose(x, y, asset, current?.position[1] ?? 1.55)
        : floorPose(x, y, asset, current?.rotationY ?? 0);
    showExhibitPreview();
  }
  function commitPlacing(x: number, y: number) {
    if (!placing) return;
    updatePlacing(x, y);
    const { asset, existingId, pose } = placing;
    if (!pose || pose.blocked) {
      return opts.onMessage(asset.mount === 'wall' ? '壁に置いてください' : 'ここには置けません');
    }
    const d = doc();
    let id = existingId;
    if (existingId) {
      const ex = d.exhibits.find((e) => e.id === existingId)!;
      ex.position = pose.position;
      ex.rotationY = pose.rotationY;

    } else {
      id = uniqueId(`ex-${asset.id}`, d.exhibits.map((e) => e.id));
      d.exhibits.push({ id, assetId: asset.id, type: asset.type, mount: asset.mount, position: pose.position, rotationY: pose.rotationY });

    }
    placing = null;
    exhibitPreview.visible = false;
    opts.onChange();
    select({ kind: 'exhibit', id: id! });
    opts.onHint(toolHint[tool]);
  }
  function cancelPlacing() {
    if (!placing) return false;
    placing = null;
    exhibitPreview.visible = false;
    opts.onHint(toolHint[tool]);
    return true;
  }

  const toolHint: Record<BuildTool, string> = {
    select: '選択：クリックで床・壁・作品を選ぶ（作品は M で移動、Delete で削除、Esc で解除）',
    floor: '床：クリックでマスに床を置く',
    wall: '壁：マスの境目に近づけてクリックで壁を置く',
    exhibit: '作品：右の一覧から作品を選ぶ',
    object: '置き物：右の一覧から選ぶ',
    style: '雰囲気：右で色と光を選ぶ',
    delete: '削除：クリックした床・壁・作品を消す',
  };

  const api: Editor = {
    group,
    setTool(next) {
      tool = next;
      hoveredId = null;
      cancelPlacing();
      showBuildPreview(null);
      paintHighlights();
      opts.onHint(toolHint[tool]);
    },
    hover(x, y) {
      if (placing) return updatePlacing(x, y);
      if (tool === 'floor' || tool === 'wall') {
        const p = groundPoint(x, y);
        const target = p ? (tool === 'floor' ? snapCell(p) : snapEdge(p)) : null;
        showBuildPreview(target);
        opts.onHint(target ? `${toolHint[tool]}（${describeTarget(target)}）` : `${toolHint[tool]}（グリッドの外）`);
        return;
      }
      const target = pickAny(x, y);
      const id = target?.kind === 'part' ? target.id : null;
      if (id !== hoveredId) {
        hoveredId = id;
        paintHighlights();
      }
    },
    leave() {
      showBuildPreview(null);
      exhibitPreview.visible = false;
      hoveredId = null;
      paintHighlights();
    },
    tap(x, y) {
      if (placing) return commitPlacing(x, y);
      if (tool === 'floor' || tool === 'wall') {
        const p = groundPoint(x, y);
        if (!p) return opts.onMessage('ここには置けません');
        const d = doc();
        const ids = d.objects.map((o) => o.id);
        if (tool === 'floor') {
          const c = snapCell(p);
          if (floorAt(c)) return opts.onMessage('もう床があります');
          d.objects.push({
            id: uniqueId(`floor-${c.x}_${c.z}`, ids),
            type: 'floor',
            position: [c.x + 0.5, -FLOOR_THICKNESS / 2, c.z + 0.5],
            size: [1, FLOOR_THICKNESS, 1],
            color: FLOOR_COLOR,
          });
        } else {
          const e = snapEdge(p);
          if (wallAt(e)) return opts.onMessage('もう壁があります');
          const [mx, mz] = edgeMid(e);
          d.objects.push({
            id: uniqueId(`wall-${e.axis}${e.line}_${e.from}`, ids),
            type: 'wall',
            position: [mx, ROOM_GRID.wallHeight / 2, mz],
            size: e.axis === 'x' ? [1, ROOM_GRID.wallHeight, WALL_THICKNESS] : [WALL_THICKNESS, ROOM_GRID.wallHeight, 1],
            color: WALL_COLOR,
          });
        }
        opts.onChange();
        api.hover(x, y); // 置いた場所は「もうある」の赤に変わる
        return;
      }
      if (tool === 'exhibit' || tool === 'object') return opts.onMessage('右の一覧から選んでください');
      if (tool === 'style') return;
      const target = pickAny(x, y);
      if (tool === 'delete') {
        if (target) remove(target);
        return;
      }
      select(target);
    },
    deleteSelected() {
      if (selection) remove(selection);
    },
    moveSelected() {
      if (selection?.kind !== 'exhibit') return;
      const ex = doc().exhibits.find((e) => e.id === selection!.id);
      const asset = ex && findAsset(ex.assetId);
      if (asset) beginPlacing(asset, ex!.id);
    },
    rotateSelected() {
      if (selection?.kind !== 'exhibit') return;
      const ex = doc().exhibits.find((e) => e.id === selection!.id);
      if (!ex || ex.mount !== 'floor') return;
      ex.rotationY = Math.round(((ex.rotationY + Math.PI / 4) % (Math.PI * 2)) * 10000) / 10000;
      opts.onChange();
    },
    colorSelected(color) {
      if (selection?.kind !== 'part') return;
      const part = parts().find((p) => p.id === selection!.id);
      if (!part) return;
      part.color = color;
      opts.onChange();
    },
    renameSelected(title) {
      if (selection?.kind !== 'exhibit') return;
      const ex = doc().exhibits.find((e) => e.id === selection!.id);
      if (!ex) return;
      ex.title = title.slice(0, 60);
      opts.onChange();
    },
    placeAsset(assetId) {
      const asset = findAsset(assetId);
      if (!asset) return;
      select(null);
      beginPlacing(asset, null);
    },
    clearSelection() {
      if (cancelPlacing()) return; // Esc：まず置く・動かすのを取り消す
      select(null);
    },
    afterRebuild() {
      if (selection?.kind === 'part' && !opts.getRoom().parts.has(selection.id)) selection = null;
      if (selection?.kind === 'exhibit' && !opts.getExhibits().views.has(selection.id)) selection = null;
      paintHighlights();
    },
  };
  return api;
}

// ---- 小さな計算 ----
const maxCell = GRID_HALF - 1;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
/** 刻みに吸着し、小数の誤差（0.6000000000000001 など）を落とす */
const snap = (v: number, step = EXHIBIT_SNAP) => Math.round(Math.round(v / step) * step * 1000) / 1000;
const clampCell = (v: number) => clamp(v, -GRID_HALF, maxCell);

function edgeMid(e: Edge): [number, number] {
  return e.axis === 'x' ? [e.from + 0.5, e.line] : [e.line, e.from + 0.5];
}

/** 壁パーツが X 方向に伸びているか（幅 > 奥行き）で向きを判定する */
function sameAxis(p: RoomPart, axis: 'x' | 'z') {
  return axis === 'x' ? p.size[0] >= p.size[2] : p.size[2] > p.size[0];
}

function describeTarget(t: Cell | Edge) {
  if (t.kind === 'cell') return `マス x ${t.x}〜${t.x + 1}, z ${t.z}〜${t.z + 1}`;
  return t.axis === 'x' ? `境目 z = ${t.line}, x ${t.from}〜${t.from + 1}` : `境目 x = ${t.line}, z ${t.from}〜${t.from + 1}`;
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

function describePart(part: RoomPart): SelectionInfo {
  const [w, , d] = part.size;
  return { title: part.type === 'floor' ? `床 ${fmt(w)}×${fmt(d)}m` : `壁 ${fmt(Math.max(w, d))}m`, exhibit: false, rotatable: false, color: part.color ?? '' };
}

function describeExhibit(ex: ExhibitPlacement, asset: ExhibitAsset): SelectionInfo {
  return { title: ex.title ?? asset.title, exhibit: true, rotatable: asset.mount === 'floor' };
}
