# HTML in Canvas：対象ブラウザと利用条件

確認日: 2026-11-20（TMS 22行）。実験結果・採用方式の最終記録は TMS 29行で README に反映する。

## 結論
- **対象は Google Chrome 157 以上（デスクトップ / Android）**。Chrome 157 の安定版は **2026-11-03** に公開済みで、HTML in Canvas は**フラグもオリジントライアルのトークンも無しで、標準で有効**。
- このMacのChrome **157.0.8103.79** で、APIが存在することを**自動検出で確認済み**（ヘッドレスChrome。下の「検証記録」）。画面への描画とクリック操作は**まだ未確認**で、TMS 23・24行で確かめる。
- Firefox は未対応（Gecko の態度表明なし）。Safari は未対応（WebKit は前向きで実装作業中）。→ **通常DOMによる代替表示が必須**（TMS 28行）。

## 出典
- Intent to Ship（2026-09-30、デスクトップ・Android・WebViewとも157で出荷、全ユーザーに有効）: https://www.mail-archive.com/blink-dev@chromium.org/msg17593.html
- Chrome Status: https://chromestatus.com/feature/5172548013916160
- Chrome 157 のリリース日程（stable 2026-11-03）: https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=157
- 仕様の説明文書（WICG）: https://github.com/WICG/html-in-canvas

## 実装で使うAPI（Chrome 157で存在を確認したもの）
```html
<canvas id="c" content="drawable">
  <div id="panel" drawable>…ボタン・スライダー…</div>
</canvas>
```
| 用途 | API |
|---|---|
| 有効化 | canvas に `content="drawable"`、描画する子要素に `drawable` 属性 |
| 描画タイミング | `canvas.onpaint`（`CanvasPaintEvent.changedElements`）、`canvas.requestPaint()` で次のフレームに1回発火 |
| 2D描画 | `ctx.drawElementImage(element, x, y)` |
| **WebGL（Three.js用）** | `gl.texElementSubImage2D(target, level, xoffset, yoffset, element, config?)` |
| WebGPU | `GPUQueue.drawElementImageToTexture()` |
| 3Dでのクリック判定 | `canvas.updateElementGeometry(element, { canvasTransform, canvasClip, preserveHitTestOrder })`、`getElementTransform()`、`clearElementGeometry()` |
| その他 | `captureElementImage()`（スナップショット）、`getElementImageDefaultSize()`、`onelementgeometryupdate` |

### 注意：古い記事・生成コードの書き方は動かない
オリジントライアル期（Chrome 148〜154）の情報がネット上に多く残っている。以下は **Chrome 157 では使えない**:
- `<canvas layoutsubtree>` → 実行すると `InvalidStateError: DrawElementImage requires the canvas to have the content=drawable attribute.`
- `texElementImage2D` → 存在しない（`texElementSubImage2D` を使う）
- `copyElementImageToTexture`（WebGPU）→ 存在しない（`drawElementImageToTexture`）
- `chrome://flags/#canvas-draw-element` の有効化 → 不要
- `drawElementImage` の戻り値（旧 `DOMMatrix`）を前提にしない

