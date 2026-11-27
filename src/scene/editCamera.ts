// 編集モードの視点（TMS 39）：部屋を斜め上から見下ろす。
// ドラッグで回り込み、ホイールで寄る・離れる、WASD・矢印で見る場所をずらす、Q / E で回る。
// 「動かさずに押して離した」ときはクリック（onTap）として道具に渡す（床・壁を置く、選ぶ。TMS 40〜42）。
import type * as THREE from 'three';

const DRAG_SPEED = 0.006;
/** これより動いたらドラッグ（回転）、動かなければクリック（px） */
const TAP_SLOP = 5;
/** 見下ろす角度の範囲（ラジアン。0.45 ≒ 26°、1.45 ≒ 83°） */
const PITCH_MIN = 0.45;
const PITCH_MAX = 1.45;
const DIST_MIN = 6;
const DIST_MAX = 26;
const PAN_SPEED = 6; // m/秒
const KEY_TURN_SPEED = 1.6; // ラジアン/秒
const SMOOTHING = 14;

export interface EditCameraState {
  target: [number, number];
  yaw: number;
  pitch: number;
  distance: number;
}

export interface EditCamera {
  update(dt: number): void;
  setEnabled(enabled: boolean): void;
  /** 部屋の中心を見下ろす初期の視点に戻す */
  reset(center: [number, number], size: number): void;
  readonly state: Readonly<EditCameraState>;
}

export interface EditCameraOptions {
  /** クリック（ドラッグしなかった押下）。座標は canvas 内の CSS px */
  onTap?(x: number, y: number, e: PointerEvent): void;
  /** ポインターが動いた（配置プレビュー用）。ドラッグ中は呼ばない */
  onHover?(x: number, y: number): void;
  /** ポインターが canvas から出た */
  onLeave?(): void;
  /** 見る場所をずらせる範囲（XZ の半径） */
  panLimit?: number;
  reducedMotion?: () => boolean;
}

export function attachEditCamera(
  canvas: HTMLCanvasElement,
  getCamera: () => THREE.PerspectiveCamera,
  options: EditCameraOptions = {},
): EditCamera {
  const goal: EditCameraState = { target: [0, 0], yaw: 0, pitch: 0.95, distance: 14 };
  const cur: EditCameraState = { ...goal, target: [...goal.target] };
  const press = { id: -1, x: 0, y: 0, startX: 0, startY: 0, dragging: false };
  const keys = new Set<string>();
  let enabled = false;
  const limit = options.panLimit ?? 6;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const setCursor = () => (canvas.style.cursor = !enabled ? '' : press.dragging ? 'grabbing' : 'crosshair');

  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled || press.id >= 0) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    Object.assign(press, { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragging: false });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!enabled) return;
    if (e.pointerId !== press.id) {
      if (press.id < 0) options.onHover?.(...local(e));
      return;
    }
    if (!press.dragging && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > TAP_SLOP) {
      press.dragging = true;
      setCursor();
    }
    if (press.dragging) {
      goal.yaw -= (e.clientX - press.x) * DRAG_SPEED;
      goal.pitch = clamp(goal.pitch + (e.clientY - press.y) * DRAG_SPEED * 0.7, PITCH_MIN, PITCH_MAX);
    }
    press.x = e.clientX;
    press.y = e.clientY;
  });
  const endPress = (e: PointerEvent, tap: boolean) => {
    if (e.pointerId !== press.id) return;
    const wasDrag = press.dragging;
    press.id = -1;
    press.dragging = false;
    setCursor();
    if (tap && !wasDrag && enabled && e.button === 0) options.onTap?.(...local(e), e);
  };
  canvas.addEventListener('pointerup', (e) => endPress(e, true));
  canvas.addEventListener('pointercancel', (e) => endPress(e, false));
  canvas.addEventListener('pointerleave', () => enabled && press.id < 0 && options.onLeave?.());
  canvas.addEventListener('contextmenu', (e) => enabled && e.preventDefault()); // 右ドラッグでも回せるように
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      goal.distance = clamp(goal.distance * Math.exp(e.deltaY * 0.0012), DIST_MIN, DIST_MAX);
    },
    { passive: false },
  );

  const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE']);
  window.addEventListener('keydown', (e) => {
    if (!enabled || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || !KEYS.has(e.code)) return;
    keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  return {
    state: cur,
    update(dt) {
      if (!enabled) return;
      const has = (...codes: string[]) => codes.some((c) => keys.has(c));
      goal.yaw += ((has('KeyQ') ? 1 : 0) - (has('KeyE') ? 1 : 0)) * KEY_TURN_SPEED * dt;
      const fwd = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
      const side = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
      if (fwd || side) {
        // 画面の上方向（カメラの向きを床に落とした方向）を前にする
        const s = Math.sin(goal.yaw);
        const c = Math.cos(goal.yaw);
        const step = (PAN_SPEED * dt * goal.distance) / 14;
        goal.target[0] = clamp(goal.target[0] + (-s * fwd + c * side) * step, -limit, limit);
        goal.target[1] = clamp(goal.target[1] + (-c * fwd - s * side) * step, -limit, limit);
      }

      const k = options.reducedMotion?.() ? 1 : 1 - Math.exp(-SMOOTHING * dt);
      cur.yaw += (goal.yaw - cur.yaw) * k;
      cur.pitch += (goal.pitch - cur.pitch) * k;
      cur.distance += (goal.distance - cur.distance) * k;
      cur.target[0] += (goal.target[0] - cur.target[0]) * k;
      cur.target[1] += (goal.target[1] - cur.target[1]) * k;

      const camera = getCamera();
      const h = Math.cos(cur.pitch) * cur.distance;
      camera.position.set(
        cur.target[0] + Math.sin(cur.yaw) * h,
        Math.sin(cur.pitch) * cur.distance,
        cur.target[1] + Math.cos(cur.yaw) * h,
      );
      camera.lookAt(cur.target[0], 0, cur.target[1]);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        press.id = -1;
        press.dragging = false;
        keys.clear();
        options.onLeave?.();
      }
      setCursor();
    },
    reset(center, size) {
      goal.target = [...center];
      goal.yaw = 0;
      goal.pitch = 0.95;
      goal.distance = clamp(size * 1.25, DIST_MIN, DIST_MAX);
      Object.assign(cur, { ...goal, target: [...goal.target] });
    },
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
