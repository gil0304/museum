// HTML作品（TMS 53・54）：公式テンプレートの実 DOM を 3D の壁の上に表示し、その場で操作させる。
// 方式は TMS 26〜28 の検証どおり（docs/HTML_IN_CANVAS.md）:
// - 対応（Chrome 157+）：3D を描く canvas の子にパネルを入れ（content="drawable"）、paint のたびに
//   gl.texElementSubImage2D でテクスチャへ転送。毎フレーム、平面の位置から「要素 → canvas（CSS px）」の行列を作り
//   updateElementGeometry に渡すと、クリック・ドラッグがそのまま DOM に届く。
// - 非対応・?fallback=1：平面には案内を描き、クリックで同じパネルを <dialog> に移して通常の DOM として操作させる。
import * as THREE from 'three';
import type { ExhibitAsset } from '../types/museum';
import { detectHtmlInCanvasMode, type HtmlInCanvasMode } from './htmlInCanvasSupport';
import { createTemplate, type HtmlTemplate } from './htmlTemplates';
import type { ExhibitView } from './exhibitObjects';

/** これより遠い・壁に隠れた・裏から見たパネルはクリック判定を外す（壁越しに押せないように） */
const INTERACT_DISTANCE = 9;

interface Host {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  gl: WebGL2RenderingContext;
  mode: HtmlInCanvasMode;
  items: Set<HtmlItem>;
  /** 鑑賞中だけ操作できる（編集中・タイトルでは作品として選べるよう判定を外す） */
  interactive: boolean;
  dialog: HTMLDialogElement | null;
}

interface HtmlItem {
  panel: HTMLElement;
  upload(): void;
}

let host: Host | null = null;

/** HTML 作品の方式（対応・代替表示） */
export function htmlExhibitMode(): HtmlInCanvasMode {
  return host?.mode ?? detectHtmlInCanvasMode();
}

/** アプリの起動時に 1 回：3D を描く canvas を HTML in Canvas の描画先にする */
export function initHtmlExhibits(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const mode = detectHtmlInCanvasMode();
  const gl = renderer.getContext() as WebGL2RenderingContext;
  host = { canvas, renderer, gl, mode, items: new Set(), interactive: false, dialog: null };
  if (mode !== 'html-in-canvas') return;
  canvas.setAttribute('content', 'drawable');
  canvas.onpaint = () => {
    for (const item of host!.items) {
      try {
        item.upload();
      } catch (e) {
        console.warn('HTML作品の描画に失敗しました', e);
      }
    }
  };
  new ResizeObserver(() => canvas.requestPaint()).observe(canvas);
}

/** 鑑賞中だけ HTML 作品を直接操作できるようにする（編集・タイトルでは外す） */
export function setHtmlInteractive(interactive: boolean) {
  if (!host) return;
  host.interactive = interactive;
  if (!interactive && host.mode === 'html-in-canvas') for (const item of host.items) host.canvas.clearElementGeometry(item.panel);
}

/** 代替表示のダイアログ（1 つを使い回す） */
function fallbackDialog(h: Host) {
  if (h.dialog) return h.dialog;
  const d = document.createElement('dialog');
  d.className = 'hic-dialog';
  const bar = document.createElement('form');
  bar.method = 'dialog';
  bar.className = 'hic-dialog__bar';
  const label = document.createElement('span');
  label.textContent = 'HTML作品（このブラウザでは通常の画面で操作します）';
  const close = document.createElement('button');
  close.textContent = '閉じる ✕';
  close.value = 'close';
  bar.append(label, close);
  const body = document.createElement('div');
  body.className = 'hic-dialog__body';
  d.append(bar, body);
  document.body.append(d);
  h.dialog = d;
  return d;
}

