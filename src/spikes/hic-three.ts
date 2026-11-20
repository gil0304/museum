// HTML in Canvas スパイク 03：Three.js（WebGL）の3D平面に実DOMパネルを貼り、操作可能にする（TMS 26）。
// - 表示: canvas.onpaint → gl.texElementSubImage2D で DataTexture に直接書き込む
// - 入力: 平面の world 行列・カメラ・投影から「要素 → canvas」の変換行列を作り updateElementGeometry に渡す
// - 非対応（TMS 28）: 3D内の平面には案内表示を貼り、クリックで同じパネルを通常DOMのダイアログで開く。?fallback=1 で強制
// 結果は画面の #status と window.__hic、console（[HIC] 接頭辞）に出す。
import * as THREE from 'three';
import { createRoomScene } from '../scene/room';
import { sampleMuseum } from '../data/sampleMuseum';
import { detectHtmlInCanvasMode, supportsHtmlInCanvas3D } from '../exhibits/htmlInCanvasSupport';

type Probe = { id: string; x: number; y: number; hit: string | null };
type Result = {
  supported: boolean;
  mode: 'html-in-canvas' | 'dom-fallback';
  fallback: { planeClicks: number; dialogOpens: number; dialogCloses: number; dialogOpen: boolean };
  geometryMode: 'grid' | 'css';
  paintEvents: number;
  uploads: number;
  texSize?: string;
  glError?: number;
  lampScreenPixel?: number[];
  lampExpected?: number;
  lampMatches?: boolean;
  probes: Probe[];
  applauseClicks: number;
  resetClicks: number;
  sliderValue: number;
  // TMS 27：カメラ移動
  camera: { x: number; y: number; z: number; yaw: number; pitch: number };
  cameraDrags: number; // 背景ドラッグで視点を回した回数
  orbit: boolean;
  backface: boolean; // 平面を裏から見ている（クリック判定を外している）
  motion: { frames: number; hits: number; misses: number; offscreen: number; lastMiss?: string };
  error?: string;
};

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
const countEl = document.querySelector<HTMLElement>('#count')!;
const applause = document.querySelector<HTMLButtonElement>('#applause')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const light = document.querySelector<HTMLInputElement>('#light')!;
const lightValue = document.querySelector<HTMLElement>('#lightValue')!;
const lamp = document.querySelector<HTMLElement>('#lamp')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;

const supported = supportsHtmlInCanvas3D();
const mode = detectHtmlInCanvasMode();
const useHic = mode === 'html-in-canvas';

const result: Result = {
  supported,
  mode,
  fallback: { planeClicks: 0, dialogOpens: 0, dialogCloses: 0, dialogOpen: false },
  // updateElementGeometry の canvasTransform の出力先は canvas の CSS px（TMS 26 で検証）。
  // ?geom=grid で実ピクセル基準に切り替えると、クリック判定が dpr 倍ずれることを再現できる。
  geometryMode: new URLSearchParams(location.search).get('geom') === 'grid' ? 'grid' : 'css',
  paintEvents: 0,
  uploads: 0,
  probes: [],
  applauseClicks: 0,
  resetClicks: 0,
  sliderValue: Number(light.value),
  camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  cameraDrags: 0,
  orbit: new URLSearchParams(location.search).get('orbit') === '1',
  backface: false,
  motion: { frames: 0, hits: 0, misses: 0, offscreen: 0 },
};
(window as unknown as { __hic: Result }).__hic = result;

// ---- Three.js シーン -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const gl = renderer.getContext() as WebGL2RenderingContext;

const { scene, camera, lights } = createRoomScene(sampleMuseum);

// ---- 一人称カメラ（TMS 27）-------------------------------------------------
// 背景（canvas 本体）のドラッグで視点回転、WASD / 矢印キーで移動。
// パネル内の要素（ボタン・スライダー）から始まった操作はカメラに渡さない。
const view = { x: 0.4, y: 1.7, z: 4.2, yaw: 0.153, pitch: -0.03 };
(window as unknown as { __hicView: typeof view }).__hicView = view; // 検証用（裏側への移動など）
const keys = new Set<string>();
const drag = { active: false, id: -1, x: 0, y: 0, startX: 0, startY: 0 };
camera.rotation.order = 'YXZ';

function applyCamera() {
  camera.position.set(view.x, view.y, view.z);
  camera.rotation.set(view.pitch, view.yaw, 0);
  result.camera = { ...view };
}
applyCamera();

