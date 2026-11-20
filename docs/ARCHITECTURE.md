# 技術設計

- Frontend: Vite + TypeScript + Three.js（ビルド済み静的ファイルを配信）
- 3D: シーン・カメラ・メッシュ・ライトを責務分離。建築はJSONでグリッド座標と各種パーツを管理。
- HTML in Canvas: 別スパイクとしてDOM・描画・入力が成立するか実機確認する。API非対応/制限時は通常DOMオーバーレイ/別鑑賞パネル。
- 保存(提出版): localStorage/IndexedDB + JSONインポート/エクスポート。複雑な動画バイナリをJSONに直埋めしない。
- 保存(正式版): Supabase Auth / Postgres / Storageを候補にする。RLS・認可・ファイル検証を設計。
- 配信: Deploy Now（静的）。本番では秘匿トークンをフロントへ注入しない。

## 作業用フォルダ
- `src/scene/`: Three.jsシーン管理
- `src/editor/`: 建築・展示エディタ
- `src/exhibits/`: 画像/文章/動画/音楽/GLB/公式HTML作品
- `src/ui/`: 操作UI/パネル
- `src/types/`: データスキーマ
- `src/data/`: サンプル美術館
- `tools/tms.py`: Google Sheets読み書きCLI

## リスク
HTML in Canvasのブラウザ対応、3D物体上の入力フォーカス/操作競合、メディア容量・モバイル性能、任意HTMLの安全性。
