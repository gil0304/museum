# MUSEUM — 自分の世界を、美術館にする。

グリッドで3D展示室を建てて、画像・文章・動画・音楽・3Dモデル・**操作できるHTML作品**を飾り、その中を歩いて鑑賞できるWebアプリ。
展示されたHTML作品のボタンやスライダーを3D空間の中で直接操作できること（HTML in Canvas）が核。

「デプロイナウコンテスト byGMOペパボ」応募作品（ロリポップ！デプロイナウで静的配信）。

> **現在の状態:** HTML in Canvas の技術検証が完了（TMS 22〜29）。タイトル画面からサンプル美術館・空の部屋に入れる（TMS 33）。展示室は床・壁（高さ3m）・天井と、固定の照明・影を持つ（TMS 34〜35）。鑑賞は一人称で、ドラッグ・Q/E で見回し、WASD・矢印キー（スマホは移動ボタン）で歩ける。壁・展示台は通り抜けない（TMS 36〜38）。PC では編集モードで床・壁を建て、同梱の作品（画像・文章・動画・音・3D・HTML）を飾れる（TMS 39〜54）。編集はブラウザに自動保存され、JSON で書き出し・読み込みできる（TMS 55〜57）。

## 提出版でできること（予定）
- タイトル画面から1クリックでサンプル美術館に入り、歩いて鑑賞する
- 編集モードで床・壁をグリッドに配置・削除して、1室を建てる
- 6種類の作品を壁・展示台に飾り、位置を変える
- HTML作品（公式テンプレート）を3D空間内で操作する。非対応ブラウザでは通常のDOMパネルで操作
- ブラウザ内への自動保存、JSONの書き出し・読み込み

詳細: [体験の定義](docs/SUBMISSION_EXPERIENCE.md) / [実装範囲と非対象](docs/SUBMISSION_SCOPE.md)

## 動作環境
| 環境 | HTML作品の扱い | 確認状況 |
|---|---|---|
| **PCの Google Chrome 157 以上**（主対象） | 3D空間内で直接操作（HTML in Canvas） | 自動確認済み。人間の実機確認は未実施 |
| Safari / Firefox / Chrome 156 以前 | 3D展示室は表示。HTML作品は平面をクリックして通常の画面で開いて操作 | Chrome で非対応状態を再現して自動確認済み。本物の非対応ブラウザは未確認 |
| Edge / Arc など Chromium 系 | 機能検出で自動判定（どちらかの方式） | 未確認 |
| スマホ | 鑑賞中心 | 未確認 |

## HTML in Canvas：検証結果と採用方式
展示したHTML作品を、画像として貼るのではなく**実際のHTMLのまま3D空間に描き、ボタンやスライダーをそのまま操作できる**ようにするため、Chrome の HTML in Canvas API を使う。詳細な記録・数値・出典は [docs/HTML_IN_CANVAS.md](docs/HTML_IN_CANVAS.md)。

### 利用条件
- Chrome 157（2026-11-03 安定版）から**標準で有効**。フラグ・オリジントライアルのトークンは不要。
- 書き方は `<canvas content="drawable">` と、描く子要素の `drawable` 属性。試験期間の `layoutsubtree`・`texElementImage2D` は**動かない**（ネット上の古い記事に注意）。

### 実験と結果（Chrome 157 / macOS、Claude in Chrome による自動確認）
| TMS | 実験 | 結果 |
|---|---|---|
| 22 | API の存在と利用条件 | ✅ 必要な API がそろっている。旧方式は例外になる |
| 23 | 2D canvas に実HTMLを描く | ✅ 日本語を含むパネルを描画。ピクセルで判定 |
| 24 | 描いたボタンのクリック・キーボード | ✅ 本物のクリック・Tab/Enter が届く。ホバー・フォーカス枠も描かれる |
| 25 | スライダーのドラッグ・クリック・矢印キー | ✅ 値どおりに再描画（ピクセルで判定） |
| 26 | Three.js の斜めの3D平面に貼って操作 | ✅ 表示・クリック・ドラッグが通る。スライダーで展示室の照明を操作 |
| 27 | カメラを動かしながら操作 | ✅ 移動中903フレームすべてでクリック判定が追従。視点操作とパネル操作が競合しない。裏面では判定を外す |
| 28 | 非対応時の代替表示 | ✅ 平面クリックで同じHTML作品を通常の画面のダイアログで開いて操作。結果は3Dにも反映 |

