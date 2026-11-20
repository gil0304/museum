// タイトル画面の背景：展示室の中をゆっくり見回すカメラ。
// 文字は画面の左に置くので、展示物が右寄りに見えるよう注視点を少し左に置く。
import type * as THREE from 'three';

export function updateTitleCamera(camera: THREE.PerspectiveCamera, t: number, still: boolean) {
  const s = still ? 0 : t; // 動きを減らす設定のときは止める
  camera.position.set(-1.2 + Math.sin(s * 0.11) * 0.9, 1.75 + Math.sin(s * 0.07) * 0.1, 5.6 + Math.cos(s * 0.09) * 0.4);
  camera.lookAt(-0.6 + Math.sin(s * 0.13) * 0.5, 1.6, -1.5);
}
