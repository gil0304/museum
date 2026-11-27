// 建築の編集（TMS 40〜43）：床・壁をグリッドに置く、選ぶ、消す。配置プレビューとグリッド吸着。
// 作業中の MuseumDocument を書き換え、onChange で main.ts に部屋の作り直しを頼む。
// グリッド：1マス 1m、マスの境目は整数座標。床はマス（中心 x+0.5, z+0.5）、壁はマスの境目の上に立つ（docs/DESIGN.md）。
import * as THREE from 'three';
import { ROOM_GRID, type MuseumDocument, type RoomPart } from '../types/museum';
import type { RoomScene } from '../scene/room';
import { GRID_HALF } from '../scene/editOverlay';

export type BuildTool = 'select' | 'floor' | 'wall' | 'delete';

const FLOOR_COLOR = '#b9b2a8';
const WALL_COLOR = '#eeebe5';
const WALL_THICKNESS = 0.2;
const FLOOR_THICKNESS = 0.2;
const OK_COLOR = '#c9a86a'; // 置ける（真鍮色）
const NG_COLOR = '#b8322c'; // 置けない（--c-danger）
const HOVER_EMISSIVE = new THREE.Color('#3a2a10');

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

export interface SelectionInfo {
  id: string;
  type: 'floor' | 'wall';
  /** 例：「床 1×1m」「壁 10m」 */
  label: string;
  /** 例：「x -5〜5, z -4〜4」 */
  where: string;
}

export interface Editor {
  /** プレビュー用の表示物（編集用の表示 group に add する） */
  group: THREE.Group;
  setTool(tool: BuildTool): void;
  hover(x: number, y: number): void;
  leave(): void;
  tap(x: number, y: number): void;
  /** 選択中のパーツを消す（Delete キー・情報パネルのボタン） */
  deleteSelected(): void;
  clearSelection(): void;
  /** 部屋を作り直したあとに呼ぶ（選択の強調を付け直す） */
  afterRebuild(): void;
}