### 採用方式
1. **描画**: Three.js の canvas に `content="drawable"` を付け、HTML作品をその子要素にする。`paint` イベントで `gl.texElementSubImage2D` を呼び、作品の見た目をテクスチャへ直接転送する（作品が変化したときだけ。毎フレームではない）。
2. **入力**: 毎フレーム「平面の位置・向き × カメラ × 投影」から行列を作り `canvas.updateElementGeometry()` に渡す。これでブラウザが3D平面上のクリック位置を作品内の要素に対応させるので、作品側は**普通のHTML/JSのまま**動く。
3. **入力の振り分け**: canvas の背景から始まったドラッグだけを視点操作にし、作品内の要素から始まった操作はカメラに渡さない。作品にフォーカスがあるときは移動キーを無視する。
4. **非対応時**: `detectHtmlInCanvasMode()`（`src/exhibits/htmlInCanvasSupport.ts`）で判定し、3D内には案内の絵を貼って、クリックで同じ作品を通常の画面のダイアログで開く。

### 制約（作品・実装のルール）
- **座標系が2つある**: 描画（要素画像のサイズ）は canvas の実ピクセル（CSS px × devicePixelRatio）、クリック判定の行列は canvas の **CSS px**。取り違えると2倍ずれる。
- Three.js は API を知らないので、テクスチャは事前に確保し、GL を直接触った後は `renderer.resetState()` する。
- プライバシー保護のため、**別オリジンの画像・iframe、日本語入力（IME）の変換候補、動画のコントロールは描かれない**。HTML作品テンプレートは同一オリジンの素材だけで作り、ボタン・スライダー中心にする（文字入力を前提にしない）。
- CSS アニメーション・内部スクロールは描画が追従しない場合がある。作品テンプレートでは使わない。
- 公式テンプレート以外の HTML/JS は実行しない（任意コードの安全性のため）。

### 検証ページ
`npm run dev` の後、Chrome で開く。画面下に自動判定の結果が出る。

| ページ | 内容 |
|---|---|
| `/spikes/hic-basic.html` | 2D canvas への最小表示（TMS 23） |
| `/spikes/hic-input.html` | ボタン・スライダー（TMS 24・25） |
| `/spikes/hic-three.html` | Three.js の3D平面・カメラ移動（TMS 26・27）。`?orbit=1` でカメラ自動移動、`?fallback=1` で非対応時の代替表示（TMS 28）、`?geom=grid` で座標系を取り違えた状態を再現 |
| `/spikes/style-guide.html` | 色・文字・部品・画面レイアウト4種の見本（TMS 32、[docs/DESIGN.md](docs/DESIGN.md)） |

### まだ確認していないこと
- 人間による実機での確認（全項目）。特に「キーを押し続けて歩きながら操作する」「動いている最中のボタンを押す」。
- 本物の Safari / Firefox での代替表示、Chromium 系の他ブラウザ、スマホ。

## 開発

Node.js 20.19 以上（Vite 7 の要件）。

```bash
npm install
npm run dev          # 開発サーバー（http://localhost:5173、同じLANのスマホからも開ける）
npm run typecheck    # 型チェックだけ
npm run build        # 型チェック + 本番ビルド（dist/）
npm run preview      # dist/ をローカルで配信して確認（http://localhost:4173）
npm run verify:dist  # dist/ を公開前に点検（tools/check-dist.mjs）
npm run check:layers # フォルダ間の依存ルールを点検（tools/check-layers.mjs）
npm test             # 計算部分の自動テスト（当たり判定など。tests/）
npm run release      # check:layers + test + build + verify:dist（公開前はこれ）
```

