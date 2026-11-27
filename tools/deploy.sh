#!/bin/sh
# デプロイナウ（https://my-museum.lolipop-now.app）へ公開する（TMS 61）。
# 1) npm run release で点検・ビルド  2) dist/ をリポジトリの外の一時フォルダにコピー
#    （Git 管理下で実行すると .gitignore の dist/ が除外されるため）  3) lolipop deploy
# 事前に `npm install -g lolipop` と `lolipop login`（ブラウザで認証）が必要。
set -eu
cd "$(dirname "$0")/.."
PROJECT=01M8E7H5R38M26CEZN7P49RQK8 # my-museum（static、出力先 .）
npm run release
TMP=$(mktemp -d)
cp -R dist/. "$TMP/"
(cd "$TMP" && lolipop deploy --project "$PROJECT")
rm -rf "$TMP"
echo "公開先: https://my-museum.lolipop-now.app/ （反映まで数十秒かかることがある）"
