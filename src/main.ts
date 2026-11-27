// エントリーポイント：データ（data）・保存（storage）・3D（scene）・画面（ui）・編集（editor）をつなぐだけ。各層の責務は docs/ARCHITECTURE.md。
// 画面は URL のハッシュで切り替える（公開先のリライト機能に頼らない）:
//   （なし）タイトル / #/view/sample サンプル（見るだけ）/ #/view/m/<id>・#/edit/m/<id> 自分の美術館
import './styles.css';
import type { MuseumDocument } from './types/museum';
import { sampleMuseum } from './data/sampleMuseum';
import { emptyRoom } from './data/emptyRoom';
import { createRoomScene, disposeRoomScene, roomBounds, DEFAULT_STYLE, type RoomScene } from './scene/room';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
import { allAssets, allObjects, findAsset } from './data/library';
import { exportFileName, parseMuseum, serializeMuseum } from './data/museumJson';
import { listMuseums, loadMuseum, migrateLegacy, newMuseumId, removeMuseum, saveMuseum } from './storage/museums';
import { addOwnAsset, loadOwnAssets, removeOwnAsset } from './storage/userAssets';
import { mountShell, type EditTool, type MenuAction, type ViewMode } from './ui/shell';

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
const resolveAsset =
  import.meta.env.DEV && new URLSearchParams(location.search).get('break') === 'assets'
    ? (id: string) => {
        const a = findAsset(id);
        return a && a.src ? { ...a, src: `${a.src}.missing` } : a;
      }
    : findAsset;

// ---- 自分の美術館の保存（TMS 57。複数持てる：storage/museums.ts）----
let saveTimer = 0;
let saveFailed = false;
/** 編集の直後に何度も書かないよう、少し待ってから保存する。失敗したときだけ知らせる */
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!work?.own) return;
    const ok = saveMuseum(work.doc);
    if (!ok && !saveFailed) shell.toast('保存できませんでした。メニューから書き出してください');
    saveFailed = !ok;
  }, 400);
}

const TYPE_LABEL: Record<string, string> = {
  image: '画像',
  text: '文章',
  video: '動画',
  audio: '音',
  glb: '3D',
  'interactive-html': 'HTML',
  object: 'もの',
};

// ---- 状態 ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// 編集は PC 向け（docs/SUBMISSION_EXPERIENCE.md）。指で操作する端末・狭い画面は鑑賞のみ
const editUnavailable = window.matchMedia('(max-width: 700px), (pointer: coarse)');
// スマホ・タブレット（指で操作する端末）は影の解像度を下げて軽くする（TMS 35）
const roomOptions = { shadowMapSize: window.matchMedia('(pointer: coarse)').matches ? 1024 : 2048 };

type Screen = 'title' | ViewMode;
let screen: Screen = 'title';
/** 開いている美術館。key は 'sample' か自分の美術館の id。サンプルは複製して持ち、書き換えない（TMS 39） */
let work: { key: string; own: boolean; doc: MuseumDocument } | null = null;
let tool: EditTool = 'select';

let room: RoomScene = createRoomScene(sampleMuseum, roomOptions);
// 作品（TMS 44〜）。HTML 作品は 3D の canvas ができてから作るので、最初は空で始めて viewer の後に作り直す
let exhibits: ExhibitSet = buildExhibits(room.scene, { ...sampleMuseum, exhibits: [] }, findAsset);
let shownDoc: MuseumDocument = sampleMuseum;
let collider = createCollider(sampleMuseum, exhibitObstacles(sampleMuseum, findAsset)); // 壁・台座・床の当たり判定（TMS 38）
const overlay = createEditOverlay(); // グリッドなど編集用の表示（TMS 39〜）
room.scene.add(overlay.group);

