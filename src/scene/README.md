Three.js の描画。DOM は受け取った要素に canvas を入れる以外触らない（例外：視点操作は canvas のポインターと window のキー入力を受ける）。types と three だけ import 可。
- room.ts: MuseumDocument からシーンを組み立てる
- viewer.ts: レンダラー・サイズ追従・描画ループ
- firstPersonControls.ts: 一人称の視点操作（ドラッグ・Q/E で見回す TMS 36、WASD・矢印・移動ボタンで歩く TMS 37。通り抜け防止は TMS 38 で constrain に入れる）
- titleCamera.ts: タイトル画面の背景のカメラ
- collision.ts: 床・壁・展示台の当たり判定（TMS 38。three.js 非依存の計算。テストは tests/collision.test.mts）
- editCamera.ts: 編集モードの視点（斜め上から。ドラッグで回る・クリックは道具へ。TMS 39）
- editOverlay.ts: 編集用の表示（グリッド・手前の壁の半透明化・配置プレビュー。TMS 39〜43）