canvas.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return; // パネル内の要素から始まった操作
  drag.active = true;
  drag.id = e.pointerId;
  drag.x = drag.startX = e.clientX;
  drag.y = drag.startY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  result.cameraDrags++;
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.id) return;
  view.yaw -= (e.clientX - drag.x) * 0.004;
  view.pitch = Math.max(-0.8, Math.min(0.8, view.pitch - (e.clientY - drag.y) * 0.004));
  drag.x = e.clientX;
  drag.y = e.clientY;
});
const endDrag = (e: PointerEvent) => {
  if (e.pointerId !== drag.id || !drag.active) return;
  drag.active = false;
  // 代替表示: ほぼ動かさずに離した（＝クリック）なら、平面に当たったかを調べてパネルを開く
  const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
  if (!useHic && e.type === 'pointerup' && moved < 5) openFallbackIfPlaneHit(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
window.addEventListener('keydown', (e) => {
  // スライダーにフォーカスがあるときの矢印キーはスライダーのもの
  if (panel.contains(document.activeElement)) return;
  if (MOVE_KEYS.includes(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function moveCamera(dt: number, t: number) {
  if (result.orbit) {
    // 自動で揺らし続ける（動いている最中のクリック判定の追従を見る）
    view.x = 0.4 + Math.sin(t * 0.6) * 1.2;
    view.z = 3.6 + Math.cos(t * 0.45) * 0.8;
    view.yaw = 0.153 + Math.sin(t * 0.8) * 0.25;
    view.pitch = -0.03 + Math.sin(t * 0.5) * 0.08;
    return;
  }
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (!f && !s) return;
  const speed = 2.2 * dt;
  view.x += (-Math.sin(view.yaw) * f + Math.cos(view.yaw) * s) * speed;
  view.z += (-Math.cos(view.yaw) * f - Math.sin(view.yaw) * s) * speed;
}

const PLANE_W = 1.4; // m
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.FrontSide });
let planeH = PLANE_W; // パネルの縦横比が決まったら作り直す
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, planeH), material);
mesh.position.set(-0.6, 1.6, -1.2);
mesh.rotation.y = 0.45; // 斜めに立てて、透視投影でも位置合わせが合うかを見る
scene.add(mesh);
// パネル背面の台（3D空間に置かれていることを分かりやすくする）
const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.04), new THREE.MeshStandardMaterial({ color: '#262c30' }));
scene.add(back);

let tex: THREE.DataTexture | null = null;

function ensureTexture(w: number, h: number) {
  if (tex && tex.image.width === w && tex.image.height === h) return tex;
  tex?.dispose();
  tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  renderer.initTexture(tex); // GPU 側の領域を先に確保する
  material.map = tex;
  material.needsUpdate = true;
  result.texSize = `${w} x ${h}`;
  return tex;
}

function fitPlaneToPanel(aspect = panel.offsetHeight / panel.offsetWidth) {
  const h = PLANE_W * aspect;
  if (Math.abs(h - planeH) < 1e-6) return;
  planeH = h;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(PLANE_W, planeH);
  back.scale.set(PLANE_W + 0.08, planeH + 0.08, 1);
  back.position.copy(mesh.position);
  back.rotation.copy(mesh.rotation);
  back.translateZ(-0.03);
}

// パネル（DOM）→ WebGL テクスチャ
function uploadPanel() {
  const size = canvas.getElementImageDefaultSize(panel); // canvas の実ピクセル基準（CSS px × dpr）
  const w = Math.ceil(size.width);
  const h = Math.ceil(size.height);
  const t = ensureTexture(w, h);
  const glTex = (renderer.properties.get(t) as { __webglTexture?: WebGLTexture }).__webglTexture;
  if (!glTex) throw new Error('WebGL texture not allocated');
  renderer.state.bindTexture(gl.TEXTURE_2D, glTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // DOM は上が原点、WebGL の UV は下が原点
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, panel);
  result.glError = gl.getError();
  renderer.resetState(); // 直接 GL を触ったので three.js の状態キャッシュを捨てる
  result.uploads++;
}