const shell = mountShell(app, {
  onNew: () => createMuseum(structuredClone(emptyRoom), '無題の美術館'),
  onSample: () => (location.hash = '#/view/sample'),
  onOpenMuseum: (id) => (location.hash = `#/view/m/${id}`),
  onHome: () => (location.hash = ''),
  onMove: (input) => controls.setMoveInput(input),
  onModeChange: (mode) => changeMode(mode),
  onTool: (next) => setTool(next),
  onDeleteSelected: () => editor.deleteSelected(),
  onClearSelection: () => editor.clearSelection(),
  onMoveSelected: () => editor.moveSelected(),
  onRenameSelected: (title) => editor.renameSelected(title),
  onPickAsset: (id) => editor.placeAsset(id),
  onUpload: (file) => void uploadAsset(file),
  onRemoveAsset: (id) => void removeAsset(id),
  onInfoClosed: () => endInspect(),
  onInspectZoom: (delta) => inspect.zoom(delta),
  onMenu: (action) => runMenu(action),
  onImportFile: (file) => void importFile(file),
  onUploadObject: (file) => void uploadObject(file),
  onRotateSelected: () => editor.rotateSelected(),
  onColorSelected: (color) => editor.colorSelected(color),
  onStyle: (partial) => applyStyle(partial),
  onRename: (title) => {
    if (!work?.own) return;
    work.doc.title = title;
    scheduleSave();
  },
});

// ---- 自分の美術館をつくる・開く ----
/** 新しい自分の美術館を作って編集で開く（空の部屋・サンプルの複製・読み込んだ JSON） */
function createMuseum(doc: MuseumDocument, title: string, mode: ViewMode = 'edit', rename = true) {
  const next = { ...doc, id: newMuseumId(), title };
  if (!saveMuseum(next)) shell.toast('このブラウザに保存できません（JSON で書き出せば残せます）');
  work = { key: next.id, own: true, doc: next };
  viewPoseReady = false;
  renameOnOpen = rename;
  location.hash = `#/${editUnavailable.matches ? 'view' : mode}/m/${next.id}`;
}
let renameOnOpen = false;

/** 鑑賞⇔編集。サンプルを編集するときは、複製して自分の美術館にする */
function changeMode(mode: ViewMode) {
  if (!work) return;
  if (!work.own) {
    if (mode === 'edit') createMuseum(structuredClone(work.doc), `${work.doc.title}のコピー`, 'edit', false);
    return;
  }
  location.replace(`#/${mode}/m/${work.key}`); // 履歴に積まない（「戻る」でタイトルへ）
}

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
// ---- 画質（TMS 64）----
// 標準：画面の解像度（最大 2 倍）・影あり。軽量：解像度 1 倍・影なし。選んだ画質はブラウザに覚える。
// 初期値は、指で操作する端末（スマホ・タブレット）は軽量、それ以外は標準。
type Quality = 'standard' | 'light';
const QUALITY_KEY = 'museum.quality.v1';
function savedQuality(): Quality | null {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    return q === 'standard' || q === 'light' ? q : null;
  } catch {
    return null;
  }
}
let quality: Quality = savedQuality() ?? (window.matchMedia('(pointer: coarse)').matches ? 'light' : 'standard');
function setQuality(next: Quality, announce = false) {
  quality = next;
  viewer.setQuality({ pixelRatio: next === 'light' ? 1 : Math.min(window.devicePixelRatio, 2), shadows: next === 'standard' });
  shell.setMenuLabel('quality', next === 'light' ? '軽量モード ✓' : '軽量モード');
  show(shownDoc, true); // 影の有無で材質を作り直す
  if (announce) {
    try {
      localStorage.setItem(QUALITY_KEY, next);
    } catch {
      /* 覚えられない環境では今回だけ */
    }

  }
}

