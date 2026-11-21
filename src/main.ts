// エントリーポイント：データ（data）・3D（scene）・画面（ui）をつなぐだけ。各層の責務は docs/ARCHITECTURE.md。
// 画面は URL のハッシュで切り替える（公開先のリライト機能に頼らない）:
//   （なし）タイトル / #/view/sample サンプル美術館 / #/view/empty 空の部屋 / #/view/continue 前回の続き
import './styles.css';
import type { MuseumDocument } from './types/museum';
import { sampleMuseum } from './data/sampleMuseum';
import { emptyRoom } from './data/emptyRoom';
import { createRoomScene, disposeRoomScene, type RoomScene } from './scene/room';
import { createViewer } from './scene/viewer';
import { attachPreviewControls } from './scene/previewControls';
import { updateTitleCamera } from './scene/titleCamera';
import { mountShell, type StartKind } from './ui/shell';

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

// ---- 3D と画面 ----
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// スマホ・タブレット（指で操作する端末）は影の解像度を下げて軽くする（TMS 35）
const roomOptions = { shadowMapSize: window.matchMedia('(pointer: coarse)').matches ? 1024 : 2048 };
let mode: 'title' | 'viewer' = 'title';
let room: RoomScene = createRoomScene(sampleMuseum, roomOptions);
let shownDoc: MuseumDocument = sampleMuseum;

const shell = mountShell(app, {
  onStart: (kind) => (location.hash = `#/view/${kind}`),
  onHome: () => (location.hash = ''),
});

const viewer = createViewer(shell.viewport, room.scene, room.camera, (_dt, t) => {
  if (mode === 'title') updateTitleCamera(room.camera, t, reducedMotion.matches);
  else controls.update();
});
const controls = attachPreviewControls(viewer.canvas, () => room.camera);

function show(doc: MuseumDocument) {
  if (doc === shownDoc) return;
  disposeRoomScene(room);
  room = createRoomScene(doc, roomOptions);
  shownDoc = doc;
  viewer.setScene(room.scene, room.camera);
}

function route() {
  const m = location.hash.match(/^#\/view\/(sample|empty|continue)$/);
  if (m) {
    const doc = museumFor(m[1] as StartKind);
    show(doc);
    const fromTitle = started && mode === 'title';
    mode = 'viewer';
    controls.reset();
    controls.setEnabled(true);
    shell.showViewer({ title: doc.title, focus: fromTitle });
  } else {
    show(sampleMuseum); // タイトルの背景は常にサンプル美術館
    const fromViewer = mode === 'viewer';
    mode = 'title';
    controls.setEnabled(false);
    shell.showTitle({ canContinue: loadAutosave() !== null, focus: fromViewer });
  }
}

let started = false; // 最初の表示ではフォーカスを動かさない
window.addEventListener('hashchange', route);
route();
started = true;
