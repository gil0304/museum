// 美術館データ（MuseumDocument）から Three.js のシーンを組み立てる。DOM には触れない。
import * as THREE from 'three';
import type { ExhibitPlacement, MuseumDocument, RoomPart } from '../types/museum';

export interface RoomScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lights: { ambient: THREE.HemisphereLight; key: THREE.DirectionalLight };
}

const FRAME_COLOR = '#262c30';
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

  return { scene, camera, lights: { ambient, key } };
}