// HTML 作品（TMS 53）：3D の canvas を HTML in Canvas の描画先にし、最初の部屋を作り直して HTML 作品を入れる
initHtmlExhibits(viewer.canvas, viewer.renderer);
setQuality(quality); // 最初の部屋もここで作り直す（HTML 作品を入れる）
// HTML 作品のスライダーで展示室の明るさを変える（パネルが canvas の中でも、代替表示のダイアログの中でも届く）
document.addEventListener('museum:light', (e) => {
  const base = (room.lights.ambient.userData.base as number) ?? 1.5; // 雰囲気の明るさを基準にする
  room.lights.ambient.intensity = base * (0.25 + (1.5 * (e as CustomEvent<number>).detail) / 100);
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
function exhibitInfo(view: ExhibitView) {
  const { placement: p, asset: a } = view;
  return {
    title: p.title ?? a.title,
    meta: [a.author, a.year].filter(Boolean).join(' ・ '),
    // 文章作品は全文も読めるようにする（壁のパネルに収まらない分も）
    description: [p.description ?? a.description, a.type === 'text' ? a.body : ''].filter(Boolean).join('\n\n'),
    warning: view.status === 'error' ? '読み込めませんでした' : undefined,
  };
}
function openExhibit(x: number, y: number) {
  const view = pickExhibit(exhibits, room.camera, viewer.canvas, x, y, [...room.parts.values()]);
  if (!view || view.asset.type === 'object') return; // 置き物は解説なし
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
  onHint: () => {}, // 常に出す説明はやめた（ヘルプと初回の 1 行だけ）
  onMessage: (text) => shell.toast(text),
});
overlay.group.add(editor.group);

// ---- 作品ライブラリと、自分の作品の追加 ----
function refreshLibrary() {
  shell.setLibrary(allAssets().map((a) => ({ id: a.id, title: a.title, kind: TYPE_LABEL[a.type], own: !!a.own })));
  shell.setObjectLibrary(allObjects().map((a) => ({ id: a.id, title: a.title, kind: a.own ? '3D' : '', own: !!a.own })));
}

/** 自分の 3D モデルを置き物として追加する。大きさを測るため一度読み込む（部屋に収まるよう長い辺を 0.2〜4m に） */
async function uploadObject(file: File) {
  if (!file.name.toLowerCase().endsWith('.glb')) return shell.toast('.glb を選んでください');
  let size: [number, number] = [1, 1];
  let footprint: [number, number] = [1, 1];
  const url = URL.createObjectURL(file);
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const v = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    const longest = Math.max(v.x, v.y, v.z) || 1;
    const k = longest > 4 ? 4 / longest : longest < 0.2 ? 0.2 / longest : 1;
    const r = (x: number) => Math.round(x * k * 100) / 100;
    size = [r(Math.max(v.x, v.z)), r(v.y)];
    footprint = [r(v.x), r(v.z)];
  } catch {
    URL.revokeObjectURL(url);
    return shell.toast('3D モデルを読めませんでした');
  }
  URL.revokeObjectURL(url);
  const res = await addOwnAsset(file, { size, footprint });
  if (!res.ok) return shell.toast(res.error);
  refreshLibrary();
  editor.placeAsset(res.id);
  shell.toast(`「${res.title}」を置く場所をクリック`);
}

/** 雰囲気（色と光）を変える。壁・床の色を選んだら、その種類のパーツごとの色は外して全体の色にそろえる */
function applyStyle(partial: Partial<typeof DEFAULT_STYLE>) {
  if (!work?.own) return;
  const doc = work.doc;
  doc.style = { ...(doc.style ?? DEFAULT_STYLE), ...partial };
  for (const p of doc.objects) {
    if ((partial.wall && p.type === 'wall') || (partial.floor && p.type === 'floor')) delete p.color;
  }
  show(doc, true);
  editor.afterRebuild();
  shell.setStyle(doc.style);
  scheduleSave();
}
async function uploadAsset(file: File) {
  const r = await addOwnAsset(file);
  if (!r.ok) return shell.toast(r.error);
  refreshLibrary();
  editor.placeAsset(r.id);
  shell.toast(`「${r.title}」を置く場所をクリック`);
}
async function removeAsset(id: string) {
  const a = findAsset(id);
  if (!a || !confirm(`「${a.title}」をライブラリから消しますか？ 飾ってある分も見えなくなります。`)) return;
  await removeOwnAsset(id);
  if (work?.own) {
    work.doc.exhibits = work.doc.exhibits.filter((e) => e.assetId !== id);
    scheduleSave();
  }
  refreshLibrary();
  if (work) show(work.doc, true);
}

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

// ---- メニュー（TMS 55〜64）----
function runMenu(action: MenuAction) {
  if (action === 'export' && work) exportJson(work.doc);
  if (action === 'share') void copyShareUrl();
  if (action === 'help') shell.openHelp();
  if (action === 'quality') setQuality(quality === 'standard' ? 'light' : 'standard', true);
  if (action === 'delete' && work?.own && confirm(`「${work.doc.title}」を削除しますか？ 元に戻せません。`)) {
    removeMuseum(work.key);
    work = null;
    location.hash = '';
  }
}

/** サンプル美術館を直接開く URL（TMS 59）。自分の美術館はこのブラウザにしか無いので、渡すときは書き出す */
async function copyShareUrl() {
  const url = `${location.origin}${location.pathname}#/view/sample`;
  try {
    await navigator.clipboard.writeText(url);
    shell.toast('URL をコピーしました');
  } catch {
    shell.toast(url);
  }
}