/** 代替表示の平面に描く案内（作品名・今の様子・「クリックして操作する」） */
function drawPlaceholder(canvas: HTMLCanvasElement, asset: ExhibitAsset, tpl: HtmlTemplate) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7a5a2b';
  g.font = `600 ${W * 0.034}px system-ui, sans-serif`;
  g.fillText('INTERACTIVE ・ HTML', W * 0.08, H * 0.14);
  g.fillStyle = '#1b1a17';
  g.font = `400 ${W * 0.075}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
  g.fillText(asset.title, W * 0.08, H * 0.3);
  g.fillStyle = '#5c564d';
  g.font = `500 ${W * 0.042}px system-ui, sans-serif`;
  g.fillText(tpl.summary(), W * 0.08, H * 0.42);
  g.fillStyle = '#b8322c';
  g.beginPath();
  g.roundRect(W * 0.08, H * 0.52, W * 0.84, H * 0.16, W * 0.02);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `700 ${W * 0.05}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.fillText('▶ クリックして操作する', W / 2, H * 0.625);
  g.textAlign = 'left';
  g.fillStyle = '#7a7368';
  g.font = `500 ${W * 0.032}px system-ui, sans-serif`;
  g.fillText('このブラウザでは3Dの中で直接は触れないため、', W * 0.08, H * 0.8);
  g.fillText('パネルを開いて操作します（Chrome 157 以降は直接操作）', W * 0.08, H * 0.87);
}

/**
 * HTML 作品の表示物を作る。setPiece に 3D の表示物（裏板＋パネルの平面）を渡し、ExhibitView に足す関数を返す。
 * テンプレートが無い（知らない名前）なら案内だけの板にする。
 */
