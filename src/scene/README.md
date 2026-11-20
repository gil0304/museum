Three.js の描画。DOM は受け取った要素に canvas を入れる以外触らない（types と three だけ import 可）。
- room.ts: MuseumDocument からシーンを組み立てる
- viewer.ts: レンダラー・サイズ追従・描画ループ
- previewControls.ts: プレビュー用の視点操作（TMS 36〜38 で一人称に置き換え）
