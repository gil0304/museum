作品の種類ごとの表示と、HTML in Canvas の判定・代替表示。types・scene・three を import 可（ui・data は不可）。
- htmlInCanvasSupport.ts: HTML in Canvas が使えるかの判定（?fallback=1 で代替表示を強制）
技術検証の記録: docs/HTML_IN_CANVAS.md（検証ページは src/spikes/）
- exhibitObjects.ts: 作品の 3D 表示（種類ごと）と、床の作品の台座の当たり判定（TMS 44〜）。データ型と座標は docs/EXHIBITS.md
- objectModels.ts: 内蔵の置き物（ベンチ・植物・柱・低い台・ランプ・ラグ）の形