// ---- 要素 → canvas の変換行列 -------------------------------------------------
const tmp = new THREE.Matrix4();
function elementToCanvasMatrix(targetW: number, targetH: number) {
  const cssW = panel.offsetWidth;
  const cssH = panel.offsetHeight;
  // 要素の CSS px（左上原点・下向き y）→ 平面のローカル座標（中心原点・上向き y、単位 m）
  const elemToLocal = new THREE.Matrix4()
    .makeScale(PLANE_W / cssW, -planeH / cssH, 1)
    .multiply(tmp.makeTranslation(-cssW / 2, -cssH / 2, 0));
  // クリップ座標 → canvas 座標（左上原点・下向き y）
  const viewport = new THREE.Matrix4().set(
    targetW / 2, 0, 0, targetW / 2,
    0, -targetH / 2, 0, targetH / 2,
    0, 0, 1, 0,
    0, 0, 0, 1,
  );
  return viewport
    .multiply(camera.projectionMatrix)
    .multiply(camera.matrixWorldInverse)
    .multiply(mesh.matrixWorld)
    .multiply(elemToLocal);
}

const planeNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();
function syncGeometry() {
  mesh.updateMatrixWorld();
  camera.updateMatrixWorld();
  // 平面を裏から見ているとき（FrontSide なので何も描かれない）はクリック判定も外す
  planeNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
  toCamera.copy(camera.position).sub(mesh.position);
  const backface = planeNormal.dot(toCamera) <= 0;
  if (backface) {
    if (!result.backface) canvas.clearElementGeometry(panel);
    result.backface = true;
    return;
  }
  result.backface = false;
  const [w, h] =
    result.geometryMode === 'grid' ? [canvas.width, canvas.height] : [canvas.clientWidth, canvas.clientHeight];
  const m = elementToCanvasMatrix(w, h);
  // three.js の elements と DOMMatrix の16要素はどちらも列優先
  canvas.updateElementGeometry(panel, { canvasTransform: DOMMatrix.fromFloat64Array(new Float64Array(m.elements)) });
}

// 要素内の点（CSS px）が canvas 上のどの CSS 座標に来るか
function projectToClient(ex: number, ey: number) {
  const m = elementToCanvasMatrix(canvas.clientWidth, canvas.clientHeight);
  const v = new THREE.Vector4(ex, ey, 0, 1).applyMatrix4(m);
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + canvas.clientLeft + v.x / v.w, y: rect.top + canvas.clientTop + v.y / v.w };
}

// パネル内の要素の中心（パネル左上基準の CSS px）。#panel は position: relative なので offsetParent は panel
function centerOf(el: HTMLElement) {
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
}

function probeHits() {
  result.probes = [applause, reset, light, lamp].map((el) => {
    const c = centerOf(el);
    const p = projectToClient(c.x, c.y);
    const hit = document.elementFromPoint(p.x, p.y);
    return { id: el.id, x: Math.round(p.x), y: Math.round(p.y), hit: hit ? hit.id || hit.tagName : null };
  });
}

// 描画直後に WebGL の描画バッファから色見本の色を読む（同じタスク内ならバッファは有効）
function sampleLamp() {
  const c = centerOf(lamp);
  const m = elementToCanvasMatrix(canvas.width, canvas.height);
  const v = new THREE.Vector4(c.x, c.y, 0, 1).applyMatrix4(m);
  const px = Math.round(v.x / v.w);
  const py = Math.round(canvas.height - v.y / v.w);
  const buf = new Uint8Array(4);
  gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  result.lampScreenPixel = Array.from(buf);
  result.lampExpected = lampLevel(Number(light.value));
  result.lampMatches = Array.from(buf.slice(0, 3)).every((v) => Math.abs(v - result.lampExpected!) <= 4);
}

// ---- パネルの中身（通常のDOMのコード） --------------------------------------
let count = 0;
function lampLevel(v: number) {
  return Math.round(20 + (v / 100) * 230);
}
function applyLight() {
  const v = Number(light.value);
  result.sliderValue = v;
  lightValue.textContent = String(v);
  const c = lampLevel(v);
  lamp.style.background = `rgb(${c}, ${c}, ${c})`;
  lights.ambient.intensity = 0.2 + (v / 100) * 1.6; // 3D 展示室の照明に連動
}
applause.addEventListener('click', () => {
  result.applauseClicks++;
  countEl.textContent = String(++count);
});
reset.addEventListener('click', () => {
  result.resetClicks++;
  count = 0;
  countEl.textContent = '0';
});
light.addEventListener('input', applyLight);
applyLight();

