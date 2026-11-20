# 技術設計

- Frontend: Vite + TypeScript + Three.js（ビルド済み静的ファイルを配信）
- 3D: シーン・カメラ・メッシュ・ライトを責務分離。建築はJSONでグリッド座標と各種パーツを管理。
- HTML in Canvas: 別スパイクとしてDOM・描画・入力が成立するか実機確認する。API非対応/制限時は通常DOMオーバーレイ/別鑑賞パネル。対象ブラウザ・API・制約は [HTML_IN_CANVAS.md](HTML_IN_CANVAS.md)。
- 保存(提出版): localStorage/IndexedDB + JSONインポート/エクスポート。複雑な動画バイナリをJSONに直埋めしない。
- 保存(正式版): Supabase Auth / Postgres / Storageを候補にする。RLS・認可・ファイル検証を設計。
- 配信: Deploy Now（静的）。本番では秘匿トークンをフロントへ注入しない。

## フォルダと依存ルール（TMS 31）
「3Dの描画」「画面（DOM）」「作品データ」を分け、データは描画にも画面にも依存しない純粋なものにする。保存（JSON入出力）・建築エディタ・HTML in Canvas の代替表示を、互いに壊さずに足していくため。

| フォルダ | 責務 | import してよい相手 |
|---|---|---|
| `src/types/` | データの形（`MuseumDocument`・`RoomPart`・`ExhibitPlacement`） | なし |
| `src/data/` | サンプル美術館などのデータ（JSONにそのまま書き出せる形） | types |
| `src/scene/` | Three.js：データからシーンを組み立てる（`room.ts`）、レンダラーと描画ループ（`viewer.ts`）、視点操作（`previewControls.ts`）。DOM は受け取った要素に canvas を入れる以外触らない | types、three |
| `src/ui/` | 画面の DOM（外枠・案内・作品情報パネル・今後のツールバーやヘルプ）。three.js は使わず、3D への反映はコールバックで受け取る | types |
| `src/exhibits/` | 作品の種類ごとの表示、HTML in Canvas の判定と代替表示 | types、scene、three |
| `src/editor/` | 建築・展示エディタ | types、scene、exhibits、data、three |
| `src/main.ts` | 上の層をつなぐだけ（データを選び、scene を作り、ui を表示し、コールバックで結ぶ） | すべて |
| `src/spikes/`・`spikes/` | 技術検証ページ（制限なし。製品コードからは import しない） | すべて |
| `public/` | 素材（ビルドで `dist/` 直下にコピー） | — |
| `tools/` | TMS 連携・公開前点検・依存ルール点検 | — |

- 依存ルールは `npm run check:layers`（`tools/check-layers.mjs`）で自動点検し、`npm run release` に含める。表を変えるときはスクリプトの `ALLOW` も同時に変える。
- 座標はメートル、Y軸が上、原点は部屋の床の中心（正式な定義は TMS 44）。

## リスク
HTML in Canvasのブラウザ対応、3D物体上の入力フォーカス/操作競合、メディア容量・モバイル性能、任意HTMLの安全性。
