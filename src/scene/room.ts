// 美術館データ（MuseumDocument）から Three.js のシーンを組み立てる。DOM には触れない。
import * as THREE from 'three';
import { ROOM_GRID, type ExhibitPlacement, type MuseumDocument, type RoomPart } from '../types/museum';

export interface RoomScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lights: { ambient: THREE.HemisphereLight; key: THREE.DirectionalLight };
}

const FRAME_COLOR = '#262c30';
const CEILING_COLOR = '#f1eee8';
const CEILING_LIGHT_COLOR = '#fff7e8';
const CEILING_GLOW = 0.5;
const FRAME_DEPTH = 0.09;
const ART_DEPTH = 0.1;
const FRAME_BEHIND_ART = 0.08; // 額縁は作品面より少し奥

const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function box(size: THREE.Vector3Tuple, position: THREE.Vector3Tuple, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  return mesh;
}

function buildPart(part: RoomPart) {
  const mesh = box(part.size, part.position, standard(part.color ?? '#eeebe5'));
  mesh.name = part.id;
  return mesh;
}

/**
 * 天井（TMS 34）。データには持たず、床・壁の範囲を覆う板を壁の上端に張る（編集の対象外）。
 * 板は下向きの片面だけ描くので、編集モードの斜め上からの視点（TMS 39〜）では邪魔にならない。
 */
export function buildCeiling(parts: RoomPart[]): THREE.Group | null {
  const shell = parts.filter((p) => p.type === 'floor' || p.type === 'wall');
  if (shell.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const { position: [x, , z], size: [w, , d] } of shell) {
    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minZ = Math.min(minZ, z - d / 2);
    maxZ = Math.max(maxZ, z + d / 2);
  }
  // 高さは壁の上端（壁が無ければ既定の 3m）
  const walls = parts.filter((p) => p.type === 'wall');
  const height = walls.length ? Math.max(...walls.map((p) => p.position[1] + p.size[1] / 2)) : ROOM_GRID.wallHeight;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const group = new THREE.Group();
  group.name = 'ceiling';
  const facingDown = (w: number, d: number, material: THREE.Material, y: number, z = cz) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    plane.rotation.x = Math.PI / 2; // 法線を下に向ける（片面）
    plane.position.set(cx, y, z);
    return plane;
  };
  // 下向きの面には上からの光が当たらず暗くなりすぎるため、少しだけ自ら光らせて明るい天井に見せる（TMS 35 で再調整）
  const surface = standard(CEILING_COLOR, { emissive: CEILING_COLOR, emissiveIntensity: CEILING_GLOW });
  group.add(facingDown(width, depth, surface, height));
  // 天井の照明（光る帯）。実際の明るさ・影は TMS 35 で照明として調整する
  const light = new THREE.MeshBasicMaterial({ color: CEILING_LIGHT_COLOR });
  const stripLength = Math.max(width - 1.6, width * 0.6);
  for (const offset of depth >= 4 ? [-depth / 4, depth / 4] : [0]) {
    group.add(facingDown(stripLength, 0.32, light, height - 0.01, cz + offset));
  }
  return group;
}

// 素材が入るまでの仮表示。画像系は色の板（＋額縁）、GLB は仮の彫刻。
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
    group.add(knot);
    return group;
  }

  const [w, h] = ex.size ?? [1, 1];
  group.add(box([w, h, ART_DEPTH], [0, 0, 0], standard(color)));
  if (ex.frameSize) {
    const [fw, fh] = ex.frameSize;
    group.add(box([fw, fh, FRAME_DEPTH], [0, 0, -FRAME_BEHIND_ART], standard(FRAME_COLOR)));
  }
  return group;
}

/** 美術館を切り替えるとき、古いシーンの GPU 資源（形状・材質）を解放する */
export function disposeRoomScene(room: RoomScene) {
  room.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
    }
  });
}

export function createRoomScene(doc: MuseumDocument): RoomScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d6d5d1');

  const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 100);
  camera.position.set(0, 2.4, 8);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x8b7968, 1.0);
  const key = new THREE.DirectionalLight(0xffefdb, 2.2);
  key.position.set(-3, 8, 4);
  scene.add(ambient, key);

  for (const part of doc.objects) scene.add(buildPart(part));
  for (const ex of doc.exhibits) scene.add(buildExhibit(ex));
  const ceiling = buildCeiling(doc.objects);
  if (ceiling) scene.add(ceiling);

  return { scene, camera, lights: { ambient, key } };
}
