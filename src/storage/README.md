ブラウザ内の保存。types・data だけ import 可（画面・3D には依存しない）。
- museums.ts: 自分の美術館（複数）を localStorage に保存（一覧と中身。読むときは parseMuseum で検査）
- userAssets.ts: 利用者が追加した作品を IndexedDB に保存し、作品ライブラリに登録（ファイルの種類・大きさ・外部参照する .glb の拒否）
