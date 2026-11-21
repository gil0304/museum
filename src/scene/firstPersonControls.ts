// 一人称の視点操作（TMS 36）：3D ビューをドラッグして見回す。指でのドラッグも同じ（スマホの鑑賞）。
// キーボードでは Q / E で左右に向きを変える（すべての操作をキーボードでも：docs/DESIGN.md）。
// 移動（WASD・矢印キー）は TMS 37、壁の通り抜け防止は TMS 38 でここに足す。
import type * as THREE from 'three';
import type { ViewPose } from './room';

/** ドラッグ 1px あたりの回転（ラジアン）。検証ページ（TMS 27）と同じ向き：右へドラッグで右を向く */
const DRAG_SPEED = 0.0042;
/** Q / E を押し続けたときの回転速度（ラジアン/秒） */
const KEY_TURN_SPEED = 1.6;
/** 上下を見る範囲（約 ±63°）。真上・真下まで回すと左右の向きが分からなくなるため */
const PITCH_LIMIT = 1.1;
/** 向きの追従の速さ。大きいほど指・マウスにぴったり付く（動きを減らす設定のときは即座に合わせる） */
const SMOOTHING = 18;

export interface FirstPersonControls {
  /** 毎フレーム呼ぶ（有効なときだけカメラを動かす） */
  update(dt: number): void;
  setEnabled(enabled: boolean): void;
  /** 視点を置き直す（美術館に入ったとき） */
  reset(pose: ViewPose): void;
  /** 現在の視点（検証・保存用の読み取り） */
  readonly pose: Readonly<ViewPose>;
}

export function attachFirstPersonControls(
  canvas: HTMLCanvasElement,
  getCamera: () => THREE.PerspectiveCamera,
  options: { reducedMotion?: () => boolean } = {},
): FirstPersonControls {
  const current: ViewPose = { position: [0, 1.6, 0], yaw: 0, pitch: 0 };
  const target = { yaw: 0, pitch: 0 };
  const drag = { id: -1, x: 0, y: 0 };
  const turnKeys = new Set<string>();
  let enabled = false;

  const clampPitch = (p: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
  const setCursor = () => (canvas.style.cursor = !enabled ? '' : drag.id >= 0 ? 'grabbing' : 'grab');

  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled || drag.id >= 0) return; // 2 本目の指は無視する
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    setCursor();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!enabled || e.pointerId !== drag.id) return;
    target.yaw -= (e.clientX - drag.x) * DRAG_SPEED;
    target.pitch = clampPitch(target.pitch - (e.clientY - drag.y) * DRAG_SPEED);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e: PointerEvent) => {
    if (e.pointerId !== drag.id) return;
    drag.id = -1;
    setCursor();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  // 文字入力中（作品情報の編集など）はキーを横取りしない
  const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  window.addEventListener('keydown', (e) => {
    if (!enabled || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.code === 'KeyQ' || e.code === 'KeyE') turnKeys.add(e.code);
  });
  window.addEventListener('keyup', (e) => turnKeys.delete(e.code));
  window.addEventListener('blur', () => turnKeys.clear()); // 押したまま別のウィンドウへ移ったとき

  return {
    pose: current,
    update(dt) {
      if (!enabled) return;
      const turn = (turnKeys.has('KeyQ') ? 1 : 0) - (turnKeys.has('KeyE') ? 1 : 0);
      target.yaw += turn * KEY_TURN_SPEED * dt;

      const k = options.reducedMotion?.() ? 1 : 1 - Math.exp(-SMOOTHING * dt);
      current.yaw += (target.yaw - current.yaw) * k;
      current.pitch += (target.pitch - current.pitch) * k;

      const camera = getCamera();
      camera.rotation.order = 'YXZ'; // 左右（Y）→ 上下（X）の順に回す。傾き（Z）は使わない
      camera.position.set(...current.position);
      camera.rotation.set(current.pitch, current.yaw, 0);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        drag.id = -1;
        turnKeys.clear();
      }
      setCursor();
    },
    reset(pose) {
      current.position = [...pose.position];
      current.yaw = target.yaw = pose.yaw;
      current.pitch = target.pitch = clampPitch(pose.pitch);
    },
  };
}
