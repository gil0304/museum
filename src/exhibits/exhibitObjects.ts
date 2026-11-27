// 作品の 3D 表示（TMS 44〜53）。美術館データの配置（ExhibitPlacement）と作品ライブラリ（ExhibitAsset）から
// 種類ごとの表示物を作る。座標の決まりは docs/EXHIBITS.md（壁の作品は壁の表面の点から手前へ、床の作品は台座の底から上へ）。
// ライブラリ（data 層）は直接 import せず、main.ts から resolve 関数で受け取る。
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ExhibitAsset, ExhibitPlacement, MuseumDocument } from '../types/museum';
import { buildHtmlExhibit } from './htmlExhibit';

export type ResolveAsset = (id: string) => ExhibitAsset | undefined;

import { PEDESTAL_HEIGHT } from './obstacles';
export { PEDESTAL_HEIGHT, exhibitObstacles } from './obstacles';
const PEDESTAL_COLOR = '#eeebe5';
const FRAME_COLOR = '#262c30';
const FRAME_DEPTH = 0.06;
const ART_DEPTH = 0.04;

export interface ExhibitView {
  placement: ExhibitPlacement;
  asset: ExhibitAsset;
  /** 素材の読み込み状態（作品情報パネル・読み込み失敗の表示。TMS 63） */
  status: 'ready' | 'loading' | 'error';
  /** 作品全体（クリック判定の対象） */
  group: THREE.Group;
  /** 毎フレーム（音量・回転など。必要な作品だけ）。camera は今の視点 */
  update?(dt: number, camera: THREE.Camera): void;
  /** 鑑賞中にクリックされた（動画の再生・一時停止、音の再生・停止など。TMS 49〜） */
  activate?(): void;
  /** 作品情報パネルに添える今の状態（例「再生中」） */
  stateText?(): string;
  /** 素材の読み込みが終わった（影の描き直しなど。main.ts が設定する） */
  onLoad?(): void;
  dispose?(): void;
}

export interface ExhibitSet {
  views: Map<string, ExhibitView>;
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;
}

const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function box(w: number, h: number, d: number, material: THREE.Material | THREE.Material[], z = 0, y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(0, y, z);
  mesh.castShadow = true;
  return mesh;
}

const textureLoader = new THREE.TextureLoader();

/**
 * 箱の正面（+Z）にだけ画像を貼る材質の組。BoxGeometry の面の順は +X, -X, +Y, -Y, +Z, -Z。
 * 読み込むまでは placeholderColor、失敗したらそのまま（真っ白・真っ黒にしない）
 */
function faceMaterials(asset: ExhibitAsset, view: { status: ExhibitView['status'] }, onReady?: () => void) {
  const side = standard(asset.placeholderColor);
  const front = standard(asset.placeholderColor, { roughness: 0.9 });
  if (asset.src) {
    view.status = 'loading';
    textureLoader.load(
      asset.src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        front.map = tex;
        front.color.set('#ffffff');
        front.needsUpdate = true;
        view.status = 'ready';
        onReady?.();
      },
      undefined,
      () => {
        view.status = 'error';
        console.warn(`作品の画像を読み込めませんでした: ${asset.src}`);
      },
    );
  }
  return [side, side, side, side, front, side];
}

// ---- 動画作品（TMS 49）----
/**
 * 展示スクリーン：音の無い動画を最初からループ再生し（ブラウザの自動再生の制限に当たらない）、クリックで一時停止・再生。
 * スクリーンは照明の影響を受けない材質（画面が光って見える）。読み込めなければ仮の色のまま。
 */
