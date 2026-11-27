// 3D 作品を近くで回して見る視点（TMS 52）。作品の中心のまわりを回り、ホイール（またはボタン）で寄る・離れる。
// 一人称の視点とは別に動き、終わると一人称の視点（立っていた場所）に戻る。
import type * as THREE from 'three';

const DRAG_SPEED = 0.008;
const PITCH_MIN = -0.15; // 少し下からも見られる
const PITCH_MAX = 1.25;
const SMOOTHING = 12;

export interface InspectCamera {
  update(dt: number): void;
  /** 作品の中心と大きさ（半径）を渡して始める。yaw は今の向き（作品の正面から見始める） */
  start(center: THREE.Vector3Tuple, radius: number, yaw: number): void;
  stop(): void;
  /** 寄る（負）・離れる（正）。ボタン操作用 */
  zoom(delta: number): void;
  readonly active: boolean;
}

export function attachInspectCamera(
  canvas: HTMLCanvasElement,
  getCamera: () => THREE.PerspectiveCamera,
  options: { reducedMotion?: () => boolean } = {},
): InspectCamera {
  const goal = { yaw: 0, pitch: 0.25, distance: 2 };
  const cur = { ...goal };
  let center: THREE.Vector3Tuple = [0, 0, 0];
  let minDist = 0.8;
  let maxDist = 3;
  let active = false;
  const drag = { id: -1, x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    if (!active || drag.id >= 0) return;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== drag.id) return;
    goal.yaw -= (e.clientX - drag.x) * DRAG_SPEED;
    goal.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, goal.pitch + (e.clientY - drag.y) * DRAG_SPEED * 0.7));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== drag.id) return;
    drag.id = -1;
    if (active) canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!active) return;
      e.preventDefault();
      api.zoom(e.deltaY * 0.0015);
    },
    { passive: false },
  );

  const api: InspectCamera = {
    get active() {
      return active;
    },
    update(dt) {
      if (!active) return;
      const k = options.reducedMotion?.() ? 1 : 1 - Math.exp(-SMOOTHING * dt);
      cur.yaw += (goal.yaw - cur.yaw) * k;
      cur.pitch += (goal.pitch - cur.pitch) * k;
      cur.distance += (goal.distance - cur.distance) * k;
      const h = Math.cos(cur.pitch) * cur.distance;
      const camera = getCamera();
      camera.position.set(center[0] + Math.sin(cur.yaw) * h, center[1] + Math.sin(cur.pitch) * cur.distance, center[2] + Math.cos(cur.yaw) * h);
      camera.lookAt(...center);
    },
    start(c, radius, yaw) {
      center = [...c];
      minDist = Math.max(0.5, radius * 1.4);
      maxDist = Math.max(minDist + 0.3, Math.min(radius * 4, 2)); // 離れすぎて壁の外に出ないよう 2m まで
      goal.yaw = yaw;
      goal.pitch = 0.25;
      goal.distance = radius * 2.6;
      // 今の一人称の視点から滑らかに寄っていくよう、始点は少し離れた位置にする
      Object.assign(cur, goal, { distance: goal.distance * 1.6 });
      active = true;
      canvas.style.cursor = 'grab';
    },
    stop() {
      active = false;
      drag.id = -1;
      canvas.style.cursor = '';
    },
    zoom(delta) {
      goal.distance = Math.max(minDist, Math.min(maxDist, goal.distance * Math.exp(delta)));
    },
  };
  return api;
}
