// エントリーポイント：データ（data）・3D（scene）・画面（ui）・編集（editor）をつなぐだけ。各層の責務は docs/ARCHITECTURE.md。
// 画面は URL のハッシュで切り替える（公開先のリライト機能に頼らない）:
//   （なし）タイトル / #/view/<kind> 鑑賞 / #/edit/<kind> 編集（kind = sample | empty | continue）
import './styles.css';
import type { MuseumDocument } from './types/museum';
import { sampleMuseum } from './data/sampleMuseum';
import { emptyRoom } from './data/emptyRoom';
import { createRoomScene, disposeRoomScene, roomBounds, type RoomScene } from './scene/room';
import { createViewer } from './scene/viewer';
import { attachFirstPersonControls } from './scene/firstPersonControls';
import { attachEditCamera } from './scene/editCamera';
import { attachInspectCamera } from './scene/inspectCamera';
import * as THREE from 'three';
import { createEditOverlay, GRID_HALF } from './scene/editOverlay';
import { createCollider } from './scene/collision';
import { updateTitleCamera } from './scene/titleCamera';
import { createEditor } from './editor/editor';
import { buildExhibits, exhibitObstacles, pickExhibit, type ExhibitSet, type ExhibitView } from './exhibits/exhibitObjects';
import { LIBRARY, findAsset } from './data/library';
import { mountShell, type EditTool, type StartKind, type ViewMode } from './ui/shell';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('app not found');

// ---- 前回の編集（保存処理は TMS 57 で実装。ここでは読むだけ）----
const AUTOSAVE_KEY = 'museum.autosave.v1';
function loadAutosave(): MuseumDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as MuseumDocument;
    return doc && doc.schemaVersion === 1 && Array.isArray(doc.objects) && Array.isArray(doc.exhibits) ? doc : null;
  } catch {
    return null; // 保存領域が使えない・壊れている場合は「続きから」を出さない
  }
}

function museumFor(kind: StartKind): MuseumDocument {
  if (kind === 'empty') return emptyRoom;
  if (kind === 'continue') return loadAutosave() ?? sampleMuseum;
  return sampleMuseum;
}

const TYPE_LABEL_SHORT: Record<string, string> = {
  image: '画像',
  text: '文章',
  video: '動画',
  audio: '音',
  glb: '3D',
  'interactive-html': 'HTML',
};

// ---- 状態 ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// 編集は PC 向け（docs/SUBMISSION_EXPERIENCE.md）。指で操作する端末・狭い画面は鑑賞のみ
const editUnavailable = window.matchMedia('(max-width: 700px), (pointer: coarse)');
// スマホ・タブレット（指で操作する端末）は影の解像度を下げて軽くする（TMS 35）
const roomOptions = { shadowMapSize: window.matchMedia('(pointer: coarse)').matches ? 1024 : 2048 };

type Screen = 'title' | ViewMode;
let screen: Screen = 'title';
/** 作業中の美術館。元データ（sampleMuseum など）を書き換えないよう複製して持つ（TMS 39） */
let work: { kind: StartKind; doc: MuseumDocument } | null = null;
let tool: EditTool = 'select';

let room: RoomScene = createRoomScene(sampleMuseum, roomOptions);
let exhibits: ExhibitSet = buildExhibits(room.scene, sampleMuseum, findAsset); // 作品（TMS 44〜）
let shownDoc: MuseumDocument = sampleMuseum;
let collider = createCollider(sampleMuseum, exhibitObstacles(sampleMuseum, findAsset)); // 壁・台座・床の当たり判定（TMS 38）
const overlay = createEditOverlay(); // グリッドなど編集用の表示（TMS 39〜）
room.scene.add(overlay.group);

const shell = mountShell(app, {
  // 「空の部屋から作る」は編集モードで始める（PC のみ）。ほかは鑑賞から
  onStart: (kind) => (location.hash = `#/${kind === 'empty' && !editUnavailable.matches ? 'edit' : 'view'}/${kind}`),
  onHome: () => (location.hash = ''),
  onMove: (input) => controls.setMoveInput(input),
  // 鑑賞⇔編集は履歴に積まない（「戻る」でタイトルへ戻れるように）
  onModeChange: (mode) => work && location.replace(`#/${mode}/${work.kind}`),
  onTool: (next) => setTool(next),
  onDeleteSelected: () => editor.deleteSelected(),
  onClearSelection: () => editor.clearSelection(),
  onMoveSelected: () => editor.moveSelected(),
  onPickAsset: (id) => editor.placeAsset(id),
  onInfoClosed: () => endInspect(),
  onInspectZoom: (delta) => inspect.zoom(delta),
});