// ---- 非対応時の代替表示（TMS 28）--------------------------------------------
// 3D 内の平面には「作品名＋クリックして操作」の案内を CanvasTexture で描き、
// 平面をクリックしたら同じ #panel を通常 DOM の <dialog> に移して操作させる。作品のコードは1つのまま。
const PH_W = 640;
const PH_H = 600;
let placeholder: THREE.CanvasTexture | null = null;
let dialog: HTMLDialogElement | null = null;
const raycaster = new THREE.Raycaster();

function drawPlaceholder() {
  if (!placeholder) return;
  const c = placeholder.image as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, PH_W, PH_H);
  g.fillStyle = '#8a6a3a';
  g.font = '600 22px system-ui, sans-serif';
  g.fillText(panel.querySelector('.eyebrow')?.textContent ?? '', 48, 72);
  g.fillStyle = '#1b1a17';
  g.font = '700 48px "Hiragino Mincho ProN", serif';
  g.fillText(panel.querySelector('h2')?.textContent ?? '', 48, 140);
  g.font = '700 80px system-ui, sans-serif';
  g.fillText(countEl.textContent ?? '', 48, 250);
  g.font = '600 26px system-ui, sans-serif';
  g.fillStyle = '#5c564d';
  g.fillText(`展示照明の明るさ ${lightValue.textContent}`, 48, 310);
  // 「クリックして操作」ボタン風の帯
  g.fillStyle = '#b8322c';
  g.beginPath();
  g.roundRect(48, 360, PH_W - 96, 96, 14);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '700 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('▶ クリックして操作する', PH_W / 2, 422);
  g.textAlign = 'left';
  g.fillStyle = '#7a7368';
  g.font = '500 20px system-ui, sans-serif';
  g.fillText('このブラウザでは3D内で直接操作できないため、', 48, 512);
  g.fillText('パネルを開いて操作します（Chrome 157以降は直接操作）', 48, 542);
  placeholder.needsUpdate = true;
}

function setupFallback() {
  canvas.removeAttribute('content'); // 非対応ブラウザと同じ状態にする（子要素は canvas のフォールバック内容）
  const c = document.createElement('canvas');
  c.width = PH_W;
  c.height = PH_H;
  placeholder = new THREE.CanvasTexture(c);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.anisotropy = renderer.capabilities.getMaxAnisotropy();
  material.map = placeholder;
  material.needsUpdate = true;
  fitPlaneToPanel(PH_H / PH_W);
  drawPlaceholder();

  dialog = document.createElement('dialog');
  dialog.id = 'fallbackDialog';
  dialog.setAttribute('aria-label', panel.querySelector('h2')?.textContent ?? 'HTML作品');
  dialog.innerHTML =
    '<form method="dialog" class="fallback-bar"><span>HTML作品（通常表示）</span><button id="fallbackClose" value="close" aria-label="閉じる">閉じる ✕</button></form>';
  dialog.append(panel); // canvas の外に出すと通常 DOM として表示・操作できる
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    result.fallback.dialogCloses++;
    result.fallback.dialogOpen = false;
    canvas.focus({ preventScroll: true });
    render();
  });
  canvas.tabIndex = 0;
  // キーボードだけでも開けるように（Enter / Space）
  canvas.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !result.fallback.dialogOpen) {
      e.preventDefault();
      openFallback();
    }
  });
  for (const el of [applause, reset]) el.addEventListener('click', drawPlaceholder);
  light.addEventListener('input', drawPlaceholder);
}

function openFallback() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  result.fallback.dialogOpens++;
  result.fallback.dialogOpen = true;
  applause.focus();
  render();
}

function openFallbackIfPlaneHit(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.intersectObject(mesh, false).length === 0) return;
  result.fallback.planeClicks++;
  openFallback();
}

// ---- 表示 -----------------------------------------------------------------
const ok = (b: boolean | undefined, yes: string, no: string) =>
  b ? `<span class="ok">${yes}</span>` : `<span class="ng">${no}</span>`;
