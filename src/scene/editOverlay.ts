// 編集モードの表示（TMS 39〜43）：床のグリッド、手前の壁の半透明化。配置プレビュー・選択の強調もここに足す。
// 部屋のシーンを作り直しても使い回せるよう、表示物は 1 つの group にまとめ、新しいシーンに add し直す。
import * as THREE from 'three';
import { ROOM_GRID } from '../types/museum';
import type { RoomScene } from './room';

const GRID_COLOR = '#7a5a2b'; // 真鍮色の濃い版（--c-accent-text）。床（#b9b2a8）の上で見える
const GRID_EDGE_COLOR = '#c9a86a'; // 配置できる範囲の外枠（--c-accent）
const CUTAWAY_OPACITY = 0.16;

/** グリッドの半分の幅（m）。12×12 マスなら 6 */
export const GRID_HALF = (ROOM_GRID.maxCells * ROOM_GRID.cell) / 2;

export interface EditOverlay {
  /** 編集用の表示物（シーンに add する） */
  group: THREE.Group;
  setVisible(visible: boolean): void;
  /**
   * カメラと部屋の中心のあいだにある壁を半透明にする（毎フレーム）。
   * enabled=false で元に戻す（鑑賞モード）
   */
  updateCutaway(room: RoomScene, camera: THREE.Camera, enabled: boolean): void;
}

export function createEditOverlay(): EditOverlay {
  const group = new THREE.Group();
  group.name = 'edit-overlay';
  group.visible = false;

  const cells = ROOM_GRID.maxCells;
  const grid = new THREE.GridHelper(GRID_HALF * 2, cells, GRID_COLOR, GRID_COLOR);
  const gridMat = grid.material as THREE.LineBasicMaterial;
  gridMat.transparent = true;
  gridMat.opacity = 0.45;
  gridMat.depthWrite = false;
  grid.position.y = 0.006; // 床の上面（y=0）とのちらつきを避ける
  grid.renderOrder = 1;
  group.add(grid);

  // 配置できる範囲（12×12 マス）の外枠
  const h = GRID_HALF;
  const edge = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-h, 0.01, -h),
      new THREE.Vector3(h, 0.01, -h),
      new THREE.Vector3(h, 0.01, h),
      new THREE.Vector3(-h, 0.01, h),
    ]),
    new THREE.LineBasicMaterial({ color: GRID_EDGE_COLOR, transparent: true, opacity: 0.9 }),
  );
  group.add(edge);

  const center = new THREE.Vector3();
  const toWall = new THREE.Vector2();
  const toCam = new THREE.Vector2();

  return {
    group,
    setVisible(visible) {
      group.visible = visible;
    },
    updateCutaway(room, camera, enabled) {
      // 部屋の中心 = 床の範囲の中心
      const box = new THREE.Box3();
      for (const mesh of room.parts.values()) if (mesh.userData.partType === 'floor') box.expandByObject(mesh);
      if (box.isEmpty()) center.set(0, 0, 0);
      else box.getCenter(center);
      toCam.set(camera.position.x - center.x, camera.position.z - center.z).normalize();

      for (const mesh of room.parts.values()) {
        if (mesh.userData.partType !== 'wall') continue;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        toWall.set(mesh.position.x - center.x, mesh.position.z - center.z);
        // 壁が中心からカメラ側にあれば（内積が正）、中が見えるように薄くする
        const between = enabled && toWall.lengthSq() > 0.01 && toWall.normalize().dot(toCam) > 0.35;
        const opacity = between ? CUTAWAY_OPACITY : 1;
        if (mat.opacity !== opacity) {
          mat.transparent = between;
          mat.opacity = opacity;
          mat.depthWrite = !between;
          mat.needsUpdate = true;
          mesh.castShadow = false;
        }
      }
    },
  };
}