技術: TypeScript / Vite / Three.js。サーバーを持たない**静的サイト**として動く。
「3Dの描画（scene）」「画面（ui）」「作品データ（data）」を分け、`main.ts` でつなぐ。フォルダの責務と依存ルールは [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

### 共有用のデモ URL（TMS 59）
公開先の URL の後ろに `#/view/sample` を付けると、タイトルを飛ばしてサンプル美術館に直接入れる（例 `https://<公開先>/#/view/sample`）。空の部屋は `#/view/empty`。アプリ内では「メニュー → 共有用の URL をコピー」。編集した美術館はその端末のブラウザにだけ保存されるので、人に渡すときは JSON で書き出す。

### 静的配信の構成
- 公開するのは **`dist/` だけ**（ビルド結果。HTML・JS・CSS・素材がすべて入り、`dist/` 単体で動く）。リポジトリ直下には `src/`・`docs/`・`tools/` があるので、**直下をそのまま公開しない**。
- `vite.config.ts` の `base: './'` で、HTML から JS・CSS・素材への参照はすべて**相対パス**。ルート以外の場所（例: `/museum/`）に置いても動く（TMS 30 で、Vite を使わない静的サーバーで確認済み）。
- 素材（画像・音声・動画・GLB・サンプルJSON）は **`public/`** に置く。ビルドで `dist/` 直下にそのままコピーされる。HTML からは `/favicon.svg` のように書けば、ビルド時に相対パスへ書き換わる。
- ページは `index.html`（アプリ本体）と `spikes/*.html`（技術検証）の複数ページ構成。入口を増やすときは `vite.config.ts` の `build.rollupOptions.input` に追加する。
- 公開先の書き換え（rewrite）機能を前提にしない。画面やサンプルの切り替えは URL の**クエリ**（例: `?fallback=1`）か**ハッシュ**で行う。
- `npm run verify:dist` が見ること: `index.html` があるか／ビルドされていない `/src/` を参照していないか／ルート基準の絶対パスがないか／合計 100MB 未満（30MB 超で警告）か／秘密情報らしき文字列がないか／「.」で始まる（公開されない）ファイルがないか。

```
src/
  scene/     Three.jsのシーン・カメラ・ライト
  editor/    建築・展示エディタ
  exhibits/  画像/文章/動画/音楽/GLB/HTML作品
  ui/        操作UI・パネル
  types/     データスキーマ
  data/      サンプル美術館（純粋なデータ）
  spikes/    技術検証ページのコード
public/      素材（ビルドで dist/ 直下にコピー）
spikes/      技術検証ページ（HTML in Canvas）
docs/        仕様・設計・応募要件（正本）
tools/       TMS（Google Sheets）連携CLI
```

## デプロイ（ロリポップ！デプロイナウ）
`npm run release` で作った `dist/` を、フレームワーク「静的サイト（static）」として公開する。Freeプランのデプロイ上限は100MB。

公式ドキュメントで確認した注意点（2026-11-20、TMS 30）:
- 静的サイトは「アップロードしたフォルダのファイル構成が、そのまま公開」される。ビルドは自分で行い、`dist/` の中身を公開する。
- フォルダ直下の `index.html` がルートURLになる。直下にHTMLが1つもないとデプロイは失敗する。
- 「.」で始まるファイルは公開されない。
- **CLI を git 管理下のフォルダで実行すると、`.gitignore` で無視されたファイルは除外される。** `dist/` は `.gitignore` 対象なので、リポジトリの中から `dist/` をそのまま CLI でデプロイすると中身が入らない可能性がある。ブラウザへの `dist/` フォルダのドラッグ&ドロップ、または git 管理外にコピーしてから CLI、のどちらかで行う。

具体的な公開手順は初回公開時（TMS 61行）に実際に確かめてここへ記載する。

## ドキュメント
| ファイル | 内容 |
|---|---|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | 企画・仕様（正本） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術設計・フォルダと依存ルール |
| [docs/DESIGN.md](docs/DESIGN.md) | 画面レイアウト・色・文字・部品 |
| [docs/SUBMISSION_EXPERIENCE.md](docs/SUBMISSION_EXPERIENCE.md) | 提出版の体験フロー |
| [docs/SUBMISSION_SCOPE.md](docs/SUBMISSION_SCOPE.md) | 提出版の実装範囲と非対象 |
| [docs/CONTEST_REQUIREMENTS.md](docs/CONTEST_REQUIREMENTS.md) | コンテスト応募要件 |
| [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) | 提出チェックリスト |
| [docs/TMS_INTEGRATION.md](docs/TMS_INTEGRATION.md) | タスク管理シートとの連携 |
| [CLAUDE.md](CLAUDE.md) | Claude Code向けの開発ルール |

## タスク管理（TMS / Google Sheets）
進捗の正本はGoogle Sheetsの「オリジナル」タブ。`tools/tms.py` で読み書きする（更新するのはG列・J列だけ）。

### 初回設定
1. Google Cloud Consoleで **Google Sheets API** を有効化
2. OAuth同意画面を作成（テストモードなら自分のアカウントをテストユーザーに登録）
3. OAuthクライアントを **デスクトップアプリ** として作成し、JSONを `.secrets/credentials.json` に置く
4. Python 3.10以上で:

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/tms.py auth      # ブラウザで認可 → .secrets/token.json
.venv/bin/python tools/tms.py doctor
```

依存は `.venv` にだけ入るので、**`.venv/bin/python` で実行する**（またはvenvを有効化してから `python`）。

### 使い方
```bash
.venv/bin/python tools/tms.py pull              # シートを取得
.venv/bin/python tools/tms.py next --limit 10   # 次のタスク
.venv/bin/python tools/tms.py start <ROW>       # G列を作業中に
.venv/bin/python tools/tms.py done <ROW>        # G列を戻し、J列に完了週を記入
.venv/bin/python tools/tms.py status
```

- 書き込み前にD列のタスク本文を照合し、ズレていれば停止する。
- F列（自動算出）とC:E・H:I（計画）は書き換えない。
- `done` は受入条件を満たし、検証できたときだけ使う。

## 秘密情報
`.secrets/`（OAuthクライアント・token）、`.env`、`.tms-cache/` は `.gitignore` で除外している。APIキーやトークンをコミットしない・フロントエンドに埋め込まない。

## 素材・ライセンス
サンプル展示の素材は自作か利用許諾が明確なものだけを使い、出典はここに記載する（TMS 68行）。
