// プレビュー用の視点操作（ドラッグで回り込み、ホイールで寄る）。
// 一人称の移動（TMS 36〜38）を実装したら置き換える。
import type * as THREE from 'three';

const TARGET = { x: 0, y: 1.3, z: 0 };

export function attachPreviewControls(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
  const pointer = { active: false, x: 0, y: 0 };
  const angles = { yaw: 0, pitch: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => (pointer.active = false));
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.active) return;
    angles.yaw += (e.clientX - pointer.x) * 0.005;
    angles.pitch = Math.max(-0.45, Math.min(0.45, angles.pitch + (e.clientY - pointer.y) * 0.004));
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.position.z = Math.max(5, Math.min(13, camera.position.z + e.deltaY * 0.008));
    },
    { passive: false },
  );

  /** 毎フレーム呼ぶ */
  return function update() {
    camera.position.x = Math.sin(angles.yaw) * camera.position.z * 0.3;
    camera.position.y = 2.4 + angles.pitch * 3;
    camera.lookAt(TARGET.x, TARGET.y, TARGET.z);
  };
}
