// プレビュー用の視点操作（ドラッグで回り込み、ホイールで寄る）。
// 一人称の移動（TMS 36〜38）を実装したら置き換える。
import type * as THREE from 'three';

const TARGET = { x: 0, y: 1.3, z: 0 };
const HOME_Z = 8;

export interface PreviewControls {
  /** 毎フレーム呼ぶ（有効なときだけカメラを動かす） */
  update(): void;
  setEnabled(enabled: boolean): void;
  /** 初期の視点に戻す */
  reset(): void;
}

/** camera は関数で受け取る（美術館を切り替えるとカメラが変わるため） */
export function attachPreviewControls(
  canvas: HTMLCanvasElement,
  getCamera: () => THREE.PerspectiveCamera,
): PreviewControls {
  const pointer = { active: false, x: 0, y: 0 };
  const angles = { yaw: 0, pitch: 0 };
  let distance = HOME_Z;
  let enabled = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => (pointer.active = false));
  canvas.addEventListener('pointercancel', () => (pointer.active = false));
  canvas.addEventListener('pointermove', (e) => {
    if (!enabled || !pointer.active) return;
    angles.yaw += (e.clientX - pointer.x) * 0.005;
    angles.pitch = Math.max(-0.45, Math.min(0.45, angles.pitch + (e.clientY - pointer.y) * 0.004));
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      distance = Math.max(5, Math.min(13, distance + e.deltaY * 0.008));
    },
    { passive: false },
  );

  return {
    update() {
      if (!enabled) return;
      const camera = getCamera();
      camera.position.set(Math.sin(angles.yaw) * distance * 0.3, 2.4 + angles.pitch * 3, distance);
      camera.lookAt(TARGET.x, TARGET.y, TARGET.z);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) pointer.active = false;
    },
    reset() {
      angles.yaw = 0;
      angles.pitch = 0;
      distance = HOME_Z;
    },
  };
}