function buildVideo(asset: ExhibitAsset, view: ExhibitView, setPiece: (g: THREE.Group) => void): Partial<ExhibitView> {
  const video = document.createElement('video');
  video.src = asset.src ?? '';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const side = standard(FRAME_COLOR);
  const screen = new THREE.MeshBasicMaterial({ color: asset.placeholderColor, toneMapped: false });
  setPiece(buildWallPiece(asset, [side, side, side, side, screen, side]));
  view.status = 'loading';
  let texture: THREE.VideoTexture | null = null;
  let userPaused = false;
  video.addEventListener('loadeddata', () => {
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    screen.map = texture;
    screen.color.set('#ffffff');
    screen.needsUpdate = true;
    view.status = 'ready';
  });
  video.addEventListener('error', () => {
    view.status = 'error';
    console.warn(`作品の動画を読み込めませんでした: ${asset.src}`);
  });
  // 自動再生できない環境（省電力設定など）では、クリックで再生できる
  video.play().catch(() => (userPaused = true));
  return {
    activate() {
      if (video.paused) {
        userPaused = false;
        void video.play();
      } else {
        userPaused = true;
        video.pause();
      }
    },
    stateText: () => (view.status === 'error' ? '動画を読み込めませんでした' : video.paused || userPaused ? '一時停止中 ・ クリックで再生' : '再生中 ・ クリックで一時停止'),
    dispose() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture?.dispose();
    },
  };
}

// ---- 音作品（TMS 50）----
/** 音量が最大になる距離・聞こえなくなり始める距離（m） */
const AUDIO_NEAR = 2;
const AUDIO_FAR = 12;

/** 音作品の面：同心円（スピーカーの見た目）と題名・操作の案内 */
function drawAudioFace(canvas: HTMLCanvasElement, asset: ExhibitAsset, playing: boolean, failed: boolean) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#2b2622';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.42;
  for (let i = 7; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy, (W * 0.3 * i) / 7, 0, Math.PI * 2);
    ctx.strokeStyle = playing ? (i % 2 ? '#c9a86a' : '#8f7444') : i % 2 ? '#6b625a' : '#4a433d';
    ctx.lineWidth = W * 0.012;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, W * 0.05, 0, Math.PI * 2);
  ctx.fillStyle = playing ? '#c9a86a' : '#6b625a';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3f1eb';
  ctx.font = `400 ${Math.round(W * 0.075)}px ${SERIF}`;
  ctx.fillText(asset.title, cx, H * 0.8);
  ctx.fillStyle = playing ? '#c9a86a' : '#a4a49e';
  ctx.font = `600 ${Math.round(W * 0.045)}px ${SANS}`;
  ctx.fillText(failed ? '音を読み込めませんでした' : playing ? '■ 再生中 ・ クリックで停止' : '▶ クリックで再生', cx, H * 0.9);
}

/**
 * 音作品：クリックで再生・停止（ブラウザの自動再生の制限に合わせ、必ず利用者の操作で鳴らす）。ループ再生。
 * 近づくほど大きく聞こえる（AUDIO_NEAR〜AUDIO_FAR で音量を下げる）。部屋を離れる（作り直す）と止まる。
 */
function buildAudio(asset: ExhibitAsset, view: ExhibitView, setPiece: (g: THREE.Group) => void): Partial<ExhibitView> {
  const audio = new Audio();
  audio.src = asset.src ?? '';
  audio.loop = true;
  audio.preload = 'none'; // 押すまで読み込まない（軽さ）
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 640;
  let failed = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    drawAudioFace(canvas, asset, !audio.paused, failed);
    tex.needsUpdate = true;
  };
  redraw();
  const side = standard('#2b2622');
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  setPiece(buildWallPiece(asset, [side, side, side, side, front, side]));
  audio.addEventListener('play', redraw);
  audio.addEventListener('pause', redraw);
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return; // 片付けで src を外したとき
    failed = true;
    view.status = 'error';
    redraw();
    console.warn(`作品の音を読み込めませんでした: ${asset.src}`);
  });
  const here = new THREE.Vector3();
  return {
    activate() {
      if (audio.paused) {
        audio.play().catch(() => {
          failed = true;
          view.status = 'error';
          redraw();
        });
      } else audio.pause();
    },
    stateText: () => (failed ? '音を読み込めませんでした' : audio.paused ? '停止中 ・ クリックで再生' : '再生中 ・ クリックで停止（近づくほど大きく聞こえる）'),
    update(_dt, camera) {
      if (audio.paused) return;
      view.group.getWorldPosition(here);
      const d = here.distanceTo(camera.position);
      audio.volume = Math.max(0.08, Math.min(1, 1 - (d - AUDIO_NEAR) / (AUDIO_FAR - AUDIO_NEAR)));
    },
    dispose() {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      tex.dispose();
    },
  };
}