export function buildHtmlExhibit(asset: ExhibitAsset, view: ExhibitView, setPiece: (g: THREE.Group) => void): Partial<ExhibitView> {
  const h = host;
  const tpl = createTemplate(asset.template);
  const [w] = asset.size;
  const g = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }); // HTML の色をそのまま出す
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.name = 'face';
  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.04), new THREE.MeshStandardMaterial({ color: '#262c30', roughness: 0.8 }));
  back.castShadow = true;
  g.add(back, plane);
  setPiece(g);

  /** パネルの縦横比に合わせて平面と裏板の大きさを決める（壁の表面から手前へ） */
  let planeH = asset.size[1];
  const fit = (aspect: number) => {
    planeH = w * aspect;
    plane.scale.set(w, planeH, 1);
    plane.position.set(0, 0, 0.045);
    back.scale.set(w + 0.06, planeH + 0.06, 1);
    back.position.set(0, 0, 0.02);
  };
  fit(asset.size[1] / w);

  if (!h || !tpl) {
    material.color.set(asset.placeholderColor);
    if (!tpl) view.status = 'error';
    return {};
  }
  const panel = tpl.panel;

  if (h.mode === 'html-in-canvas') {
    // ---- 3D の中で直接操作（HTML in Canvas）----
    h.canvas.append(panel);
    let tex: THREE.DataTexture | null = null;
    const item: HtmlItem = {
      panel,
      upload() {
        if (!panel.offsetWidth) return;
        fit(panel.offsetHeight / panel.offsetWidth);
        const size = h.canvas.getElementImageDefaultSize(panel); // canvas の実ピクセル基準（CSS px × dpr）
        const tw = Math.ceil(size.width);
        const th = Math.ceil(size.height);
        if (!tw || !th) return;
        if (!tex || tex.image.width !== tw || tex.image.height !== th) {
          tex?.dispose();
          tex = new THREE.DataTexture(new Uint8Array(tw * th * 4), tw, th);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.anisotropy = h.renderer.capabilities.getMaxAnisotropy();
          tex.needsUpdate = true;
          h.renderer.initTexture(tex); // GPU 側の領域を先に確保する
          material.map = tex;
          material.needsUpdate = true;
        }
        const glTex = (h.renderer.properties.get(tex) as { __webglTexture?: WebGLTexture }).__webglTexture;
        if (!glTex) return;
        h.renderer.state.bindTexture(h.gl.TEXTURE_2D, glTex);
        h.gl.pixelStorei(h.gl.UNPACK_FLIP_Y_WEBGL, true); // DOM は上が原点、WebGL の UV は下が原点
        h.gl.pixelStorei(h.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        h.gl.texElementSubImage2D(h.gl.TEXTURE_2D, 0, 0, 0, panel);
        h.renderer.resetState(); // 直接 GL を触ったので three.js の状態キャッシュを捨てる
        view.status = 'ready';
      },
    };
    h.items.add(item);
    view.status = 'loading';
    h.canvas.requestPaint();

    const m = new THREE.Matrix4();
    const tmp = new THREE.Matrix4();
    const viewport = new THREE.Matrix4();
    const normal = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const center = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    let attached = false;
    const detach = () => {
      if (attached) h.canvas.clearElementGeometry(panel);
      attached = false;
    };
    return {
      update(_dt, camera) {
        if (!h.interactive) return detach();
        plane.updateMatrixWorld();
        camera.updateMatrixWorld();
        plane.getWorldPosition(center);
        normal.set(0, 0, 1).transformDirection(plane.matrixWorld);
        toCam.copy(camera.position).sub(center);
        const dist = toCam.length();
        // 裏から見ている・遠い・あいだに壁がある → 押せないようにする
        if (normal.dot(toCam) <= 0 || dist > INTERACT_DISTANCE) return detach();
        const scene = view.group.parent;
        if (scene) {
          ray.set(camera.position, toCam.clone().negate().normalize());
          ray.far = dist - 0.1;
          const walls = scene.children.filter((o) => o.userData.partType === 'wall');
          if (ray.intersectObjects(walls, false).length) return detach();
        }
        const cssW = panel.offsetWidth;
        const cssH = panel.offsetHeight;
        if (!cssW || !cssH) return;
        const cw = h.canvas.clientWidth;
        const ch = h.canvas.clientHeight;
        // 要素の CSS px（左上原点・下向き y）→ 平面のローカル座標（中心原点・上向き y、単位は平面の大きさ 1）
        const elemToLocal = tmp.makeScale(1 / cssW, -1 / cssH, 1).multiply(new THREE.Matrix4().makeTranslation(-cssW / 2, -cssH / 2, 0));
        viewport.set(cw / 2, 0, 0, cw / 2, 0, -ch / 2, 0, ch / 2, 0, 0, 1, 0, 0, 0, 0, 1);
        m.copy(viewport)
          .multiply((camera as THREE.PerspectiveCamera).projectionMatrix)
          .multiply(camera.matrixWorldInverse)
          .multiply(plane.matrixWorld)
          .multiply(elemToLocal);
        // three.js の elements と DOMMatrix の 16 要素はどちらも列優先。出力は canvas の CSS px（TMS 26 で検証）
        h.canvas.updateElementGeometry(panel, { canvasTransform: DOMMatrix.fromFloat64Array(new Float64Array(m.elements)) });
        attached = true;
      },
      stateText: () => '3D の壁の上で、ボタンとスライダーをそのまま操作できます',
      dispose() {
        detach();
        h.items.delete(item);
        panel.remove();
        tex?.dispose();
      },
    };
  }

  // ---- 代替表示：案内を描き、クリックでダイアログに移して操作 ----
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = Math.round(800 * (asset.size[1] / w));
  const placeholder = new THREE.CanvasTexture(c);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    drawPlaceholder(c, asset, tpl);
    placeholder.needsUpdate = true;
  };
  redraw();
  tpl.onChange(redraw);
  material.map = placeholder;
  return {
    activate() {
      const d = fallbackDialog(h);
      if (d.open) return;
      d.querySelector('.hic-dialog__body')!.replaceChildren(panel);
      d.showModal();
      panel.querySelector<HTMLElement>('button')?.focus();
    },
    stateText: () => 'このブラウザでは、クリックで開くパネルで操作します',
    dispose() {
      if (h.dialog?.open && h.dialog.contains(panel)) h.dialog.close();
      panel.remove();
      placeholder.dispose();
    },
  };
}
