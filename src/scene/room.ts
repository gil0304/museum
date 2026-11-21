// 美術館データ（MuseumDocument）から Three.js のシーンを組み立てる。DOM には触れない。
import * as THREE from 'three';
import { ROOM_GRID, type ExhibitPlacement, type MuseumDocument, type RoomPart } from '../types/museum';

export interface RoomScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 固定の基本照明（TMS 35）。ユーザーが照明を置く機能は作らない（docs/SUBMISSION_SCOPE.md） */
  lights: { ambient: THREE.HemisphereLight; key: THREE.DirectionalLight; fill: THREE.DirectionalLight };
}

export interface RoomSceneOptions {
  /** 影の解像度（px）。PC 2048、スマホなど軽くしたいとき 1024。影を描くかどうかはレンダラー側（viewer）で決める */
  shadowMapSize?: number;
}

const FRAME_COLOR = '#262c30';
const CEILING_COLOR = '#f1eee8';
const CEILING_LIGHT_COLOR = '#fff7e8';
const CEILING_GLOW = 0.45;
const FRAME_DEPTH = 0.09;
const ART_DEPTH = 0.1;
const FRAME_BEHIND_ART = 0.08; // 額縁は作品面より少し奥

// ---- 基本照明（TMS 35）----
// 天井の照明から降りてくる柔らかい光を想定。全体の明るさは半球光、影は手前上からの主光だけが落とす。
const LIGHT = {
  sky: '#fffaf2', // 半球光：上（天井側）の色
  ground: '#b3a797', // 半球光：下（床の照り返し）の色。暗くすると横の壁が沈む
  ambient: 1.5,
  // 主光は手前上から約 57° で壁に当てる（美術館の照明と同じく、額縁の影が下に短く落ちる角度）
  key: { color: '#fff1de', intensity: 1.7, offset: [-1.2, 7, 4.5] as THREE.Vector3Tuple },
  fill: { color: '#f3f1ff', intensity: 0.55, offset: [2.5, 2.2, 9] as THREE.Vector3Tuple }, // 手前右から壁と作品の正面を起こす（影なし）
};

const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function box(size: THREE.Vector3Tuple, position: THREE.Vector3Tuple, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  return mesh;
}

/** 床・壁が占める範囲（XZ）と天井の高さ。天井と影の範囲に使う */
interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

function roomBounds(parts: RoomPart[]): RoomBounds | null {
  const shell = parts.filter((p) => p.type === 'floor' || p.type === 'wall');
  if (shell.length === 0) return null;
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const { position: [x, , z], size: [w, , d] } of shell) {
    b.minX = Math.min(b.minX, x - w / 2);
    b.maxX = Math.max(b.maxX, x + w / 2);
    b.minZ = Math.min(b.minZ, z - d / 2);
    b.maxZ = Math.max(b.maxZ, z + d / 2);
  }
  // 高さは壁の上端（壁が無ければ既定の 3m）
  const walls = parts.filter((p) => p.type === 'wall');
  const height = walls.length ? Math.max(...walls.map((p) => p.position[1] + p.size[1] / 2)) : ROOM_GRID.wallHeight;
  return { ...b, height };
}

/**
 * 床・壁・展示台。影は受けるだけ（壁が影を落とすと、天井の外から光が差しているように見えるため）。
 * 展示台は作品と同じく影を落とす。
 */
function buildPart(part: RoomPart) {
  const mesh = box(part.size, part.position, standard(part.color ?? '#eeebe5'));
  mesh.name = part.id;
  mesh.receiveShadow = true;
  mesh.castShadow = part.type === 'pedestal';
  return mesh;
}

/**
 * 天井（TMS 34）。データには持たず、床・壁の範囲を覆う板を壁の上端に張る（編集の対象外）。
 * 板は下向きの片面だけ描くので、編集モードの斜め上からの視点（TMS 39〜）では邪魔にならない。
 * 影は落とさない・受けない（主光は天井の照明を表しているため）。
 */