// ---- 文章作品（TMS 48）----
/** 1m あたりの画素数（文字がにじまない解像度） */
const TEXT_PX_PER_M = 900;
const PAPER = '#f4efe6';
const INK = '#1d2325';
const INK_MUTED = '#5c564d';
const ACCENT_TEXT = '#7a5a2b';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif';
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';
/** 行頭に来てはいけない文字（簡易の禁則処理） */
const NO_LINE_START = '、。，．・：；？！ー」』）】〉》ぁぃぅぇぉっゃゅょァィゥェォッャュョ';

/** 日本語を 1 文字ずつ測って折り返す（英単語の途中でも折り返す。行頭禁則だけ守る） */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth && line && !NO_LINE_START.includes(ch)) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

/** 文章作品の面：紙の色の上に、小見出し・タイトル（明朝）・本文・作者を描いたテクスチャ */
function textTexture(asset: ExhibitAsset): THREE.CanvasTexture {
  const [w, h] = asset.size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * TEXT_PX_PER_M);
  canvas.height = Math.round(h * TEXT_PX_PER_M);
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const pad = W * 0.1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  let y = pad;
  ctx.fillStyle = ACCENT_TEXT;
  ctx.font = `600 ${Math.round(W * 0.026)}px ${SANS}`;
  ctx.fillText('TEXT', pad, y);
  y += W * 0.06;

  ctx.fillStyle = INK;
  const titleSize = Math.round(W * 0.062);
  ctx.font = `400 ${titleSize}px ${SERIF}`;
  for (const line of wrapText(ctx, asset.title, W - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += titleSize * 1.35;
  }
  y += W * 0.02;
  ctx.fillStyle = ACCENT_TEXT;
  ctx.fillRect(pad, y, W * 0.12, Math.max(2, W * 0.003));
  y += W * 0.06;

  ctx.fillStyle = INK;
  const bodySize = Math.round(W * 0.036);
  ctx.font = `400 ${bodySize}px ${SERIF}`;
  for (const line of wrapText(ctx, asset.body ?? '', W - pad * 2)) {
    if (y > H - pad - bodySize * 3) break; // はみ出す分は描かない（作品情報パネルで全文を読める）
    ctx.fillText(line, pad, y);
    y += bodySize * (line ? 1.9 : 0.9);
  }

  ctx.fillStyle = INK_MUTED;
  ctx.font = `400 ${Math.round(W * 0.026)}px ${SANS}`;
  ctx.fillText([asset.author, asset.year].filter(Boolean).join(' ・ '), pad, H - pad - W * 0.03);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 壁の作品：額縁（あれば）と作品面。作品面は壁から FRAME_DEPTH + ART_DEPTH の位置 */
function buildWallPiece(asset: ExhibitAsset, face: THREE.Material | THREE.Material[]): THREE.Group {
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

// ---- 3D 作品（GLB。TMS 51）----
const gltfLoader = new GLTFLoader();
/** 同じ素材は 1 回だけ読み込む（編集で部屋を作り直すたびに読み直さない） */
const gltfCache = new Map<string, Promise<GLTF>>();
function loadGltf(src: string) {
  let p = gltfCache.get(src);
  if (!p) {
    p = gltfLoader.loadAsync(src);
    p.catch(() => gltfCache.delete(src)); // 失敗したら次の作り直しで読み直す
    gltfCache.set(src, p);
  }
  return p;
}

/**
 * 読み込んだモデルを台座の上に載せる。台座の幅の 1.25 倍・作品の高さ（size[1]）に収まるよう縮め、底を台座の上面に合わせる。
 * 形状・材質は読み込んだものを共有するので、部屋の片付け（disposeRoomScene）で解放しないよう印を付ける。
 */
function placeModel(gltf: GLTF, asset: ExhibitAsset): THREE.Object3D {
  const model = gltf.scene.clone(true);
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = o.receiveShadow = true;
      o.userData.sharedAsset = true;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const [pw, h] = asset.size;
  const scale = Math.min(h / size.y, (pw * 1.25) / Math.max(size.x, size.z));
  model.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x * scale, PEDESTAL_HEIGHT - box.min.y * scale, -center.z * scale);
  const holder = new THREE.Group();
  holder.name = 'model';
  holder.add(model);
  return holder;
}

/** 床の作品：台座と、その上の立体（GLB を読み込むまでは仮の結び目。TMS 51） */
function buildFloorPiece(asset: ExhibitAsset, view?: ExhibitView): THREE.Group {
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
  if (asset.type === 'glb' && asset.src && view) {
    view.status = 'loading';
    loadGltf(asset.src).then(
      (gltf) => {
        g.remove(knot);
        knot.geometry.dispose();
        (knot.material as THREE.Material).dispose();
        g.add(placeModel(gltf, asset));
        view.status = 'ready';
        view.onLoad?.();
      },
      () => {
        view.status = 'error'; // 仮の結び目のまま（真っ白・空にしない）
        console.warn(`作品の3Dモデルを読み込めませんでした: ${asset.src}`);
      },
    );
  }
  return g;
}

export function buildExhibit(placement: ExhibitPlacement, asset: ExhibitAsset): ExhibitView {
  const group = new THREE.Group();
  const view: ExhibitView = { placement, asset, group, status: 'ready' };
  let piece: THREE.Group | undefined;
  if (asset.mount === 'floor') piece = buildFloorPiece(asset, view);
  else if (asset.type === 'image') piece = buildWallPiece(asset, faceMaterials(asset, view)); // TMS 45
  else if (asset.type === 'video') Object.assign(view, buildVideo(asset, view, (p) => (piece = p)));
  else if (asset.type === 'audio') Object.assign(view, buildAudio(asset, view, (p) => (piece = p)));
  else if (asset.type === 'interactive-html') Object.assign(view, buildHtmlExhibit(asset, view, (p) => (piece = p))); // TMS 53
  else if (asset.type === 'text') {
    // 文章作品（TMS 48）：紙のパネル。側面は紙の色、正面に文字
    const side = standard(PAPER);
    const front = new THREE.MeshStandardMaterial({ map: textTexture(asset), roughness: 0.95 });
    piece = buildWallPiece(asset, [side, side, side, side, front, side]);
  }
  else piece = buildWallPiece(asset, standard(asset.placeholderColor));
  group.name = placement.id;
  group.userData.exhibitId = placement.id;
  piece ??= buildWallPiece(asset, standard(asset.placeholderColor));
  group.position.set(...placement.position);
  group.rotation.y = placement.rotationY;
  group.add(piece);
  return view;
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
    update(dt, camera) {
      for (const v of views.values()) v.update?.(dt, camera);
    },
    dispose() {
      for (const v of views.values()) {
        v.dispose?.();
        // 画像のテクスチャは材質の dispose では解放されないので、ここで解放する
        v.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) (m as THREE.MeshStandardMaterial).map?.dispose();
          }
        });
      }
    },
  };
}


const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/**
 * 画面の点にある作品を返す（いちばん手前）。壁・床に隠れた作品は返さない（blockers に部屋のパーツを渡す）。
 * x, y は canvas 内の CSS px
 */
export function pickExhibit(
  set: ExhibitSet,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  blockers: THREE.Object3D[] = [],
  maxDistance = 12,
): ExhibitView | null {
  const rect = canvas.getBoundingClientRect();
  ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = maxDistance;
  const groups = [...set.views.values()].map((v) => v.group);
  const hits = raycaster.intersectObjects([...groups, ...blockers], true);
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o && o.userData.exhibitId === undefined) o = o.parent;
    if (!o) return null; // 先に壁・床に当たった
    return set.views.get(o.userData.exhibitId as string) ?? null;
  }
  return null;
}
