# MUSEUM — 自分の世界を、美術館にする。

グリッドで3D展示室を建てて、画像・文章・動画・音楽・3Dモデル・**操作できるHTML作品**を飾り、その中を歩いて鑑賞できるWebアプリ。
展示されたHTML作品のボタンやスライダーを3D空間の中で直接操作できること（HTML in Canvas）が核。

「デプロイナウコンテスト byGMOペパボ」応募作品（ロリポップ！デプロイナウで静的配信）。

> **現在の状態:** 初期プロトタイプ（Three.jsの展示室プレビュー）。HTML in Canvasの技術検証から実装を進めている。

## 提出版でできること（予定）
- タイトル画面から1クリックでサンプル美術館に入り、歩いて鑑賞する
- 編集モードで床・壁をグリッドに配置・削除して、1室を建てる
- 6種類の作品を壁・展示台に飾り、位置を変える
- HTML作品（公式テンプレート）を3D空間内で操作する。非対応ブラウザでは通常のDOMパネルで操作
- ブラウザ内への自動保存、JSONの書き出し・読み込み

詳細: [体験の定義](docs/SUBMISSION_EXPERIENCE.md) / [実装範囲と非対象](docs/SUBMISSION_SCOPE.md)

## 動作環境
- 主対象: PCの Google Chrome（HTML in Canvasの対応状況は検証後にここへ記載）
- その他のブラウザ・スマホ: 鑑賞中心（HTML作品は代替表示）

## 開発

Node.js 20以上を想定。

```bash
npm install
npm run dev        # 開発サーバー（http://localhost:5173）
npm run build      # 型チェック + 本番ビルド（dist/）
npm run preview    # ビルド結果をローカルで確認
```

技術: TypeScript / Vite / Three.js。サーバーを持たない静的サイトとして動く。

```
src/
  scene/     Three.jsのシーン・カメラ・ライト
  editor/    建築・展示エディタ
  exhibits/  画像/文章/動画/音楽/GLB/HTML作品
  ui/        操作UI・パネル
  types/     データスキーマ
  data/      サンプル美術館
docs/        仕様・設計・応募要件（正本）
tools/       TMS（Google Sheets）連携CLI
```

## デプロイ（ロリポップ！デプロイナウ）
`npm run build` で生成した `dist/` を静的サイトとして公開する。Freeプランのデプロイ上限は100MB。
具体的な公開手順は初回公開時（TMS 61行）に確認してここへ記載する。

## ドキュメント
| ファイル | 内容 |
|---|---|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | 企画・仕様（正本） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術設計 |
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