function buildCeiling(b: RoomBounds): THREE.Group {
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  const group = new THREE.Group();
  group.name = 'ceiling';
  const facingDown = (w: number, d: number, material: THREE.Material, y: number, z = cz) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    plane.rotation.x = Math.PI / 2; // 法線を下に向ける（片面）
    plane.position.set(cx, y, z);
    return plane;
  };
  // 下向きの面には上からの光が当たらず暗くなりすぎるため、少しだけ自ら光らせて明るい天井に見せる
  const surface = standard(CEILING_COLOR, { emissive: CEILING_COLOR, emissiveIntensity: CEILING_GLOW });
  group.add(facingDown(width, depth, surface, b.height));
  // 天井の照明（光る帯）。見た目だけで、実際の光は LIGHT の主光・半球光が担う
  const light = new THREE.MeshBasicMaterial({ color: CEILING_LIGHT_COLOR });
  const stripLength = Math.max(width - 1.6, width * 0.6);
  for (const offset of depth >= 4 ? [-depth / 4, depth / 4] : [0]) {
    group.add(facingDown(stripLength, 0.32, light, b.height - 0.01, cz + offset));
  }
  return group;
}

// 素材が入るまでの仮表示。画像系は色の板（＋額縁）、GLB は仮の彫刻。どれも影を落とす。
function buildExhibit(ex: ExhibitPlacement) {
  const group = new THREE.Group();
  group.name = ex.id;
  group.position.set(...ex.position);
  group.rotation.y = ex.rotationY ?? 0;
  const color = ex.placeholderColor ?? '#888888';

  if (ex.type === 'glb') {
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.37, 0.13, 84, 10),
      new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.4 }),
    );
    knot.castShadow = true;
    knot.receiveShadow = true;
    group.add(knot);
    return group;
  }

  const [w, h] = ex.size ?? [1, 1];
  const art = box([w, h, ART_DEPTH], [0, 0, 0], standard(color));
  art.castShadow = true;
  group.add(art);
  if (ex.frameSize) {
    const [fw, fh] = ex.frameSize;
    const frame = box([fw, fh, FRAME_DEPTH], [0, 0, -FRAME_BEHIND_ART], standard(FRAME_COLOR));
    frame.castShadow = true;
    group.add(frame);
  }
  return group;
}

/** 主光と影の範囲を部屋に合わせる。影の正射影カメラが部屋全体を覆うようにする */
function aimKeyLight(key: THREE.DirectionalLight, b: RoomBounds | null, mapSize: number) {
  const cx = b ? (b.minX + b.maxX) / 2 : 0;
  const cz = b ? (b.minZ + b.maxZ) / 2 : 0;
  key.position.set(cx + LIGHT.key.offset[0], LIGHT.key.offset[1], cz + LIGHT.key.offset[2]);
  key.target.position.set(cx, 0, cz);

  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  // 光は斜めに入るので、部屋の対角＋高さぶんの余裕を持たせる
  const reach = b ? Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + b.height * 0.5 : 8;
  const cam = key.shadow.camera;
  cam.left = -reach;
  cam.right = reach;
  cam.top = reach;
  cam.bottom = -reach;
  cam.near = 0.5;
  cam.far = 30;
  cam.updateProjectionMatrix();
  key.shadow.bias = -0.0004; // 壁・床のしま模様（シャドウアクネ）を防ぐ
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3; // PCFSoftShadowMap では無視されるが、PCF に切り替えたときのぼかし
}

/** 美術館を切り替えるとき、古いシーンの GPU 資源（形状・材質・影のマップ）を解放する */
export function disposeRoomScene(room: RoomScene) {
  room.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
    }
  });
  room.lights.key.shadow.dispose();
}

export function createRoomScene(doc: MuseumDocument, options: RoomSceneOptions = {}): RoomScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d6d5d1');

  const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 100);
  camera.position.set(0, 2.4, 8);

  const bounds = roomBounds(doc.objects);

  const ambient = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.ambient);
  const key = new THREE.DirectionalLight(LIGHT.key.color, LIGHT.key.intensity);
  aimKeyLight(key, bounds, options.shadowMapSize ?? 2048);
  const fill = new THREE.DirectionalLight(LIGHT.fill.color, LIGHT.fill.intensity);
  fill.position.set(...LIGHT.fill.offset);
  scene.add(ambient, key, key.target, fill);

  for (const part of doc.objects) scene.add(buildPart(part));
  for (const ex of doc.exhibits) scene.add(buildExhibit(ex));
  if (bounds) scene.add(buildCeiling(bounds));

  return { scene, camera, lights: { ambient, key, fill } };
}
