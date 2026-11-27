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
import { initHtmlExhibits, setHtmlInteractive } from './exhibits/htmlExhibit';
import { LIBRARY, findAsset } from './data/library';
import { exportFileName, parseMuseum, serializeMuseum } from './data/museumJson';
import { mountShell, type EditTool, type StartKind, type ViewMode } from './ui/shell';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('app not found');

// 3D を描けない環境（WebGL2 が無い・無効）では、真っ白にせず理由を出して止める（TMS 63）
if (!document.createElement('canvas').getContext('webgl2')) {
  app.innerHTML = `<div class="no-webgl"><div class="m-eyebrow">MUSEUM</div><h1 class="m-hero">3D を表示できませんでした</h1>
<p>このブラウザ・端末では WebGL2 が使えないため、展示室を描けません。PC の Google Chrome（最新版）でお試しください。ハードウェアアクセラレーションが無効になっている場合は、ブラウザの設定で有効にしてください。</p></div>`;
  throw new Error('WebGL2 が使えません');
}

/**
 * 作品ライブラリから作品を引く。開発時だけ `?break=assets` で素材のパスをわざと壊し、読み込み失敗の表示を確かめられる（TMS 63）
 */
const breakAssets = import.meta.env.DEV && new URLSearchParams(location.search).get('break') === 'assets';
const resolveAsset = (id: string) => {
  const a = findAsset(id);
  return a && breakAssets && a.src ? { ...a, src: `${a.src}.missing` } : a;
};

// ---- ブラウザ内の保存（TMS 57）----
// 編集するたびに、作業中の美術館を localStorage に保存する（JSON の書き出しと同じ形）。タイトルの「続きから」で開く。
const AUTOSAVE_KEY = 'museum.autosave.v1';
function loadAutosave(): MuseumDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const r = parseMuseum(raw); // 読み込みと同じ検査（壊れていれば「続きから」を出さない）
    return r.ok ? r.doc : null;
  } catch {
    return null; // 保存領域が使えない（プライベートブラウズ・無効化など）
  }
}
function saveAutosave(doc: MuseumDocument): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeMuseum(doc));
    return true;
  } catch {
    return false; // 容量超過・保存領域が使えない
  }
}
let saveTimer = 0;
/** 編集の直後に何度も書かないよう、少し待ってから保存する */
function scheduleSave() {
  shell.setSaveStatus('保存中…');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!work) return;
    shell.setSaveStatus(saveAutosave(work.doc) ? 'ブラウザに保存済み' : '保存できませんでした（JSON で書き出してください）');
  }, 400);
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
// 作品（TMS 44〜）。HTML 作品は 3D の canvas ができてから作るので、最初は空で始めて viewer の後に作り直す
let exhibits: ExhibitSet = buildExhibits(room.scene, { ...sampleMuseum, exhibits: [] }, findAsset);
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
  onMenu: (action) => runMenu(action),
  onImportFile: (file) => void importFile(file),
});
shell.setMenuItems(['export', 'import', 'share', 'help']);

const viewer = createViewer(shell.viewport, room.scene, room.camera, (dt, t) => {
  if (screen === 'title') updateTitleCamera(room.camera, t, reducedMotion.matches);
  else if (screen === 'view') {
    if (inspect.active) inspect.update(dt);
    else controls.update(dt);
  }
  else {
    editCamera.update(dt);
    overlay.updateCutaway(room, room.camera, true);
  }
  exhibits.update(dt, room.camera); // カメラを動かした後（HTML 作品のクリック判定の位置合わせ）
});
// HTML 作品（TMS 53）：3D の canvas を HTML in Canvas の描画先にし、最初の部屋を作り直して HTML 作品を入れる
initHtmlExhibits(viewer.canvas, viewer.renderer);
show(sampleMuseum, true);
// HTML 作品のスライダーで展示室の明るさを変える（パネルが canvas の中でも、代替表示のダイアログの中でも届く）
const BASE_AMBIENT = room.lights.ambient.intensity;
document.addEventListener('museum:light', (e) => {
  room.lights.ambient.intensity = BASE_AMBIENT * (0.25 + (1.5 * (e as CustomEvent<number>).detail) / 100);
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
  setHtmlInteractive(false);
  inspect.start(center.toArray(), radius, Math.atan2(cam.x - center.x, cam.z - center.z));
  shell.setInspecting(true);
}
function endInspect() {
  if (!inspect.active) return;
  inspect.stop();
  shell.setInspecting(false);
  if (screen === 'view') {
    controls.setEnabled(true); // 立っていた場所・向きに戻る
    setHtmlInteractive(true);
  }
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
    meta:
      [a.author, a.year].filter(Boolean).join(' ・ ') +
      (view.status === 'error' && view.errorText ? `\n⚠ ${view.errorText}` : view.stateText ? `\n${view.stateText()}` : ''),
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
    scheduleSave(); // TMS 57
  },
  onSelect: (info) => shell.showInspector(info),
  onHint: (text) => shell.setEditHint(text),
  onMessage: (text) => shell.toast(text),
});
overlay.group.add(editor.group);
shell.setLibrary(LIBRARY.map((a) => ({ id: a.id, title: a.title, kind: `${TYPE_LABEL_SHORT[a.type]} ・ ${a.mount === 'wall' ? '壁' : '床'}` })));

