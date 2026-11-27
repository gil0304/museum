# 展示物：共通データ型と座標系

確定: 2026-11-27（TMS 44）。型の正本は `src/types/museum.ts`、作品ライブラリは `src/data/library.ts`、3D 表示は `src/exhibits/exhibitObjects.ts`。

## 座標系
| 項目 | 決まり |
|---|---|
| 単位・軸 | メートル。Y 軸が上。原点は床の中心、床の上面が y = 0 |
| グリッド | 1マス 1m、マスの境目は整数座標、最大 12×12マス（x・z とも -6〜6） |
| 壁 | マスの境目の上に立つ。厚さ 0.2m、高さ 3m。サンプルの部屋（10×8m）の壁の内面は 奥 z = -3.9、手前 z = 3.9、左 x = -4.9、右 x = 4.9 |
| 回転 `rotationY` | Y 軸まわりのラジアン。**0 のとき作品の正面は +Z を向く**。左の壁（正面が +X）は π/2、右の壁（正面が -X）は -π/2、手前の壁（正面が -Z）は π |
| 目の高さ | 1.6m（一人称の視点。TMS 36） |

## 2 つの型
作品の情報（何を見せるか）と、置き場所（どこに置くか）を分ける。美術館データ（JSON）に保存するのは置き場所だけ。

### 作品ライブラリ `ExhibitAsset`（同梱のサンプル作品）
| 項目 | 内容 |
|---|---|
| `id` | 作品の id（例 `image-first-light`） |
| `type` | `image` / `text` / `video` / `audio` / `glb` / `interactive-html` |
| `mount` | `wall`（壁に掛ける）/ `floor`（床に置く。台座付き） |
| `title` `author` `year` `description` | 作品情報パネル（TMS 46）に出す |
| `src` | 素材のパス（`public/` からの相対。例 `assets/images/first-light.jpg`）。文章・HTML 作品は無し |
| `size` | wall：作品面の幅×高さ。floor：台座の幅（正方形）×台座の上の作品の高さ |
| `frameSize` | 額縁の外寸（壁の作品で額縁があるとき） |
| `body` | 文章作品の本文（TMS 48） |
| `template` | HTML 作品の公式テンプレート名（TMS 53） |
| `placeholderColor` | 素材の読み込み中・失敗時の色 |

### 配置 `ExhibitPlacement`（美術館データに保存）
| 項目 | 内容 |
|---|---|
| `id` | 美術館の中で一意の id |
| `assetId` | 作品ライブラリの id |
| `type` `mount` | ライブラリの写し（JSON を読んだときに分かりやすくするため。描画はライブラリの値を使う） |
| `position` | wall：作品の裏面が触れる**壁の表面上の点**（作品の中心の高さ）。floor：**台座の底の中心**（y = 0） |
| `rotationY` | 作品の正面の向き |
| `title` `description` | ライブラリの値を上書きしたいときだけ |

## 3D での組み立て（`exhibitObjects.ts`）
- **壁の作品**：壁の表面から手前（ローカル +Z）へ、額縁（厚さ 0.06m）→ 作品面（厚さ 0.04m）の順に重ねる。額縁が無ければ作品面だけ。
- **床の作品**：台座（高さ 0.85m、幅 `size[0]`）の上に作品を置く。台座は当たり判定にも入る（回転しても囲める正方形）。
- ライブラリに無い `assetId` の作品は表示しない（壊れた JSON でも止めない）。

## 安全方針
- データからは**同梱の作品を id で参照するだけ**。任意の URL・画像・HTML を読み込まない（CLAUDE.md「公式テンプレート以外の投稿HTML/JSを直接実行しない」）。
- ユーザーのファイルのアップロードは提出版の対象外（[SUBMISSION_EXPERIENCE.md](SUBMISSION_EXPERIENCE.md)）。

## サンプル美術館の並び（`src/data/sampleMuseum.ts`）
入口（手前、z = 2.7 から奥を向いて立つ）から正面に HTML 作品が見え、左回り・右回りに 6 種類を見られる。
| 場所 | 作品 |
|---|---|
| 奥の壁・中央 | HTML 作品「拍手のカウンター」 |
| 奥の壁・左 / 右 | 画像「First Light」/「Tidal Notes」 |
| 左の壁 | 文章「展示室のための覚え書き」、動画「Slow Weather」 |
| 右の壁 | 音「Room Tone」 |
| 床（右奥） | 3D「Knot No.3」（台座付き） |
