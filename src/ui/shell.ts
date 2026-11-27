// アプリの外枠（DOM）：全面の 3D ビュー、タイトル画面、鑑賞・編集の上部バー・ツールパレット・ヒント・通知。
// three.js や scene には依存しない。操作は main.ts から渡されるコールバックで伝える。レイアウトは docs/DESIGN.md。

export type StartKind = 'sample' | 'empty' | 'continue';
/** 鑑賞（一人称で歩く）/ 編集（斜め上から建てる・飾る）。TMS 39 */
export type ViewMode = 'view' | 'edit';
/** 編集の道具（ツールパレット）。TMS 40〜42・47 */
export type EditTool = 'select' | 'floor' | 'wall' | 'exhibit' | 'delete';

/** 移動ボタンの入力（-1〜1）。forward は前が正、strafe は右が正 */
export interface MoveInput {
  forward: number;
  strafe: number;
}

export interface ShellOptions {
  /** 体験開始ボタンが押された */
  onStart(kind: StartKind): void;
  /** ロゴが押された（タイトルに戻る） */
  onHome(): void;
  /** 画面の移動ボタン（スマホ）を押している間の入力。離すと {0, 0}（TMS 37） */
  onMove(input: MoveInput): void;
  /** 鑑賞 / 編集 の切り替えボタンが押された（TMS 39） */
  onModeChange(mode: ViewMode): void;
  /** ツールパレットで道具が選ばれた */
  onTool(tool: EditTool): void;
  /** 選択中のパーツを消す（情報パネルの削除ボタン・Delete / Backspace キー。TMS 42） */
  onDeleteSelected(): void;
  /** 選択を解除する（情報パネルの閉じる・Esc） */
  onClearSelection(): void;
  /** 選択中の作品を動かす（情報パネルの「移動」・M キー。TMS 47） */
  onMoveSelected(): void;
  /** 作品ライブラリから作品を選んだ（作品の道具。TMS 47） */
  onPickAsset(assetId: string): void;
  /** 作品情報パネルが閉じられた（閉じる・Esc） */
  onInfoClosed(): void;
  /** 3D 作品を近くで見ている間の「寄る（-）/ 離れる（+）」（TMS 52） */
  onInspectZoom(delta: number): void;
  /** 上部バーのメニュー（TMS 55〜64） */
  onMenu(action: MenuAction): void;
  /** 「JSON を読み込む」でファイルが選ばれた（TMS 56） */
  onImportFile(file: File): void;
}

/** メニューの項目 */
export type MenuAction = 'export' | 'import' | 'share' | 'quality' | 'help';

/** 作品ライブラリの一覧に出す 1 点 */
export interface LibraryItem {
  id: string;
  title: string;
  /** 例：「画像 ・ 壁」 */
  kind: string;
}

/** 鑑賞中の作品情報パネル（TMS 46） */
export interface ExhibitInfo {
  /** 例：「EXHIBIT / 002 ・ 画像」 */
  eyebrow: string;
  title: string;
  /** 例：「MUSEUM サンプル作品 ・ 2026」 */
  meta: string;
  description: string;
  /** HTML作品のとき「◆ 操作できるHTML作品」を出す */
  interactive: boolean;
}

/** 情報パネルに出す選択中のパーツ（TMS 42） */
export interface InspectorInfo {
  /** 例：「壁 10m」 */
  label: string;
  /** 例：「x -5〜5, z -4〜4」 */
  where: string;
  /** 作品なら「移動」ボタンを出す */
  movable: boolean;
}