/** 開いている美術館を JSON ファイルとして保存させる（ブラウザのダウンロード） */
function exportJson(doc: MuseumDocument) {
  const url = URL.createObjectURL(new Blob([serializeMuseum(doc)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(doc);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 選ばれた JSON を確かめて、新しい自分の美術館として開く */
async function importFile(file: File) {
  if (file.size > 1_000_000) return shell.toast('大きすぎます（1MB まで）');
  const r = parseMuseum(await file.text());
  if (!r.ok) return shell.toast(`読み込めませんでした：${r.error}`);
  createMuseum(r.doc, r.doc.title, 'view', false);
  if (r.warnings.length) shell.toast(`${r.warnings.length} 点はこの端末に無いため飛ばしました`);
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

function goTitle() {
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
  shell.showTitle({ museums: listMuseums(), canCreate: !editUnavailable.matches, focus: fromViewer });
}

function route() {
  // 前の版の URL（#/view/empty・#/view/continue など）
  const legacy = location.hash.match(/^#\/(view|edit)\/(empty|continue)$/);
  if (legacy) {
    const latest = listMuseums()[0];
    return location.replace(legacy[2] === 'continue' && latest ? `#/view/m/${latest.id}` : '#/view/sample');
  }
  const m = location.hash.match(/^#\/(view|edit)\/(?:(sample)|m\/([\w-]{1,64}))$/);
  if (!m) return goTitle();
  const key = m[2] ?? m[3];
  let mode = m[1] as ViewMode;
  if (key === 'sample') mode = 'view'; // サンプルは見るだけ（編集は複製してから）
  if (mode === 'edit' && editUnavailable.matches) {
    shell.toast('編集は PC で');
    redirecting = true;
    return location.replace(`#/view/m/${key}`);
  }

  const fresh = !work || work.key !== key;
  if (fresh) {
    const doc = key === 'sample' ? structuredClone(sampleMuseum) : loadMuseum(key);
    if (!doc) {
      shell.toast('見つかりませんでした');
      return location.replace('#');
    }
    work = { key, own: key !== 'sample', doc };
    viewPoseReady = false;
  }
  const doc = work!.doc;
  show(doc);

  const fromTitle = started && !redirecting && screen === 'title';
  redirecting = false;
  const prev = screen;
  screen = mode;
  shell.showExhibitInfo(null);
  endInspect();
  shell.setMenuItems(work!.own ? ['export', 'import', 'quality', 'help', 'delete'] : ['export', 'import', 'share', 'quality', 'help']);
  if (mode === 'view') {
    editor.clearSelection();
    editCamera.setEnabled(false);
    overlay.setVisible(false);
    overlay.updateCutaway(room, room.camera, false);
    // 部屋の手前から奥を向いて立つ（編集の URL から入って初めて鑑賞にしたときも。TMS 65）
    if (fresh || prev === 'title' || !viewPoseReady) controls.reset(room.spawn);
    viewPoseReady = true;
    controls.setEnabled(true);
    setHtmlInteractive(true);
  } else {
    controls.setEnabled(false);
    setHtmlInteractive(false);
    if (fresh || prev !== 'edit') resetEditCamera(doc);
    editCamera.setEnabled(true);
    overlay.setVisible(true);
    shell.setAvailableTools(['select', 'floor', 'wall', 'exhibit', 'object', 'style', 'delete']);
    shell.setStyle(doc.style ?? DEFAULT_STYLE);
    setTool(tool);
  }
  shell.showViewer({ title: doc.title, mode, canEdit: !editUnavailable.matches, canRename: work!.own, focus: fromTitle });
  shell.showGuide(mode, window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700);
  if (mode === 'view' && doc.exhibits.length === 0) shell.toast('まだ作品がありません');
  if (mode === 'edit' && renameOnOpen) {
    renameOnOpen = false;
    shell.startRename(); // 作ったばかりの美術館は、まず名前を付けられるように
  }
}

let started = false; // 最初の表示ではフォーカスを動かさない
let redirecting = false;
/** 今の美術館で、鑑賞の立ち位置をもう決めたか（編集から戻ったときは立っていた場所から続けるため） */
let viewPoseReady = false;
// 前の版の保存を引き継ぎ、自分の作品（IndexedDB）を読み込んでから最初の画面を出す
migrateLegacy();
void loadOwnAssets().then(() => {
  refreshLibrary();
  window.addEventListener('hashchange', route);
  route();
  started = true;
});

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