const viewer = createViewer(shell.viewport, room.scene, room.camera, (dt, t) => {
  exhibits.update(dt, room.camera);
  if (screen === 'title') updateTitleCamera(room.camera, t, reducedMotion.matches);
  else if (screen === 'view') {
    if (inspect.active) inspect.update(dt);
    else controls.update(dt);
  }
  else {
    editCamera.update(dt);
    overlay.updateCutaway(room, room.camera, true);
  }
});
watchExhibitLoads(); // 最初の部屋の分
const controls = attachFirstPersonControls(viewer.canvas, () => room.camera, {
  reducedMotion: () => reducedMotion.matches,
  constrain: (from, to) => collider.constrain(from, to),
  onTap: (x, y) => openExhibit(x, y),
});
const inspect = attachInspectCamera(viewer.canvas, () => room.camera, { reducedMotion: () => reducedMotion.matches });

// ---- 3D 作品を近くで回して見る（TMS 52）----
function startInspect(view: ExhibitView) {
  const model = view.group.getObjectByName('model') ?? view.group;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = room.camera.position;
  controls.setEnabled(false);
  inspect.start(center.toArray(), radius, Math.atan2(cam.x - center.x, cam.z - center.z));
  shell.setInspecting(true);
}
function endInspect() {
  if (!inspect.active) return;
  inspect.stop();
  shell.setInspecting(false);
  if (screen === 'view') controls.setEnabled(true); // 立っていた場所・向きに戻る
}

// ---- 作品をクリックすると作品情報パネル（TMS 46）----
const TYPE_LABEL: Record<string, string> = {
  image: '画像',
  text: '文章',
  video: '動画',
  audio: '音',
  glb: '3D',
  'interactive-html': 'HTML作品',
};
function exhibitInfo(view: ExhibitView) {
  const { placement: p, asset: a } = view;
  const no = String(work!.doc.exhibits.findIndex((e) => e.id === p.id) + 1).padStart(3, '0');
  return {
    eyebrow: `Exhibit / ${no} ・ ${TYPE_LABEL[a.type]}`,
    title: p.title ?? a.title,
    meta: [a.author, a.year].filter(Boolean).join(' ・ ') + (view.stateText ? `\n${view.stateText()}` : ''),
    // 文章作品は全文も読めるようにする（壁のパネルに収まらない分も）
    description: (p.description ?? a.description) + (a.type === 'text' && a.body ? `\n\n${a.body}` : ''),
    interactive: a.type === 'interactive-html',
  };
}
function openExhibit(x: number, y: number) {
  const view = pickExhibit(exhibits, room.camera, viewer.canvas, x, y, [...room.parts.values()]);
  if (!view) return;
  view.activate?.(); // 動画の再生・一時停止、音の再生・停止など
  shell.showExhibitInfo(exhibitInfo(view));
  if (view.asset.type === 'glb') startInspect(view);
}
const editCamera = attachEditCamera(viewer.canvas, () => room.camera, {
  panLimit: GRID_HALF,
  reducedMotion: () => reducedMotion.matches,
  onTap: (x, y) => editor.tap(x, y),
  onHover: (x, y) => editor.hover(x, y),
  onLeave: () => editor.leave(),
});
// 建築の編集（TMS 40〜43）：作業中の美術館を書き換え、部屋を作り直す
const editor = createEditor({
  canvas: viewer.canvas,
  getRoom: () => room,
  getExhibits: () => exhibits,
  getDoc: () => work!.doc,
  onChange: () => {
    show(work!.doc, true);
    editor.afterRebuild();
  },
  onSelect: (info) => shell.showInspector(info),
  onHint: (text) => shell.setEditHint(text),
  onMessage: (text) => shell.toast(text),
});
overlay.group.add(editor.group);
shell.setLibrary(LIBRARY.map((a) => ({ id: a.id, title: a.title, kind: `${TYPE_LABEL_SHORT[a.type]} ・ ${a.mount === 'wall' ? '壁' : '床'}` })));