export interface Shell {
  /** 3D ビューを入れる要素 */
  viewport: HTMLElement;
  /** focus: 鑑賞から戻ったときは主ボタンにフォーカスを移す（最初の表示では移さない） */
  showTitle(opts: { canContinue: boolean; focus: boolean }): void;
  /**
   * 3D ビューの画面。mode で鑑賞・編集の UI を切り替える。canEdit=false（スマホ）では編集の切替を出さない。
   * focus: タイトルから入ったときはロゴにフォーカスを移す（URL から直接開いたときは移さない）
   */
  showViewer(opts: { title: string; mode: ViewMode; canEdit: boolean; focus: boolean }): void;
  /** 選択中の道具を表示する */
  setTool(tool: EditTool): void;
  /** 使える道具（ほかは「準備中」で押せない） */
  setAvailableTools(tools: readonly EditTool[]): void;
  /** 編集中の左下ヒント（道具ごとの説明。グリッド座標など） */
  setEditHint(text: string): void;
  /** 画面下の短い通知（数秒で消える） */
  toast(message: string): void;
  /** 右上の情報パネル（選択中のパーツ）。null で隠す */
  showInspector(info: InspectorInfo | null): void;
  /** 右下の作品情報パネル（鑑賞中）。null で隠す（TMS 46） */
  showExhibitInfo(info: ExhibitInfo | null): void;
  /** 作品ライブラリの一覧（作品の道具を選んでいる間、右上に出す） */
  setLibrary(items: readonly LibraryItem[]): void;
  /** 3D 作品を近くで見ている間の操作の案内（TMS 52） */
  setInspecting(inspecting: boolean): void;
  /** 上部バー右の保存状態（例「ブラウザに保存済み」。TMS 57）。空文字で隠す */
  setSaveStatus(text: string): void;
  /** メニューに出す項目（未実装の項目は出さない） */
  setMenuItems(items: readonly MenuAction[]): void;
  /** メニューの項目の文言を変える（例：画質「標準」→「軽量」） */
  setMenuLabel(action: MenuAction, label: string): void;
  /** 操作のヘルプを開く（TMS 62） */
  openHelp(): void;
  /** 初めて鑑賞・編集に入ったときの案内（閉じたら二度と出さない。TMS 62） */
  showGuide(kind: 'view' | 'edit', touch: boolean): void;
}

const GUIDE_KEY = 'museum.guide.v1';
const GUIDES = {
  view: {
    title: 'ようこそ、サンプル美術館へ',
    pc: 'ドラッグで見回し、W A S D（矢印キー）で歩けます。作品をクリックすると解説が出ます。正面の HTML 作品は、ボタンとスライダーをそのまま押せます。',
    touch: '指でドラッグして見回し、右下のボタンで歩けます。作品をタップすると解説が出ます。正面の HTML 作品は、そのまま触れます。',
  },
  edit: {
    title: '編集モード',
    pc: '左の道具で、床（F）・壁（G）をマス目に置き、作品（B）をライブラリから飾れます。選択（V）で選んで M で移動、Delete で削除。ドラッグで部屋を回せます。編集はブラウザに自動で保存されます。',
    touch: '',
  },
} as const;

const MENU: { action: MenuAction; label: string }[] = [
  { action: 'export', label: 'JSON で書き出す' },
  { action: 'import', label: 'JSON を読み込む…' },
  { action: 'share', label: '共有用の URL をコピー' },
  { action: 'quality', label: '画質：標準' },
  { action: 'help', label: '操作のヘルプ' },
];