export interface EditorOptions {
  canvas: HTMLCanvasElement;
  getRoom(): RoomScene;
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

export function createEditor(opts: EditorOptions): Editor {
  let tool: BuildTool = 'select';
  let selectedId: string | null = null;
  let hoveredId: string | null = null;

  const group = new THREE.Group();
  group.name = 'edit-preview';
  const previewMat = new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
  const floorPreview = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), previewMat);
  const wallPreview = new THREE.Mesh(new THREE.BoxGeometry(1, ROOM_GRID.wallHeight, WALL_THICKNESS), previewMat);
  floorPreview.visible = wallPreview.visible = false;
  floorPreview.renderOrder = wallPreview.renderOrder = 2;
  // 選択中のパーツの枠線（明るい壁の上でも見えるよう、真鍮色の線を壁越しにも描く）
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: OK_COLOR, depthTest: false, transparent: true }),
  );
  outline.renderOrder = 3;
  outline.visible = false;
  // 線は 1px なので、同じ大きさの真鍮色の半透明の箱も重ねる
  const selectFill = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: OK_COLOR, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  selectFill.renderOrder = 2;
  selectFill.visible = false;
  group.add(floorPreview, wallPreview, outline, selectFill);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function setRay(x: number, y: number) {
    const rect = opts.canvas.getBoundingClientRect();
    ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, opts.getRoom().camera);
  }

  /** 画面の点 → 床の高さ（y=0）の点。グリッドの外なら null */
  function groundPoint(x: number, y: number): THREE.Vector3 | null {
    setRay(x, y);
    if (!raycaster.ray.intersectPlane(floorPlane, hit)) return null;
    if (Math.abs(hit.x) > GRID_HALF || Math.abs(hit.z) > GRID_HALF) return null;
    return hit;
  }

  // ---- グリッド吸着（TMS 43）----
  const snapCell = (p: THREE.Vector3): Cell => ({
    kind: 'cell',
    x: clampCell(Math.floor(p.x)),
    z: clampCell(Math.floor(p.z)),
  });
  /** いちばん近いマスの境目。X の線と Z の線のうち近いほう */
  function snapEdge(p: THREE.Vector3): Edge {
    const dx = Math.abs(p.x - Math.round(p.x));
    const dz = Math.abs(p.z - Math.round(p.z));
    return dx < dz
      ? { kind: 'edge', axis: 'z', line: Math.round(p.x), from: clampCell(Math.floor(p.z)) }
      : { kind: 'edge', axis: 'x', line: Math.round(p.z), from: clampCell(Math.floor(p.x)) };
  }

  const parts = () => opts.getDoc().objects;
  const covers = (part: RoomPart, x: number, z: number, margin = 0) =>
    Math.abs(x - part.position[0]) <= part.size[0] / 2 + margin && Math.abs(z - part.position[2]) <= part.size[2] / 2 + margin;

  function floorAt(c: Cell) {
    return parts().find((p) => p.type === 'floor' && covers(p, c.x + 0.5, c.z + 0.5));
  }
  function wallAt(e: Edge) {
    const [mx, mz] = edgeMid(e);
    // 同じ向きの壁が境目の中点を覆っていれば「もうある」（直交する壁の端が触れているだけなら置ける）
    return parts().find((p) => p.type === 'wall' && sameAxis(p, e.axis) && covers(p, mx, mz, 0.01));
  }

  // ---- 配置プレビュー（TMS 43）----
  function showPreview(target: Cell | Edge | null) {
    floorPreview.visible = wallPreview.visible = false;
    if (!target) return;
    if (target.kind === 'cell') {
      const ok = !floorAt(target);
      previewMat.color.set(ok ? OK_COLOR : NG_COLOR);
      floorPreview.position.set(target.x + 0.5, 0.03, target.z + 0.5);
      floorPreview.visible = true;
    } else {
      const ok = !wallAt(target);
      previewMat.color.set(ok ? OK_COLOR : NG_COLOR);
      const [mx, mz] = edgeMid(target);
      wallPreview.position.set(mx, ROOM_GRID.wallHeight / 2, mz);
      wallPreview.rotation.y = target.axis === 'x' ? 0 : Math.PI / 2;
      wallPreview.visible = true;
    }
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
  function paintHighlights() {
    for (const [id, mesh] of opts.getRoom().parts) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (id === hoveredId && id !== selectedId) mat.emissive.copy(HOVER_EMISSIVE);
      else mat.emissive.setRGB(0, 0, 0);
    }
    const sel = selectedId ? opts.getRoom().parts.get(selectedId) : undefined;
    outline.visible = selectFill.visible = !!sel;
    if (sel) {
      const size = (sel.geometry as THREE.BoxGeometry).parameters;
      for (const o of [outline, selectFill]) {
        o.position.copy(sel.position);
        o.scale.set(size.width + 0.04, size.height + 0.04, size.depth + 0.04);
      }
    }
  }
  function select(id: string | null) {
    selectedId = id;
    paintHighlights();
    const part = id ? parts().find((p) => p.id === id) : undefined;
    opts.onSelect(part && (part.type === 'floor' || part.type === 'wall') ? describe(part) : null);
  }

  function removePart(id: string) {
    const doc = opts.getDoc();
    const part = doc.objects.find((p) => p.id === id);
    if (!part) return;
    doc.objects = doc.objects.filter((p) => p.id !== id);
    if (selectedId === id) select(null);
    hoveredId = null;
    opts.onChange();
    opts.onMessage(`${part.type === 'floor' ? '床' : '壁'}を削除しました`);
  }

  function uniqueId(base: string) {
    const ids = new Set(parts().map((p) => p.id));
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  const toolHint: Record<BuildTool, string> = {
    select: '選択：クリックで床・壁を選ぶ（Delete で削除、Esc で解除）',
    floor: '床：クリックでマスに床を置く',
    wall: '壁：マスの境目に近づけてクリックで壁を置く',
    delete: '削除：クリックした床・壁を消す',
  };

  const api: Editor = {
    group,
    setTool(next) {
      tool = next;
      hoveredId = null;
      showPreview(null);
      paintHighlights();
      opts.onHint(toolHint[tool]);
    },
    hover(x, y) {
      if (tool === 'floor' || tool === 'wall') {
        const p = groundPoint(x, y);
        const target = p ? (tool === 'floor' ? snapCell(p) : snapEdge(p)) : null;
        showPreview(target);
        opts.onHint(target ? `${toolHint[tool]}（${describeTarget(target)}）` : `${toolHint[tool]}（グリッドの外）`);
        return;
      }
      const mesh = pickPart(x, y);
      const id = mesh ? (mesh.userData.partId as string) : null;
      if (id !== hoveredId) {
        hoveredId = id;
        paintHighlights();
      }
    },
    leave() {
      showPreview(null);
      hoveredId = null;
      paintHighlights();
    },
    tap(x, y) {
      if (tool === 'floor' || tool === 'wall') {
        const p = groundPoint(x, y);
        if (!p) return opts.onMessage('グリッド（12×12マス）の外には置けません');
        const doc = opts.getDoc();
        if (tool === 'floor') {
          const c = snapCell(p);
          if (floorAt(c)) return opts.onMessage('このマスにはもう床があります');
          doc.objects.push({
            id: uniqueId(`floor-${c.x}_${c.z}`),
            type: 'floor',
            position: [c.x + 0.5, -FLOOR_THICKNESS / 2, c.z + 0.5],
            size: [1, FLOOR_THICKNESS, 1],
            color: FLOOR_COLOR,
          });
        } else {
          const e = snapEdge(p);
          if (wallAt(e)) return opts.onMessage('この境目にはもう壁があります');
          const [mx, mz] = edgeMid(e);
          doc.objects.push({
            id: uniqueId(`wall-${e.axis}${e.line}_${e.from}`),
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
      const mesh = pickPart(x, y);
      const id = mesh ? (mesh.userData.partId as string) : null;
      if (tool === 'delete') {
        if (id) removePart(id);
        return;
      }
      select(id);
    },
    deleteSelected() {
      if (selectedId) removePart(selectedId);
    },
    clearSelection() {
      select(null);
    },
    afterRebuild() {
      if (selectedId && !opts.getRoom().parts.has(selectedId)) selectedId = null;
      paintHighlights();
    },
  };
  return api;
}

// ---- 小さな計算 ----
const maxCell = GRID_HALF - 1;
function clampCell(v: number) {
  return Math.max(-GRID_HALF, Math.min(maxCell, v));
}

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

function describe(part: RoomPart): SelectionInfo {
  const [x, , z] = part.position;
  const [w, , d] = part.size;
  const where = `x ${fmt(x - w / 2)}〜${fmt(x + w / 2)}, z ${fmt(z - d / 2)}〜${fmt(z + d / 2)}`;
  const label = part.type === 'floor' ? `床 ${fmt(w)}×${fmt(d)}m` : `壁 ${fmt(Math.max(w, d))}m`;
  return { id: part.id, type: part.type as 'floor' | 'wall', label, where };
}
