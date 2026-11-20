# TMS（実シート確認済み）

- Spreadsheet ID: `1UrxUoqnu9fdiELaMk9TC2c1vO0jZoxyOgqYffE-Wepk`
- タブ: `オリジナル`（gid `123639999`）
- タスク: 17〜73行（57件）
- C: 制作ステップ、D: アクション、E: 優先度
- F: ステータス（自動） / G: 作業中チェックボックス
- H: 予定月 / I: 開始する週 / J: 完了した週（ドロップダウン）
- 1行15列などの週列や数式は絶対に変更しない。
- 初回取得時に各行のD列テキストを含むスナップショットを `.tms-cache/tasks.json` に保存する。
- 書き込み前にスナップショットのアクション本文と現在の行を再照合する。差分があれば停止し `pull` で調査する。
- 競合書き込み回避のため、同時に複数Claudeを同一タスクで動かさない。
- 更新対象はG（作業中）とJ（完了週）だけ。タスクの順番や計画はTMSで人間が管理。
- 完了週はシートの許容候補（T:AH）から「実際の現在週」と一致するものを選ぶ。未来予定週を完了週として勝手に書かない。

```bash
python tools/tms.py auth
python tools/tms.py doctor
python tools/tms.py pull
python tools/tms.py next --limit 10
python tools/tms.py start 17
python tools/tms.py done 17
python tools/tms.py status
```

**認証:** 自分のGoogle Cloud OAuth デスクトップクライアントを `.secrets/credentials.json` に置く。Google Sheets API有効化、OAuthテストユーザー登録。初回OAuthで `.secrets/token.json` を作る。共有URLだけでは書き込み権限が付与されない。