function render() {
  statusEl.innerHTML = [
    `HTML in Canvas (WebGL) : ${ok(result.supported, 'あり', 'なし')}`,
    `表示方式               : ${result.mode === 'html-in-canvas' ? '<span class="ok">3D内で直接操作（HTML in Canvas）</span>' : `<span class="ng">代替表示（通常DOM）</span>${result.supported ? '（?fallback=1 で強制中）' : ''} / 平面クリック ${result.fallback.planeClicks} / 開く ${result.fallback.dialogOpens} / 閉じる ${result.fallback.dialogCloses}${result.fallback.dialogOpen ? ' / 表示中' : ''}`}`,
    `geometry の座標系      : ${result.geometryMode}（?geom=grid で旧方式を再現）`,
    `paint / テクスチャ転送 : ${result.paintEvents} / ${result.uploads} 回、テクスチャ ${result.texSize ?? '-'}、glError ${result.glError ?? '-'}`,
    `色見本（WebGL画面）    : ${result.lampScreenPixel ? `rgb(${result.lampScreenPixel.slice(0, 3).join(',')}) / 期待 ${result.lampExpected}` : '-'} ${result.lampMatches === undefined ? '' : ok(result.lampMatches, '一致', '不一致')}`,
    `クリック判定（投影位置）: ${result.probes.map((p) => `${p.id}@(${p.x},${p.y})→${p.hit === p.id ? `<span class="ok">${p.hit}</span>` : `<span class="ng">${p.hit}</span>`}`).join('  ')}`,
    `操作                   : 拍手 ${result.applauseClicks} / リセット ${result.resetClicks} / 照明 ${result.sliderValue}`,
    `カメラ                 : (${result.camera.x.toFixed(2)}, ${result.camera.y.toFixed(2)}, ${result.camera.z.toFixed(2)}) yaw ${result.camera.yaw.toFixed(2)} pitch ${result.camera.pitch.toFixed(2)} / 視点ドラッグ ${result.cameraDrags} 回 / ${result.orbit ? '自動移動中（?orbit=1）' : '手動（ドラッグ・WASD）'}${result.backface ? ' / <span class="ng">裏面</span>' : ''}`,
    `移動中の判定追従       : ${result.motion.frames} フレーム中 一致 ${result.motion.hits} / 不一致 ${result.motion.misses} / 画面外 ${result.motion.offscreen} ${result.motion.frames ? ok(result.motion.misses === 0, '全一致', '不一致あり') : ''}${result.motion.lastMiss ? ` 最後の不一致: ${result.motion.lastMiss}` : ''}`,
    result.error ? `エラー                 : <span class="ng">${result.error}</span>` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}

// カメラが動いたフレームごとに「拍手する」の中心を投影し、そこで elementFromPoint がボタンを返すか数える
const lastView = { ...view };
function checkMotion() {
  const moved = (Object.keys(view) as (keyof typeof view)[]).some((k) => Math.abs(view[k] - lastView[k]) > 1e-6);
  Object.assign(lastView, view);
  if (!moved || result.backface) return;
  result.motion.frames++;
  const c = centerOf(applause);
  const p = projectToClient(c.x, c.y);
  (window as unknown as { __hicLive: { x: number; y: number } }).__hicLive = { x: Math.round(p.x), y: Math.round(p.y) };
  const rect = canvas.getBoundingClientRect();
  if (p.x < rect.left || p.x > rect.right || p.y < rect.top || p.y > rect.bottom) {
    result.motion.offscreen++;
    return;
  }
  const hit = document.elementFromPoint(p.x, p.y);
  if (hit === applause) result.motion.hits++;
  else {
    result.motion.misses++;
    result.motion.lastMiss = `(${Math.round(p.x)},${Math.round(p.y)})→${hit ? hit.id || hit.tagName : null}`;
  }
}

let needsSample = false;
let lastT = performance.now();
let statusTick = 0;
function frame(now: number) {
  try {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    moveCamera(dt, now / 1000);
    applyCamera();
    if (useHic) syncGeometry();
    renderer.render(scene, camera);
    if (useHic) checkMotion();
    if (++statusTick % 10 === 0) render();
    if (needsSample) {
      sampleLamp();
      probeHits();
      needsSample = false;
      console.log('[HIC] frame', JSON.stringify(result));
      render();
    }
  } catch (e) {
    result.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    render();
    return;
  }
  requestAnimationFrame(frame);
}

resize();
if (useHic) {
  new ResizeObserver(() => {
    resize();
    canvas.requestPaint();
  }).observe(canvas);
  canvas.onpaint = () => {
    result.paintEvents++;
    try {
      fitPlaneToPanel();
      uploadPanel();
      needsSample = true;
    } catch (e) {
      result.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
  };
  canvas.requestPaint();
} else {
  new ResizeObserver(resize).observe(canvas);
  setupFallback();
}
requestAnimationFrame(frame); // 3D の展示室はどちらの方式でも描画する
render();

export {};