## 利用条件・制約（プロダクトへの影響）
| 制約 | 影響と対応 |
|---|---|
| **最初の `paint` イベント前に `drawElementImage` を呼ぶと例外**（`No cached paint record for element.`、検証で確認） | 描画は必ず `onpaint` の中で行う。初回は `requestPaint()` で発火させる |
| **3D（WebGL）ではクリック位置の対応付けが自動ではない**。`updateElementGeometry` で「要素 → canvas上の位置」の変換を毎回渡す必要がある | Three.jsの平面の位置・向き・カメラから変換行列を計算する（TMS 26・27・54行の中心課題） |
| `paint` の中で行ったDOM変更は次のフレームまで反映されない | 状態変更は入力イベント側で行い、`paint` は描画だけにする |
| スクロールやアニメーションのスレッド処理は未対応 | HTML作品テンプレートではCSSアニメーション・内部スクロールに頼らない。必要なら `requestPaint()` で再描画 |
| プライバシー保護のため**描画されないもの**: 別オリジンの画像・iframe・SVG、IMEの変換候補、動画のコントロール、字幕、システムの色・テーマ、訪問済みリンク、スペルチェックの波線、サブピクセルの文字アンチエイリアス | HTML作品は**同一オリジンの素材だけ**で作る。**テキスト入力（日本語IME）を前提にしない**（ボタン・スライダー中心）。動画は Three.js の VideoTexture で別に扱う |
| 描画する要素は canvas の直下の子孫で、他の canvas の中に入れられない | DOM構成をテンプレート側で固定する |
| **要素画像の既定サイズは canvas の実ピクセル基準**（CSS幅320px・dpr 2 → 640px）。`ctx.scale(dpr)` を掛けたまま描くと2倍に拡大される（TMS 23で発生・修正） | 描画時だけ `setTransform(1,0,0,1,0,0)` にして実ピクセル座標で描く。WebGLテクスチャの解像度も dpr を考慮して決める |
| **`updateElementGeometry` の `canvasTransform` は「要素の CSS px → canvas の CSS px」**（実ピクセルではない）。実ピクセル基準の行列を渡すと、クリック判定の範囲が dpr 倍ずれる（TMS 26で検証） | 描画（実ピクセル）とクリック判定（CSS px）で座標系が違う。行列のビューポート変換は `canvas.clientWidth/clientHeight` で作る |
| Three.js は `texElementSubImage2D` を知らないので、GL を直接触ると three.js の状態キャッシュとずれる | テクスチャは `DataTexture` を `renderer.initTexture()` で先に確保 → `renderer.state.bindTexture()` → 転送 → `renderer.resetState()` |

## ブラウザごとの扱い（提出版）
| ブラウザ | 扱い | 状態 |
|---|---|---|
| Chrome 157+（PC） | HTML in Canvas で3D空間内のHTML作品を直接操作 | 2D canvas（23〜25行）と Three.js の3D平面（26行）で表示・クリック・ドラッグを自動確認済み。人間の実機確認は未実施 |
| Chrome 157+（Android） | 同上（鑑賞中心） | 未確認 |
| Edge / Arc など Chromium 系 | 内部のChromiumが157以上なら動く可能性。**機能検出で判定**し、推定で対応表に載せない | 未確認 |
| Firefox / Safari / 古いChrome | 3D展示室は描画し、HTML作品は平面クリックで通常DOMのダイアログを開いて操作 | Chromeの `?fallback=1` で自動確認済み（28行）。本物の非対応ブラウザは未確認（66行） |

機能検出（アプリ起動時に1回）:
```ts
const supportsHtmlInCanvas =
  'drawElementImage' in CanvasRenderingContext2D.prototype &&
  'requestPaint' in HTMLCanvasElement.prototype &&
  'texElementSubImage2D' in WebGL2RenderingContext.prototype &&
  'updateElementGeometry' in HTMLCanvasElement.prototype;
```

## 本体アプリに組み込むときの注意
- 本体の描画（`src/scene/viewer.ts`）は TMS 35 から **Neutral トーンマッピング**と**影**を使う。HTML作品の板の材質は `toneMapped: false` にし、照明の影響を受けない材質（`MeshBasicMaterial`）にして、HTML の色をそのまま出す（検証ページ `hic-three` はトーンマッピングなしで色の一致 135/135 を確認済み）。
- 影は部屋が変わったときだけ描き直す（`renderer.shadowMap.autoUpdate = false`）。HTML作品の板を動かしたら `viewer.invalidateShadows()` を呼ぶ。

## 本体アプリへの組み込み（TMS 53、`src/exhibits/htmlExhibit.ts`・`htmlTemplates.ts`）
- 公式テンプレート「拍手のカウンター」（`template: 'clap-counter'`）を、作品ライブラリの HTML 作品として壁に掛ける。データからはテンプレート名で選ぶだけで、任意の HTML・JS は受け取らない（知らない名前・`toString` などは何も作らない）。
- 対応ブラウザ：本体の 3D canvas に `content="drawable"` を付け、パネルを子に入れる。`paint` のたびに `texElementSubImage2D` でテクスチャへ転送（材質は `MeshBasicMaterial`・`toneMapped: false`）。毎フレーム、カメラを動かした後に `updateElementGeometry`（CSS px）を更新する。
- クリック判定を外すとき：裏から見ている・9m より遠い・あいだに壁がある・鑑賞以外（編集・タイトル・3D 作品を近くで見ている）。編集中は HTML 作品も他の作品と同じく選んで動かせる。
- 視点操作（一人称・編集・近くで見る）は `e.target !== canvas` のポインター操作を無視し、パネルの中から始まったドラッグ（スライダー）で視点が動かないようにした。
- スライダーは `museum:light` を発行し、展示室の半球光の明るさを変える（HTML が 3D の世界を動かす例）。
- 非対応・`?fallback=1`：平面に「作品名・今の様子・▶ クリックして操作する」を描き、クリックで同じパネルを `<dialog>` に移す（ボタンにフォーカス、Esc・閉じるで戻る、案内は操作に合わせて描き直す）。