/** force: 同じ美術館でも作り直す（編集でデータを書き換えたとき） */
/** 3D モデルなどを読み込み終えたら影を描き直す（影は部屋が変わったときだけ描くため。TMS 35・51）。失敗は 1 回だけ知らせる（TMS 63） */
let loadErrorTimer = 0;
function watchExhibitLoads() {
  for (const v of exhibits.views.values()) {
    v.onLoad = () => viewer.invalidateShadows();
    v.onError = () => {
      clearTimeout(loadErrorTimer);
      loadErrorTimer = window.setTimeout(() => {
        const n = [...exhibits.views.values()].filter((x) => x.status === 'error').length;
        if (n && screen !== 'title') shell.toast(`${n} 点の作品の素材を読み込めませんでした。仮の表示にしています（通信を確かめて、ページを読み込み直してください）`);
      }, 600);
    };
  }
}

function show(doc: MuseumDocument, force = false) {
  if (doc === shownDoc && !force) return;
  exhibits.dispose();
  disposeRoomScene(room);
  room = createRoomScene(doc, roomOptions);
  exhibits = buildExhibits(room.scene, doc, resolveAsset);
  watchExhibitLoads();
  room.scene.add(overlay.group);
  shownDoc = doc;
  collider = createCollider(doc, exhibitObstacles(doc, resolveAsset));
  viewer.setScene(room.scene, room.camera);
}

// ---- メニュー：JSON の書き出し・読み込み（TMS 55・56）----
function runMenu(action: string) {
  if (action === 'export' && work) exportJson(work.doc);
  if (action === 'share') void copyShareUrl();
  if (action === 'help') shell.openHelp();
}

// ---- 共有用のデモ URL（TMS 59）----
/**
 * サンプル美術館を鑑賞で開く URL（例 https://…/#/view/sample）。タイトルを飛ばして直接展示室に入る。
 * 空の部屋は #/view/empty。自分で編集した美術館はこの端末のブラウザにしか無いので、URL ではなく JSON で渡してもらう。
 */
function shareUrl(kind: StartKind) {
  return `${location.origin}${location.pathname}#/view/${kind === 'empty' ? 'empty' : 'sample'}`;
}
async function copyShareUrl() {
  const kind = work?.kind ?? 'sample';
  const url = shareUrl(kind);
  const note = kind === 'continue' ? '（編集した美術館は共有されません。渡すときは JSON で書き出してください）' : '';
  try {
    await navigator.clipboard.writeText(url);
    shell.toast(`共有用の URL をコピーしました：${url}${note}`);
  } catch {
    shell.toast(`共有用の URL：${url}${note}`); // コピーできない環境では表示だけ
  }
}

/** 作業中の美術館を JSON ファイルとして保存させる（ブラウザのダウンロード） */
function exportJson(doc: MuseumDocument) {
  const url = URL.createObjectURL(new Blob([serializeMuseum(doc)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(doc);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  shell.toast(`「${a.download}」を書き出しました`);
}

/** 選ばれた JSON ファイルを確かめて開く。開いたものはブラウザに保存し、「続きから」として扱う */
async function importFile(file: File) {
  if (file.size > 1_000_000) return shell.toast('ファイルが大きすぎます（1MB まで）');
  const r = parseMuseum(await file.text());
  if (!r.ok) return shell.toast(`読み込めませんでした：${r.error}`);
  saveAutosave(r.doc);
  work = { kind: 'continue', doc: r.doc };
  const mode = screen === 'edit' ? 'edit' : 'view';
  const next = `#/${mode}/continue`;
  forceFresh = true;
  if (location.hash === next) route();
  else location.replace(next);
  shell.toast(r.warnings.length ? `「${r.doc.title}」を開きました（${r.warnings.length} 件は飛ばしました：${r.warnings[0]}）` : `「${r.doc.title}」を開きました`);
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
    setHtmlInteractive(false);
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

  // 読み込んだ直後（forceFresh）は、作業中の美術館はそのままで視点などを初めから
  const fresh = forceFresh || !work || work.kind !== kind;
  if (!work || work.kind !== kind) work = { kind, doc: structuredClone(museumFor(kind)) };
  forceFresh = false;
  if (fresh) shell.setSaveStatus(kind === 'continue' ? 'ブラウザに保存済み' : ''); // サンプル・空の部屋は編集したら保存する
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
    setHtmlInteractive(true); // HTML 作品は鑑賞中だけ直接操作できる
  } else {
    controls.setEnabled(false);
    setHtmlInteractive(false); // 編集中は HTML 作品も選んで動かす対象
    if (fresh || prev !== 'edit') resetEditCamera(doc);
    editCamera.setEnabled(true);
    overlay.setVisible(true);
    shell.setAvailableTools(['select', 'floor', 'wall', 'exhibit', 'delete']);
    setTool(tool);
  }
  shell.showViewer({ title: doc.title, mode, canEdit: !editUnavailable.matches, focus: fromTitle });
  shell.showGuide(mode, window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700); // 初めてのときだけ（TMS 62）
  // 作品の無い部屋を鑑賞で開いたとき（TMS 63）
  if (mode === 'view' && doc.exhibits.length === 0) {
    shell.toast(editUnavailable.matches ? 'この部屋にはまだ作品がありません' : 'この部屋にはまだ作品がありません。上の「編集」→ 左の「作品」から飾れます');
  }
}

let started = false; // 最初の表示ではフォーカスを動かさない
let redirecting = false;
let forceFresh = false;
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
