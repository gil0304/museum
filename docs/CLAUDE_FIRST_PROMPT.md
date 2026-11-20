# Claude Codeに最初に送る指示文

このプロジェクトは、自分だけの3D美術館を建築し、6種類の作品を展示できるWebサービス「MUSEUM」です。
まず `CLAUDE.md`、`docs/PRODUCT_SPEC.md`、`docs/TMS_INTEGRATION.md`、`docs/ARCHITECTURE.md` を読み、`python tools/tms.py doctor` と `python tools/tms.py pull` を実行してください。

Google Sheetsの「オリジナル」タブが進捗の正本です。未完了のうち依存関係に問題のない最初のタスクを選び、行番号と作業内容を明示して `python tools/tms.py start <ROW>` を実行し、実装・検証後にのみ `python tools/tms.py done <ROW>` を使ってください。F列の数式・C:E/H:Iの計画は変更しないこと。

11月コンテスト提出版を優先し、HTML in Canvasの最小表示・入力操作を早期に検証してください。ブラウザでの実機検証が必要な場合、手動確認済みと自動チェックを区別してください。途中でOAuth設定や権限が不足している場合は、変更や進捗更新が完了したと偽らず必要な操作を報告してください。質問はブロッカーの場合だけ。変更内容とテスト結果を日本語で要約してください。