### TMS 53 の確認（Claude in Chrome、2026-11-27）
| 確認 | 結果 |
|---|---|
| 正面から「拍手する」×3 → 3 | ✅ |
| スライダーを 50→89 にドラッグ → 展示室が明るくなる（半球光 1.5→2.38）、視点は動かない | ✅ |
| 斜め（入口付近）から「拍手する」「リセット」 | ✅ 4 → 0 |
| 編集モードでクリック → ボタンは押されず、作品として選択される | ✅ |
| `?fallback=1`：案内表示 → クリックでダイアログ → Enter×2 で 2 → Esc で閉じ、案内が「拍手 2 回」に | ✅ |
| 人間の実機確認・本物の非対応ブラウザ（Safari / Firefox） | 未実施（TMS 66） |

## 検証記録（自動チェック）
- 実行環境: macOS、Google Chrome 157.0.8103.79（`--headless=new`、127.0.0.1 から配信したページ、安全なコンテキスト）
- 存在を確認したもの: `drawElementImage`、`requestPaint`、`onpaint`、`captureElementImage`、`updateElementGeometry`、`clearElementGeometry`、`getElementTransform`、`getElementImageDefaultSize`、`onelementgeometryupdate`、`texElementSubImage2D`（WebGL1/2）、`GPUQueue.drawElementImageToTexture`、`CanvasPaintEvent`、`ElementImage`
- 存在しないもの: `layoutSubtree`、`texElementImage2D`、`copyElementImageToTexture`
- `layoutsubtree` 属性での描画 → 上記の `InvalidStateError`（旧方式は使えない）
- `content="drawable"` での描画 → ヘッドレスでは `paint` イベントが発火せず、画面への描画は未確認（`No cached paint record`）。**画面のあるChromeでの確認はTMS 23行で行う。**
- 人間による実機確認: **未実施**

### TMS 23：最小表示ページ（2026-11-20）
- ページ: `spikes/hic-basic.html`（`npm run dev` → http://127.0.0.1:5173/spikes/hic-basic.html）。本番ビルド（`npm run build` → `vite preview`）の `/spikes/hic-basic.html` でも同じ結果を自動確認済み
- 実行環境: macOS、Google Chrome 157.0.0.0（画面あり、devicePixelRatio 2）、Claude in Chrome 拡張による**自動確認**
- 結果: `content="drawable"` の canvas に、日本語（明朝体）を含む実DOMパネルが `drawElementImage` で描画された。`paint` イベントは発火（初回と ResizeObserver で計2回）。パネル内の赤帯を canvas の `getImageData` で `rgba(200,40,40,255)` として検出。コンソールのエラーなし。
- スクリーンショットで目視: canvas の背景・装飾線・ラベル（canvasの描画命令）とパネル（実DOM）が重なって表示されている。
- 人間による実機確認: **未実施**（ページを開けば画面下の判定欄で同じ結果を確認できる）
- 非対応ブラウザでは、パネルを canvas の外に出して通常DOMで表示する簡易的な代替を入れた（本格的な代替は TMS 28）。

### TMS 24：ボタンのクリック（2026-11-20）
- ページ: `spikes/hic-input.html`（「拍手する」でパネル内の数字が増え、「リセット」で0に戻る）
- 実行環境: macOS、Google Chrome 157（画面あり、dpr 2）、Claude in Chrome 拡張による**自動確認**（実際のマウス・キーボード入力。`isTrusted=true`）
- **2D canvas ではクリック判定が自動でそろう**：`drawElementImage` で描いた位置（CSS座標で 48,40 だけずらした位置）で `elementFromPoint` を呼ぶとボタンが返る。`updateElementGeometry` を呼ぶ必要はなかった。
- 結果:
  | 操作 | 期待 | 結果 |
  |---|---|---|
  | 「拍手する」を3回クリック | click 3回、canvas 上の数字が 3 | ✅ click 3回、表示 3（DOMと一致） |
  | パネル外（canvas の背景）をクリック | ボタンは反応せず、canvas 本体に届く | ✅ canvas に1回、ボタンは0回 |
  | パネルの見出し（ボタンでない部分）をクリック | どのボタンも反応しない | ✅ 反応なし |
  | 「リセット」をクリック | 隣のボタンと区別され、数字が 0 | ✅ reset 1回、表示 0 |
  | Shift+Tab でフォーカス → Enter 2回 | キーボードでも押せる | ✅ 表示 2、`document.activeElement` は「拍手する」 |
  | `:hover`・`:focus-visible` の見た目 | canvas に反映される | ✅ ホバー時の明るい赤、青いフォーカス枠が canvas 上に描かれた |