const TOOLS: { tool: EditTool; label: string; key: string; icon: string }[] = [
  { tool: 'select', label: '選択', key: 'V', icon: 'M5 3l13 8-6 1.5L9 19z' },
  { tool: 'floor', label: '床', key: 'F', icon: 'M3 15l9-5 9 5-9 5zM3 15v1M21 15v1' },
  { tool: 'wall', label: '壁', key: 'G', icon: 'M5 4h14v16H5zM5 9h14M5 14h14M12 4v5M9 9v5M15 9v5M12 14v6' },
  { tool: 'exhibit', label: '作品', key: 'B', icon: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4' },
  { tool: 'delete', label: '削除', key: 'X', icon: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13' },
];

export function mountShell(root: HTMLElement, opts: ShellOptions): Shell {
  root.innerHTML = `
<div class="app">
  <div id="viewport" class="app__viewport"></div>
  <section class="title-screen" aria-labelledby="title-heading">
    <div class="title-screen__inner">
      <div class="m-eyebrow">Museum</div>
      <h1 id="title-heading" class="m-hero">自分の世界を、<br />美術館にする。</h1>
      <p class="title-screen__lead">床と壁を置いて展示室を建て、絵・文章・映像・音・3D・操作できるHTML作品を飾って、その中を歩く。</p>
      <div class="title-screen__actions">
        <button type="button" class="m-btn m-btn--primary m-btn--lg" data-start="sample">サンプル美術館に入る</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--lg" data-start="empty">空の部屋から作る</button>
      </div>
      <button type="button" class="m-btn m-btn--ghost m-btn--sm title-screen__continue" data-start="continue" hidden>続きから（前回の編集）</button>
      <p class="title-screen__note">PC の Google Chrome 推奨 ・ スマホは鑑賞のみ ・ <button type="button" class="title-screen__about">この作品について</button></p>
    </div>
  </section>
  <div class="hud" hidden data-mode="view">
    <header class="m-topbar">
      <button type="button" class="m-brand hud__home" aria-label="タイトルに戻る">MUSEUM</button>
      <div class="m-segment hud__modes" role="group" aria-label="モード">
        <button type="button" data-mode-btn="view" aria-pressed="true">鑑賞</button>
        <button type="button" data-mode-btn="edit" aria-pressed="false">編集</button>
      </div>
      <div class="m-topbar__group">
        <span class="hud__title"></span>
        <span class="hud__save" role="status" aria-live="polite"></span>
        <button type="button" class="m-btn m-btn--ghost m-btn--sm hud__help-btn" aria-keyshortcuts="?">ヘルプ</button>
        <div class="hud__menu-wrap">
          <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="hud-menu">メニュー</button>
          <div id="hud-menu" class="m-panel m-panel--dark hud__menu" role="menu" hidden>
            ${MENU.map((m) => `<button type="button" role="menuitem" data-action="${m.action}">${m.label}</button>`).join('')}
          </div>
          <input type="file" class="hud__file" accept=".json,application/json" hidden />
        </div>
      </div>
    </header>
    <nav class="m-palette hud__palette" aria-label="編集の道具">
      ${TOOLS.map(
        (t) => `<button type="button" data-tool="${t.tool}" aria-pressed="false" aria-keyshortcuts="${t.key}" title="${t.label}（${t.key}）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t.icon}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>${t.label}
      </button>`,
      ).join('')}
    </nav>
    <div class="m-hint hud__hint-view">
      ドラッグ：見回す<span class="hud__keys"> ・ <kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd> / 矢印：歩く ・ <kbd class="m-kbd">Shift</kbd>：速く ・ <kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd>：向きを変える</span><span class="hud__touch"> ・ 右下のボタン：歩く</span>
    </div>
    <div class="m-hint m-hint--with-palette hud__hint-edit">
      <span class="hud__edit-tool"></span>
      <span class="hud__edit-keys">ドラッグ：回す ・ ホイール：寄る ・ <kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd>：ずらす ・ <kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd>：回す</span>
    </div>
    <div class="hud__inspect" role="group" aria-label="3D作品を近くで見る">
      <span class="hud__inspect-text">ドラッグ：回して見る ・ ホイール：寄る</span>
      <button type="button" class="m-btn m-btn--secondary m-btn--sm m-btn--icon" data-zoom="-0.25" aria-label="寄る">＋</button>
      <button type="button" class="m-btn m-btn--secondary m-btn--sm m-btn--icon" data-zoom="0.25" aria-label="離れる">−</button>
      <button type="button" class="m-btn m-btn--primary m-btn--sm hud__inspect-end">歩いて見るに戻る（Esc）</button>
    </div>
    <div class="move-pad" role="group" aria-label="移動（押している間歩く）">
      ${padButton('forward', '前へ', 'M6 15l6-6 6 6')}
      ${padButton('left', '左へ', 'M15 6l-6 6 6 6')}
      ${padButton('right', '右へ', 'M9 6l6 6-6 6')}
      ${padButton('back', '後ろへ', 'M6 9l6 6 6-6')}
    </div>
    <aside class="m-panel m-panel--dark hud__inspector" aria-label="選択中のパーツ" hidden>
      <div class="m-eyebrow">Selected</div>
      <h2 class="hud__inspector-label"></h2>
      <p class="m-muted hud__inspector-where"></p>
      <div class="hud__inspector-actions">
        <button type="button" class="m-btn m-btn--primary m-btn--sm hud__move" hidden>移動（M）</button>
        <button type="button" class="m-btn m-btn--danger m-btn--sm hud__delete">削除（Delete）</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__deselect">選択を解除（Esc）</button>
      </div>
    </aside>
    <aside class="m-panel m-panel--dark hud__library" aria-labelledby="hud-library-title" hidden>
      <div class="m-eyebrow">Library</div>
      <h2 id="hud-library-title">作品ライブラリ</h2>
      <p class="m-muted">選んでから、壁または床をクリックして置く。</p>
      <ul class="hud__library-list"></ul>
    </aside>
    <aside class="m-panel hud__info" aria-labelledby="hud-info-title" hidden>
      <div class="m-eyebrow hud__info-eyebrow"></div>
      <h2 id="hud-info-title" class="hud__info-title"></h2>
      <p class="m-muted hud__info-meta"></p>
      <p class="hud__info-badge" hidden><span class="m-badge">◆ 操作できるHTML作品</span></p>
      <p class="hud__info-desc"></p>
      <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__info-close">閉じる（Esc）</button>
    </aside>
    <div class="m-panel m-panel--dark hud__guide" role="dialog" aria-labelledby="hud-guide-title" hidden>
      <div class="m-eyebrow">Guide</div>
      <h2 id="hud-guide-title" class="hud__guide-title"></h2>
      <p class="hud__guide-text"></p>
      <div class="hud__inspector-actions">
        <button type="button" class="m-btn m-btn--primary m-btn--sm hud__guide-ok">わかった</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__guide-help">操作の一覧（?）</button>
      </div>
    </div>
    <div class="m-toast hud__toast" role="status" aria-live="polite" hidden></div>
  </div>
  <dialog class="help about" aria-labelledby="about-title">
    <div class="help__head">
      <div><div class="m-eyebrow">About</div><h2 id="about-title">MUSEUM ── 自分の世界を、美術館にする。</h2></div>
      <form method="dialog"><button class="m-btn m-btn--secondary m-btn--sm" value="close">閉じる（Esc）</button></form>
    </div>
    <p class="about__lead">床と壁をマス目に置いて自分の展示室を建て、絵・文章・映像・音・3D、そして<strong>その場で触れる HTML 作品</strong>を飾り、ブラウザの中でその部屋を歩いて鑑賞できる 3D 美術館です。インストールもログインも要りません。</p>
    <div class="help__grid">
      <section>
        <h3>特徴</h3>
        <ul>
          <li><strong>空間から作れる</strong>：用意された部屋に投稿するのではなく、床・壁を置いて部屋の形から自分で決める。鑑賞に切り替えると、その部屋を一人称で歩ける（壁は通り抜けない）。</li>
          <li><strong>6 種類の作品</strong>：画像・文章・動画・音・3D（GLB）・HTML。動画と音はクリックで再生、3D は近くで回して見られる。</li>
          <li><strong>3D の壁の上で HTML を操作</strong>：HTML 作品のボタンやスライダーを、3D 空間の中でそのまま押せる。スライダーで展示室の明るさが変わる。</li>
          <li><strong>そのまま残る・渡せる</strong>：編集はブラウザに自動保存。JSON で書き出し・読み込みできる。</li>
        </ul>
      </section>
      <section>
        <h3>技術</h3>
        <ul>
          <li><strong>HTML in Canvas</strong>（Chrome 157 で正式に使えるようになった新しい仕組み）で、本物の DOM を WebGL のテクスチャとして描き、カメラの動きに合わせて「要素 → 画面」の変換を毎フレーム更新して、3D の中でクリック・ドラッグを DOM に届けている。</li>
          <li>対応していないブラウザでは、同じ HTML を通常の画面のパネルで開いて操作できる（真っ白にしない）。</li>
          <li>Three.js・TypeScript・Vite。サーバーを持たない静的サイトで、どこでも同じ URL で開ける。</li>
          <li>安全のため、HTML 作品はアプリに同梱した公式テンプレートだけを動かし、読み込む JSON からは任意の HTML・URL を受け付けない。</li>
        </ul>
      </section>
      <section>
        <h3>対応環境</h3>
        <ul>
          <li>おすすめ：PC の Google Chrome 157 以降（建てる・飾る・HTML 作品を 3D の中で操作）。</li>
          <li>スマホ：鑑賞のみ（指で見回し、右下のボタンで歩く）。</li>
          <li>ほかのブラウザ：鑑賞と、HTML 作品のパネルでの操作。</li>
        </ul>
      </section>
      <section>
        <h3>素材とライセンス</h3>
        <ul>
          <li>サンプル作品（画像・動画・音・3D・文章）はすべてこのアプリのために新しく作ったもの（<a href="assets/CREDITS.md" target="_blank" rel="noopener">素材の出どころ</a>）。</li>
          <li>three.js（MIT License）を使用（<a href="THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener">ライセンス表示</a>）。</li>
        </ul>
      </section>
    </div>
  </dialog>
  <dialog class="help" aria-labelledby="help-title">
    <div class="help__head">
      <div><div class="m-eyebrow">Help</div><h2 id="help-title">操作のヘルプ</h2></div>
      <form method="dialog"><button class="m-btn m-btn--secondary m-btn--sm" value="close">閉じる（Esc）</button></form>
    </div>
    <div class="help__grid">
      <section>
        <h3>歩いて見る（鑑賞）</h3>
        <dl>
          <dt>見回す</dt><dd>ドラッグ（スマホは指で）／ <kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd></dd>
          <dt>歩く</dt><dd><kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd>・矢印キー（スマホは右下のボタン）、<kbd class="m-kbd">Shift</kbd> で速く</dd>
          <dt>作品の解説</dt><dd>作品をクリック。<kbd class="m-kbd">Esc</kbd> で閉じる</dd>
        </dl>
      </section>
      <section>
        <h3>作品ごとの操作</h3>
        <dl>
          <dt>HTML 作品</dt><dd>3D の壁の上で、ボタン・スライダーをそのまま操作（Chrome 157 以降。ほかのブラウザはクリックで開くパネル）</dd>
          <dt>動画・音</dt><dd>クリックで再生・一時停止。音は近づくほど大きく聞こえる</dd>
          <dt>3D 作品</dt><dd>クリックで近くで回して見る（ドラッグで回す、ホイール・＋−で寄る、<kbd class="m-kbd">Esc</kbd> で戻る）</dd>
        </dl>
      </section>
      <section>
        <h3>建てる・飾る（編集、PC のみ）</h3>
        <dl>
          <dt>道具</dt><dd>選択 <kbd class="m-kbd">V</kbd>・床 <kbd class="m-kbd">F</kbd>・壁 <kbd class="m-kbd">G</kbd>・作品 <kbd class="m-kbd">B</kbd>・削除 <kbd class="m-kbd">X</kbd></dd>
          <dt>選んだもの</dt><dd><kbd class="m-kbd">M</kbd> で作品を移動、<kbd class="m-kbd">Delete</kbd> で削除、<kbd class="m-kbd">Esc</kbd> で解除・取り消し</dd>
          <dt>視点</dt><dd>ドラッグで回す、ホイールで寄る、<kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd> でずらす、<kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd> で回す</dd>
        </dl>
      </section>
      <section>
        <h3>保存・共有</h3>
        <dl>
          <dt>自動保存</dt><dd>編集はこのブラウザに自動で保存。タイトルの「続きから」で開く</dd>
          <dt>JSON</dt><dd>メニューから書き出し・読み込み（人に渡すとき・別の端末で開くとき）</dd>
          <dt>共有 URL</dt><dd>メニュー「共有用の URL をコピー」でサンプル美術館を直接開く URL</dd>
        </dl>
      </section>
    </div>
  </dialog>
</div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const viewport = q<HTMLElement>('#viewport');
  const title = q<HTMLElement>('.title-screen');
  const hud = q<HTMLElement>('.hud');
  const hudTitle = q<HTMLElement>('.hud__title');
  const modes = q<HTMLElement>('.hud__modes');
  const palette = q<HTMLElement>('.hud__palette');
  const editTool = q<HTMLElement>('.hud__edit-tool');
  const toastEl = q<HTMLElement>('.hud__toast');
  const inspector = q<HTMLElement>('.hud__inspector');
  const info = q<HTMLElement>('.hud__info');
  const closeInfo = () => {
    info.hidden = true;
    opts.onInfoClosed();
  };
  q<HTMLButtonElement>('.hud__info-close').addEventListener('click', closeInfo);
  // 鑑賞中の Esc は作品情報パネルを閉じる（3D 作品を近くで見ているときは歩いて見るに戻る）
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && (!info.hidden || hud.dataset.inspect === 'true')) closeInfo();
  });
  // ---- 上部バーのメニュー（TMS 55〜64）----
  const menuBtn = q<HTMLButtonElement>('.hud__menu-btn');
  const menu = q<HTMLElement>('.hud__menu');
  const fileInput = q<HTMLInputElement>('.hud__file');
  const setMenuOpen = (open: boolean) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();
  };
  menuBtn.addEventListener('click', () => setMenuOpen(menu.hidden));
  menu.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    setMenuOpen(false);
    const action = btn.dataset.action as MenuAction;
    if (action === 'import') fileInput.click(); // ファイル選択はブラウザの画面で（このアプリはファイルを勝手に読まない）
    else opts.onMenu(action);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) opts.onImportFile(file);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !(e.target as HTMLElement).closest('.hud__menu-wrap')) setMenuOpen(false);
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setMenuOpen(false);
      menuBtn.focus();
    }
  });

  // ---- 操作のヘルプと初回の案内（TMS 62）----
  const help = q<HTMLDialogElement>('.help:not(.about)');
  const openHelp = () => {
    if (!help.open) help.showModal();
  };
  q<HTMLButtonElement>('.hud__help-btn').addEventListener('click', openHelp);
  // この作品について（TMS 70。応募フォームに技術説明の欄が無いので、作品ページの中で伝える）
  const about = q<HTMLDialogElement>('.about');
  q<HTMLButtonElement>('.title-screen__about').addEventListener('click', () => about.showModal());
  window.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    const isHelpKey = e.key === '?' || (e.code === 'Slash' && e.shiftKey); // 配列の違い（JIS・US）に関係なく
    if (!isHelpKey || hud.hidden || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    e.preventDefault();
    openHelp();
  });
  const guide = q<HTMLElement>('.hud__guide');
  const seenGuides = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(GUIDE_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  };
  let guideKind = '';
  const closeGuide = () => {
    guide.hidden = true;
    try {
      localStorage.setItem(GUIDE_KEY, JSON.stringify([...new Set([...seenGuides(), guideKind])]));
    } catch {
      /* 保存できない環境では、次回もう一度出るだけ */
    }
  };
  q<HTMLButtonElement>('.hud__guide-ok').addEventListener('click', closeGuide);
  q<HTMLButtonElement>('.hud__guide-help').addEventListener('click', () => {
    closeGuide();
    openHelp();
  });

  const inspectBar = q<HTMLElement>('.hud__inspect');
  inspectBar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.zoom) opts.onInspectZoom(Number(btn.dataset.zoom));
    else closeInfo();
  });
  q<HTMLButtonElement>('.hud__delete').addEventListener('click', () => opts.onDeleteSelected());
  q<HTMLButtonElement>('.hud__move').addEventListener('click', () => opts.onMoveSelected());
  const library = q<HTMLElement>('.hud__library');
  library.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-asset]');
    if (!btn) return;
    library.querySelectorAll('[data-asset]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    opts.onPickAsset(btn.dataset.asset!);
  });
  q<HTMLButtonElement>('.hud__deselect').addEventListener('click', () => opts.onClearSelection());
  const continueBtn = q<HTMLButtonElement>('[data-start="continue"]');
  const primaryBtn = q<HTMLButtonElement>('[data-start="sample"]');
  let mode: ViewMode = 'view';
  let toastTimer = 0;

  title.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-start]');
    if (btn) opts.onStart(btn.dataset.start as StartKind);
  });
  q<HTMLButtonElement>('.hud__home').addEventListener('click', () => opts.onHome());
  modes.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode-btn]');
    const next = btn?.dataset.modeBtn as ViewMode | undefined;
    if (next && next !== mode && !btn!.disabled) opts.onModeChange(next);
  });
  palette.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]');
    if (btn && !btn.disabled) opts.onTool(btn.dataset.tool as EditTool);
  });
  // 道具の切り替えキー（編集中のみ。文字入力中・修飾キー付きは除く）
  window.addEventListener('keydown', (e) => {
    if (hud.hidden || mode !== 'edit' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (e.code === 'Delete' || e.code === 'Backspace') {
      if (!inspector.hidden) {
        e.preventDefault();
        opts.onDeleteSelected();
      }
      return;
    }
    if (e.code === 'Escape') return opts.onClearSelection();
    if (e.code === 'KeyM' && !inspector.hidden && !q<HTMLButtonElement>('.hud__move').hidden) return opts.onMoveSelected();
    const t = TOOLS.find((x) => `Key${x.key}` === e.code);
    const btn = t && palette.querySelector<HTMLButtonElement>(`[data-tool="${t.tool}"]`);
    if (t && btn && !btn.disabled) opts.onTool(t.tool);
  });
  bindMovePad(q<HTMLElement>('.move-pad'), opts.onMove);

  return {
    viewport,
    showTitle({ canContinue, focus }) {
      continueBtn.hidden = !canContinue;
      hud.hidden = true;
      title.hidden = false;
      if (focus) primaryBtn.focus({ preventScroll: true });
    },
    showViewer({ title: museumTitle, mode: next, canEdit, focus }) {
      mode = next;
      hudTitle.textContent = museumTitle; // textContent なので HTML として解釈されない
      hud.dataset.mode = next;
      modes.hidden = !canEdit;
      modes.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.modeBtn === next));
      });
      title.hidden = true;
      hud.hidden = false;
      if (focus) q<HTMLButtonElement>('.hud__home').focus({ preventScroll: true });
    },
    setTool(tool) {
      library.hidden = tool !== 'exhibit';
      if (tool !== 'exhibit') library.querySelectorAll('[data-asset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      palette.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
      });
    },
    setAvailableTools(tools) {
      palette.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
        const t = TOOLS.find((x) => x.tool === b.dataset.tool)!;
        const ok = tools.includes(t.tool);
        b.disabled = !ok;
        b.title = ok ? `${t.label}（${t.key}）` : `${t.label}（準備中）`;
      });
    },
    setEditHint(text) {
      editTool.textContent = text ? `${text} ・ ` : '';
    },
    showInspector(info) {
      inspector.hidden = !info;
      if (!info) return;
      q<HTMLElement>('.hud__inspector-label').textContent = info.label;
      q<HTMLElement>('.hud__inspector-where').textContent = info.where;
      q<HTMLButtonElement>('.hud__move').hidden = !info.movable;
    },
    setSaveStatus(text) {
      q<HTMLElement>('.hud__save').textContent = text;
    },
    setMenuItems(items) {
      menu.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) => (b.hidden = !items.includes(b.dataset.action as MenuAction)));
    },
    setMenuLabel(action, label) {
      const b = menu.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (b) b.textContent = label;
    },
    openHelp,
    showGuide(kind, touch) {
      const g = GUIDES[kind];
      const textBody = touch ? g.touch : g.pc;
      if (!textBody || seenGuides().includes(kind)) {
        guide.hidden = true;
        return;
      }
      guideKind = kind;
      q<HTMLElement>('.hud__guide-title').textContent = g.title;
      q<HTMLElement>('.hud__guide-text').textContent = textBody;
      guide.hidden = false;
    },
    setInspecting(inspecting) {
      hud.dataset.inspect = String(inspecting);
    },
    setLibrary(items) {
      const list = q<HTMLElement>('.hud__library-list');
      list.replaceChildren(
        ...items.map((it) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.asset = it.id;
          b.setAttribute('aria-pressed', 'false');
          const t = document.createElement('span');
          t.textContent = it.title;
          const k = document.createElement('small');
          k.textContent = it.kind;
          b.append(t, k);
          li.append(b);
          return li;
        }),
      );
    },
    showExhibitInfo(next) {
      info.hidden = !next;
      if (!next) return;
      // すべて textContent（作品の文字列を HTML として解釈しない）
      q<HTMLElement>('.hud__info-eyebrow').textContent = next.eyebrow;
      q<HTMLElement>('.hud__info-title').textContent = next.title;
      q<HTMLElement>('.hud__info-meta').textContent = next.meta;
      q<HTMLElement>('.hud__info-desc').textContent = next.description;
      q<HTMLElement>('.hud__info-badge').hidden = !next.interactive;
    },
    toast(message) {
      toastEl.textContent = message;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3200);
    },
  };
}

// ---- 移動ボタン（スマホ・タッチ端末。TMS 37）----
type PadDir = 'forward' | 'back' | 'left' | 'right';
const PAD_VECTORS: Record<PadDir, MoveInput> = {
  forward: { forward: 1, strafe: 0 },
  back: { forward: -1, strafe: 0 },
  left: { forward: 0, strafe: -1 },
  right: { forward: 0, strafe: 1 },
};

function padButton(dir: PadDir, label: string, path: string) {
  return `<button type="button" class="move-pad__btn move-pad__btn--${dir}" data-move="${dir}" aria-label="${label}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
}

/** 押している間だけ歩く。指 2 本で 2 つ同時（前＋右など）も可 */
function bindMovePad(pad: HTMLElement, onMove: (input: MoveInput) => void) {
  const active = new Map<number, PadDir>(); // pointerId → 方向
  const emit = () => {
    let forward = 0;
    let strafe = 0;
    for (const dir of active.values()) {
      forward += PAD_VECTORS[dir].forward;
      strafe += PAD_VECTORS[dir].strafe;
    }
    onMove({ forward, strafe });
  };
  pad.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-move]');
    if (!btn) return;
    e.preventDefault(); // 長押しでの文字選択・拡大を防ぐ
    try {
      btn.setPointerCapture(e.pointerId); // 指がボタンの外へずれても押したままにする
    } catch {
      /* 取得できない環境でも、押している間の移動は続ける */
    }
    btn.classList.add('is-active');
    active.set(e.pointerId, btn.dataset.move as PadDir);
    emit();
  });
  const release = (e: PointerEvent) => {
    if (!active.has(e.pointerId)) return;
    active.delete(e.pointerId);
    (e.target as HTMLElement).closest('[data-move]')?.classList.remove('is-active');
    emit();
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  pad.addEventListener('lostpointercapture', release);
  pad.addEventListener('contextmenu', (e) => e.preventDefault()); // 長押しメニューを出さない
}
