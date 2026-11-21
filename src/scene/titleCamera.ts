// タイトル画面の背景：展示室の中をゆっくり見回すカメラ。
import type * as THREE from 'three';

export function updateTitleCamera(camera: THREE.PerspectiveCamera, t: number, still: boolean) {
  const s = still ? 0 : t; // 動きを減らす設定のときは止める
  // 部屋は四方を壁で閉じたので（TMS 36）、カメラは左手前の角（手前の壁 z = 3.4 より内側）から右奥を見る。
  // 画面左（文字の下）には何も無い左の壁、右に絵と彫刻が来る
  camera.position.set(-3.3 + Math.sin(s * 0.11) * 0.35, 1.65 + Math.sin(s * 0.07) * 0.08, 2.7 + Math.cos(s * 0.09) * 0.2);
  camera.lookAt(Math.sin(s * 0.13) * 0.4, 1.4, -0.9);
}
