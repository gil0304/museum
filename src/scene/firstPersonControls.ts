// 一人称の視点操作：3D ビューをドラッグして見回し（TMS 36）、WASD・矢印キーで歩く（TMS 37）。
// 指でのドラッグも同じ。スマホでは画面の移動ボタン（ui/shell）から setMoveInput() で歩く。
// キーボードだけでも操作できる：Q / E で左右に向きを変える（docs/DESIGN.md）。
// 壁の通り抜け防止は TMS 38 で options.constrain に入れる。
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
/** 歩く速さ（m/秒）。Shift を押している間は速歩き */
const WALK_SPEED = 1.8;
const RUN_SPEED = 3.4;
/** 歩き出し・止まるときの滑らかさ（大きいほどすぐ止まる。動きを減らす設定のときは即座） */
const MOVE_SMOOTHING = 10;

/** 前後・左右の入力（-1〜1）。forward は前が正、strafe は右が正 */
export interface MoveInput {
  forward: number;
  strafe: number;
}

/** 移動先を補正する（TMS 38 の通り抜け防止）。from から to へ動こうとしたときの、実際の到達点を返す */
export type MoveConstraint = (from: THREE.Vector3Tuple, to: THREE.Vector3Tuple) => THREE.Vector3Tuple;

export interface FirstPersonControls {
  /** 毎フレーム呼ぶ（有効なときだけカメラを動かす） */
  update(dt: number): void;
  setEnabled(enabled: boolean): void;
  /** 視点を置き直す（美術館に入ったとき） */
  reset(pose: ViewPose): void;
  /** 画面の移動ボタンなど、キーボード以外からの移動入力。離したら {0, 0} を渡す */
  setMoveInput(input: MoveInput): void;
  /** 現在の視点（検証・保存用の読み取り） */
  readonly pose: Readonly<ViewPose>;
}

// キー → [前後, 左右]。矢印キーは WASD と同じ（左右は横歩き。向きを変えるのは Q / E とドラッグ）
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};
const TURN_KEYS = new Set(['KeyQ', 'KeyE']);
const RUN_KEYS = new Set(['ShiftLeft', 'ShiftRight']);

export function attachFirstPersonControls(
  canvas: HTMLCanvasElement,
  getCamera: () => THREE.PerspectiveCamera,
  options: { reducedMotion?: () => boolean; constrain?: MoveConstraint } = {},
): FirstPersonControls {
  const current: ViewPose = { position: [0, 1.6, 0], yaw: 0, pitch: 0 };
  const target = { yaw: 0, pitch: 0 };
  const velocity = { x: 0, z: 0 };
  const drag = { id: -1, x: 0, y: 0 };
  const keys = new Set<string>();
  let external: MoveInput = { forward: 0, strafe: 0 };
  let enabled = false;

  const clampPitch = (p: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
  const setCursor = () => (canvas.style.cursor = !enabled ? '' : drag.id >= 0 ? 'grabbing' : 'grab');

  // ---- ドラッグで見回す（TMS 36）----
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

  // ---- キーボード（Q / E：向き、WASD・矢印：歩く、Shift：速歩き）----
  // 文字入力中（作品情報の編集など）はキーを横取りしない
  const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  window.addEventListener('keydown', (e) => {
    if (!enabled || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.code in MOVE_KEYS || TURN_KEYS.has(e.code) || RUN_KEYS.has(e.code)) {
      keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault(); // 矢印キーでページやボタン群がスクロールしないように
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  // 押したまま別のウィンドウ・タブへ移ると keyup が届かず歩き続けるため、すべて離したことにする
  const releaseAll = () => {
    keys.clear();
    external = { forward: 0, strafe: 0 };
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());

  function moveInput(): MoveInput {
    let forward = external.forward;
    let strafe = external.strafe;
    for (const code of keys) {
      const m = MOVE_KEYS[code];
      if (m) {
        forward += m[0];
        strafe += m[1];
      }
    }
    // 斜め（W + D など）でも速くならないよう長さを 1 までに抑える
    const len = Math.hypot(forward, strafe);
    return len > 1 ? { forward: forward / len, strafe: strafe / len } : { forward, strafe };
  }

  return {
    pose: current,
    update(dt) {
      if (!enabled) return;
      const snap = options.reducedMotion?.() ?? false;

      // 向き
      const turn = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
      target.yaw += turn * KEY_TURN_SPEED * dt;
      const k = snap ? 1 : 1 - Math.exp(-SMOOTHING * dt);
      current.yaw += (target.yaw - current.yaw) * k;
      current.pitch += (target.pitch - current.pitch) * k;

      // 移動：向いている方向（上下の傾きは無視して床と平行）に歩く。yaw 0 で -Z が前
      const { forward, strafe } = moveInput();
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(current.yaw);
      const cos = Math.cos(current.yaw);
      const wantX = (-sin * forward + cos * strafe) * speed;
      const wantZ = (-cos * forward - sin * strafe) * speed;
      const km = snap ? 1 : 1 - Math.exp(-MOVE_SMOOTHING * dt);
      velocity.x += (wantX - velocity.x) * km;
      velocity.z += (wantZ - velocity.z) * km;
      if (Math.abs(velocity.x) < 1e-4 && Math.abs(velocity.z) < 1e-4) velocity.x = velocity.z = 0;
      if (velocity.x || velocity.z) {
        const [x, y, z] = current.position;
        const to: THREE.Vector3Tuple = [x + velocity.x * dt, y, z + velocity.z * dt];
        current.position = options.constrain ? options.constrain(current.position, to) : to;
      }

      const camera = getCamera();
      camera.rotation.order = 'YXZ'; // 左右（Y）→ 上下（X）の順に回す。傾き（Z）は使わない
      camera.position.set(...current.position);
      camera.rotation.set(current.pitch, current.yaw, 0);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        drag.id = -1;
        releaseAll();
        velocity.x = velocity.z = 0;
      }
      setCursor();
    },
    reset(pose) {
      current.position = [...pose.position];
      current.yaw = target.yaw = pose.yaw;
      current.pitch = target.pitch = clampPitch(pose.pitch);
      velocity.x = velocity.z = 0;
    },
    setMoveInput(input) {
      external = { forward: input.forward, strafe: input.strafe };
    },
  };
}