- DOMの変更（数字の書き換え・hover・focus）のたびに `paint` イベントが発火し、自動で再描画された（12回）。`requestPaint()` を明示的に呼ぶ必要はなかった。
- コンソールのエラーなし。
- 記録GIF: `hic-spike02-button-click.gif`（Chrome のダウンロードフォルダに保存）
- 人間による実機確認: **未実施**

### TMS 25：スライダー入力（2026-11-20）
- ページ: `spikes/hic-input.html` の「展示照明の明るさ」（`<input type="range">` 0〜100）。値に応じてパネル内の数値と色見本のグレー（`20 + 値×2.3`）が変わる。
- 実行環境: macOS、Google Chrome 157（画面あり、dpr 2）、Claude in Chrome 拡張による**自動確認**（実際のマウス・キーボード入力）
- 判定方法: `paint` のたびに canvas 上の色見本の中央を `getImageData` で読み、スライダーの値から計算した期待の明るさと比較（誤差±3）。
- 結果:
  | 操作 | 値 | canvas 上の表示 | 色見本ピクセル（期待） |
  |---|---|---|---|
  | 初期状態 | 50 | 50 | ✅ rgb(135,135,135)（135） |
  | つまみを右端までドラッグ | 100 | 100 | ✅ rgb(250,250,250)（250） |
  | 溝の左から約25%の位置をクリック | 23 | 23 | ✅ rgb(73,73,73)（73） |
  | 右矢印キー ×5 | 28 | 28 | ✅ rgb(84,84,84)（84） |
  | つまみをパネルの外（左）まで引っ張る | 0 | 0 | ✅ rgb(20,20,20)（20） |
- ドラッグ中にポインタがパネルの外に出ても操作が途切れなかった（ネイティブのポインタキャプチャが効いている）。
- つまみ・塗られた溝・フォーカス枠（青）もネイティブの見た目のまま canvas に描かれた。
- `input` イベント 10回、`paint` 12回。コンソールのエラーなし。
- 記録GIF: `hic-spike02-slider.gif`（Chrome のダウンロードフォルダに保存）
- 人間による実機確認: **未実施**
- 2D canvas での結論（TMS 23〜25）: **表示・クリック・キーボード・ドラッグのすべてが、通常のDOMと同じコードで動く。** 次は Three.js（WebGL）の3D平面に載せたときに同じ操作が成り立つか（TMS 26・27）。

### TMS 26：Three.js の3D平面にHTMLパネル（2026-11-20）
- ページ: `spikes/hic-three.html` / `src/spikes/hic-three.ts`。既存の展示室（`createDemoRoom`）に、幅1.4mの平面を y軸まわりに0.45rad 傾けて立て、パネル（ボタン2つ＋スライダー）を貼った。スライダーは展示室の環境光（`HemisphereLight`）の強さに連動。
- 方式:
  1. `<canvas content="drawable">` を `THREE.WebGLRenderer({ canvas })` に渡す。パネルは canvas の子（`drawable`）。
  2. `onpaint` で `getElementImageDefaultSize`（640×618）の `DataTexture` を確保し、`gl.texElementSubImage2D(TEXTURE_2D, 0, 0, 0, panel)` で転送。`UNPACK_FLIP_Y_WEBGL=true` で上下の向きが正しくなる。`MeshBasicMaterial({ toneMapped: false })`、テクスチャは sRGB。
  3. 毎フレーム `ビューポート(CSS px) × 投影 × ビュー × 平面のworld行列 × (要素px→平面m)` を計算して `updateElementGeometry(panel, { canvasTransform })`。three.js の `Matrix4.elements` はそのまま `DOMMatrix.fromFloat64Array` に渡せる（どちらも列優先）。