/** force: 同じ美術館でも作り直す（編集でデータを書き換えたとき） */
/** 3D モデルなどを読み込み終えたら影を描き直す（影は部屋が変わったときだけ描くため。TMS 35・51） */
function watchExhibitLoads() {
  for (const v of exhibits.views.values()) v.onLoad = () => viewer.invalidateShadows();
}

function show(doc: MuseumDocument, force = false) {
  if (doc === shownDoc && !force) return;
  exhibits.dispose();
  disposeRoomScene(room);
  room = createRoomScene(doc, roomOptions);
  exhibits = buildExhibits(room.scene, doc, findAsset);
  watchExhibitLoads();
  room.scene.add(overlay.group);
  shownDoc = doc;
  collider = createCollider(doc, exhibitObstacles(doc, findAsset));
  viewer.setScene(room.scene, room.camera);
}

function setTool(next: EditTool) {
  tool = next;
  shell.setTool(tool);
  editor.setTool(tool);
}

function resetEditCamera(doc: MuseumDocument) {
  const b = roomBounds(doc.objects);
  if (!b) editCamera.reset([0, 0], GRID_HALF * 2);
  else editCamera.reset([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2], Math.max(b.maxX - b.minX, b.maxZ - b.minZ));
}

function route() {
  const m = location.hash.match(/^#\/(view|edit)\/(sample|empty|continue)$/);
  if (!m) {
    show(sampleMuseum); // タイトルの背景は常にサンプル美術館
    const fromViewer = screen !== 'title';
    screen = 'title';
    controls.setEnabled(false);
    editCamera.setEnabled(false);
    overlay.setVisible(false);
    overlay.updateCutaway(room, room.camera, false);
    editor.clearSelection();
    endInspect();
    shell.showExhibitInfo(null);
    shell.showTitle({ canContinue: loadAutosave() !== null, focus: fromViewer });
    return;
  }

  const kind = m[2] as StartKind;
  const mode = m[1] as ViewMode;
  if (mode === 'edit' && editUnavailable.matches) {
    // スマホ・狭い画面で編集の URL を開いたときは鑑賞にする
    shell.toast('編集は PC のブラウザで行えます。鑑賞モードで開きました');
    redirecting = true; // 置き換え後の表示は「画面の切り替え」ではないので、フォーカスを動かさない
    location.replace(`#/view/${kind}`);
    return;
  }

  const fresh = !work || work.kind !== kind;
  if (fresh) work = { kind, doc: structuredClone(museumFor(kind)) };
  const doc = work!.doc;
  show(doc);

  const fromTitle = started && !redirecting && screen === 'title';
  redirecting = false;
  const prev = screen;
  screen = mode;
  shell.showExhibitInfo(null);
  endInspect();
  if (mode === 'view') {
    editor.clearSelection();
    editCamera.setEnabled(false);
    overlay.setVisible(false);
    overlay.updateCutaway(room, room.camera, false);
    if (fresh || prev === 'title') controls.reset(room.spawn); // 部屋の手前から奥を向いて立つ
    controls.setEnabled(true); // 編集から戻ったときは、編集前に立っていた場所から続ける
  } else {
    controls.setEnabled(false);
    if (fresh || prev !== 'edit') resetEditCamera(doc);
    editCamera.setEnabled(true);
    overlay.setVisible(true);
    shell.setAvailableTools(['select', 'floor', 'wall', 'exhibit', 'delete']);
    setTool(tool);
  }
  shell.showViewer({ title: doc.title, mode, canEdit: !editUnavailable.matches, focus: fromTitle });
}

let started = false; // 最初の表示ではフォーカスを動かさない
let redirecting = false;
window.addEventListener('hashchange', route);
route();
started = true;

// 開発時だけ：自動確認（Claude in Chrome）で状態を読むための入口。本番ビルドには含まれない
if (import.meta.env.DEV) {
  (window as unknown as { __museum: unknown }).__museum = {
    controls,
    editCamera,
    editor,
    get room() {
      return room;
    },
    get exhibits() {
      return exhibits;
    },
    get work() {
      return work;
    },
  };
}