- 実行環境: macOS、Google Chrome 157（画面あり、dpr 2）、Claude in Chrome 拡張による**自動確認**（実際のマウス入力）
- 結果:
  | 確認 | 結果 |
  |---|---|
  | 表示 | ✅ 斜めの平面に透視投影で表示。文字・ボタン・スライダーが判読でき、上下左右の向きも正しい。`glError` 0 |
  | 色の正確さ | ✅ WebGL の描画結果を `readPixels` で読み、色見本が期待値どおり（50→135、100→250、0→20） |
  | クリック判定（`elementFromPoint`） | ✅ CSS px 基準の行列で4要素すべて一致。実ピクセル基準（`?geom=grid`）では全て canvas に外れる |
  | 「拍手する」を3回クリック | ✅ 3回、テクスチャ上の数字も 3 |
  | スライダーを右端→左端にドラッグ | ✅ 100 → 0。展示室の照明も明るく→暗く変化 |
  | 「リセット」クリック | ✅ 0 に戻る |
  | 床（パネル外）をクリック | ✅ パネルは反応しない |
- DOM の変化があったときだけ `paint` → テクスチャ転送が起きる（17回の paint に対して17回転送）。毎フレーム転送はしていない。
- コンソールのエラーなし。記録GIF: `hic-spike03-three-plane.gif`（Chrome のダウンロードフォルダ）
- 人間による実機確認: **未実施**
- 残課題（TMS 27・54）: カメラ移動中も判定が追従するか、ドラッグ視点操作とパネル操作の競合、パネルが画面上で小さいときの押しやすさ、平面の裏側から見たときの扱い。

### TMS 27：カメラを動かしても操作できるか（2026-11-20）
- ページ: `spikes/hic-three.html` に一人称カメラを追加。背景（canvas 本体）のドラッグで視点回転、WASD / 矢印キーで移動。`?orbit=1` でカメラを自動で揺らし続けるモード。
- 方式:
  - 毎フレーム `カメラ更新 → updateElementGeometry → render` の順に実行し、クリック判定をカメラに追従させる。
  - **入力の振り分け**: `pointerdown` の `target` が canvas 本体のときだけ視点ドラッグを開始し、パネル内の要素（ボタン・スライダー）から始まった操作はカメラに渡さない。キー移動は `panel.contains(document.activeElement)` のときは無視（スライダーの矢印キーを奪わない）。
  - **裏面**: 平面の法線とカメラ方向の内積が0以下（裏から見ている）なら `clearElementGeometry(panel)` でクリック判定を外す（材質が FrontSide なので裏からは何も描かれない）。
- 実行環境: macOS、Google Chrome 157（画面あり、dpr 2）、Claude in Chrome 拡張による**自動確認**
- 結果:
  | 確認 | 結果 |
  |---|---|
  | **移動中の追従**（`?orbit=1`、約8秒） | ✅ カメラが動いた **903フレームすべて** で、投影した「拍手する」の位置で `elementFromPoint` がボタンを返した（不一致0、画面外0） |
  | 背景ドラッグで視点回転 → 停止してクリック | ✅ yaw 0.15→0.31。「拍手する」2回クリックが反映 |
  | 近距離・強い斜め（yaw 0.85、パネルが画面の右半分を占める）でクリック | ✅ 反映。4要素の判定もすべて一致 |
  | 同じ視点でスライダーをドラッグ → 矢印キー ×5 | ✅ 値 50→96→91。**カメラ位置・向きは変化せず、視点ドラッグ回数も増えない**（入力の競合なし） |
  | 裏側に回り込む | ✅ 正面では canvas 上 330 点がパネル要素に当たり、裏からは **0 点**（全て canvas）。裏からのクリックは視点ドラッグとして扱われ、パネルは反応しない |
  | 正面に戻る → 「リセット」 | ✅ 判定が戻り、リセットが反映 |
- コンソールのエラーなし。記録GIF: `hic-spike03-camera-move.gif`（Chrome のダウンロードフォルダ）
- **自動化で確認できなかったこと**:
  - **動いている最中のボタンを本物のクリックで押すこと**。座標を読んでからクリックまで数秒かかり、その間にボタンが移動してしまう。移動中の追従は上の「903フレーム全一致」（`elementFromPoint` による判定）で代替した。
  - **WASD で歩く操作**。自動化のキー入力は押してすぐ離すため、ほとんど進まない（0.02m）。移動後の状態は検証用の `window.__hicView` でカメラを置いて再現した。キーを押し続けて歩く操作は人間の確認が必要。
- 人間による実機確認: **未実施**
- 運用上の注意: 自動判定の「色見本」は `paint` のときだけ読むため、パネルが画面外や裏側にあると「不一致」と出る（描画の不具合ではない）。
- 残課題（TMS 54）: パネルが小さく映るときの押しやすさ（近づく導線・クリックでパネル正面へ寄る等）、ホイール等ほかの入力、複数パネルでの重なり順（`preserveHitTestOrder`）。

### TMS 28：非対応時の通常DOM表示（2026-11-20）
- 判定: `src/exhibits/htmlInCanvasSupport.ts`
  - `supportsHtmlInCanvas3D()` … `requestPaint`・`updateElementGeometry`・`clearElementGeometry`・`getElementImageDefaultSize`・`WebGL2RenderingContext.texElementSubImage2D` がそろっているか
  - `detectHtmlInCanvasMode()` … `'html-in-canvas' | 'dom-fallback'`。URL に `?fallback=1` があれば対応ブラウザでも代替表示を強制（Chrome で非対応時の見え方を確認するため）
- 代替表示の方式（`spikes/hic-three.html?fallback=1`）:
  1. **3Dの展示室はそのまま描画**する（WebGL だけで動く部分は非対応ブラウザでも同じ）。
  2. パネルの平面には、作品名・現在の状態（拍手の数・照明の値）・「▶ クリックして操作する」を描いた **CanvasTexture の案内** を貼る。
  3. 平面をクリック（ドラッグではなく、5px 未満の移動で離したとき）すると Raycaster で当たりを調べ、**同じ `#panel` を `<dialog>` の中に移して `showModal()`**。作品のHTML・CSS・JSは1つのまま、通常のDOMとして操作できる。
  4. 閉じる: 「閉じる」ボタン、Esc。閉じると canvas にフォーカスが戻る。canvas は `tabIndex=0` で、Enter / Space でも開ける（キーボードだけで操作可能）。
  5. ダイアログ内の操作は、3Dの展示室（照明）と案内の絵（数値）にも反映する。
  6. canvas から `content` 属性を外し、非対応ブラウザと同じ状態にする（canvas の子要素は表示されないフォールバック内容のまま）。
- 実行環境: macOS、Google Chrome 157 で `?fallback=1`（非対応状態の再現）、Claude in Chrome 拡張による**自動確認**
- 結果:
  | 確認 | 結果 |
  |---|---|
  | 起動時の状態 | ✅ 方式 `dom-fallback`、canvas の `content` 属性なし、パネルは `<dialog>` 内。3D展示室と平面の案内が描画される |
  | 床（平面の外）をクリック | ✅ 開かない |
  | 平面をクリック | ✅ ダイアログが開き、フォーカスは「拍手する」 |
  | ダイアログ内で「拍手する」2回・スライダーを右端へドラッグ | ✅ 2回・照明100。背景の展示室も明るくなる |
  | Esc で閉じる | ✅ 閉じて canvas にフォーカスが戻る。3D内の案内に「2」「明るさ 100」が反映 |
  | canvas にフォーカスして Enter | ✅ 開く |
  | 「閉じる」ボタン | ✅ 閉じる |
  | 回帰: `?fallback=1` なし | ✅ 方式 `html-in-canvas`、4要素のクリック判定一致、色見本一致、3D内のボタンクリックが反映、ダイアログは作られない |
- コンソールのエラーなし。記録GIF: `hic-spike03-dom-fallback.gif`（Chrome のダウンロードフォルダ）
- **未確認**: 本物の非対応ブラウザ（Safari / Firefox）。Safari の自動操作には設定変更（リモート自動化の許可）が必要なため行っていない。**人間による確認が必要**（TMS 66 でも確認）。確認方法: Safari で `npm run dev` の http://localhost:5173/spikes/hic-three.html を開き、「表示方式」が「代替表示（通常DOM）」になり、平面のクリックでパネルが開いて操作できること。
  - 注意: `CanvasRenderingContext2D.roundRect` を使用（Safari 16 以降は対応）。それより古いブラウザは対象外。
- 人間による実機確認: **未実施**

- Arc: Claude in Chrome 拡張がArcのスタートページ（`chrome://start-page/...`）で動かず、自動確認できなかった。Arcで試す場合はコンソールで上の機能検出を実行する
