// アプリの外枠（DOM）：全面の 3D ビュー、タイトル画面、鑑賞・編集の上部バー・道具・パネル・通知。
// three.js や scene には依存しない。操作は main.ts から渡されるコールバックで伝える。レイアウトは docs/DESIGN.md。
// 文字は最小限：常に出しておく操作の説明・座標・保存状態は出さない（説明はヘルプと初回の 1 行だけ）。

/** 鑑賞（一人称で歩く）/ 編集（斜め上から建てる・飾る） */
export type ViewMode = 'view' | 'edit';
/** 編集の道具 */
export type EditTool = 'select' | 'floor' | 'wall' | 'exhibit' | 'object' | 'style' | 'delete';
/** メニューの項目 */
export type MenuAction = 'export' | 'import' | 'share' | 'quality' | 'help' | 'delete';

/** 移動ボタンの入力（-1〜1）。forward は前が正、strafe は右が正 */
export interface MoveInput {
  forward: number;
  strafe: number;
}

export interface ShellOptions {
  /** 「美術館をつくる」 */
  onNew(): void;
  /** 「サンプルを見る」 */
  onSample(): void;
  /** 自分の美術館を開く */
  onOpenMuseum(id: string): void;
  onHome(): void;
  onMove(input: MoveInput): void;
  onModeChange(mode: ViewMode): void;
  onTool(tool: EditTool): void;
  onDeleteSelected(): void;
  onClearSelection(): void;
  onMoveSelected(): void;
  /** 選んだ作品の名前を変えた */
  onRenameSelected(title: string): void;
  onPickAsset(assetId: string): void;
  /** 作品ライブラリの「＋」でファイルが選ばれた */
  onUpload(file: File): void;
  /** 自分の作品をライブラリから消す */
  onRemoveAsset(assetId: string): void;
  onInfoClosed(): void;
  onInspectZoom(delta: number): void;
  onMenu(action: MenuAction): void;
  onImportFile(file: File): void;
  /** 美術館の名前を変えた */
  onRename(title: string): void;
  /** 置き物の一覧の「＋」で .glb が選ばれた */
  onUploadObject(file: File): void;
  /** 選んだ床の物を回す */
  onRotateSelected(): void;
  /** 選んだ壁・床の色 */
  onColorSelected(color: string): void;
  /** 雰囲気を変えた（変えた項目だけ） */
  onStyle(style: Partial<StyleValue>): void;
}

/** 雰囲気（色と光）。types/museum.ts の MuseumStyle と同じ形（ui は types に依存しない作りなので写し） */
export interface StyleValue {
  wall: string;
  floor: string;
  light: number;
  warmth: number;
}

/** 雰囲気のプリセット */
const PRESETS: { label: string; style: StyleValue }[] = [
  { label: 'ギャラリー', style: { wall: '#eeebe5', floor: '#b9b2a8', light: 1, warmth: 0 } },
  { label: '白', style: { wall: '#f7f7f5', floor: '#e2dfd9', light: 1.15, warmth: -0.15 } },
  { label: '木', style: { wall: '#e6d8c3', floor: '#9a7652', light: 1, warmth: 0.35 } },
  { label: '夕暮れ', style: { wall: '#e9d6c0', floor: '#7a5a43', light: 0.75, warmth: 0.85 } },
  { label: '夜', style: { wall: '#3a3d45', floor: '#26262b', light: 0.55, warmth: -0.45 } },
];
/** 壁・床に使える色見本 */
const SWATCHES = ['#f7f7f5', '#eeebe5', '#e6d8c3', '#c9b8a6', '#b9b2a8', '#9a7652', '#7a4a3a', '#8a9a8e', '#5a6b7a', '#3a3d45', '#26262b'];
const swatchRow = (name: string) =>
  `<div class="swatches" data-swatches="${name}">${SWATCHES.map((c) => `<button type="button" data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}<input type="color" aria-label="ほかの色" /></div>`;

export interface LibraryItem {
  id: string;
  title: string;
  /** 例「画像」 */
  kind: string;
  own: boolean;
}

export interface InspectorInfo {
  title: string;
  /** 作品・置き物なら名前を変えられ、「移動」を出す */
  exhibit: boolean;
  /** 床の物なら「回転」を出す */
  rotatable: boolean;
  /** 壁・床なら色見本を出す（今の色） */
  color?: string;
}

export interface ExhibitInfo {
  title: string;
  /** 作者・年（無ければ空） */
  meta: string;
  description: string;
  /** 読み込めなかったときなど */
  warning?: string;
}

export interface Shell {
  viewport: HTMLElement;
  showTitle(opts: { museums: { id: string; title: string }[]; canCreate: boolean; focus: boolean }): void;
  showViewer(opts: { title: string; mode: ViewMode; canEdit: boolean; canRename: boolean; focus: boolean }): void;
  setTool(tool: EditTool): void;
  setAvailableTools(tools: readonly EditTool[]): void;
  toast(message: string): void;
  showInspector(info: InspectorInfo | null): void;
  showExhibitInfo(info: ExhibitInfo | null): void;
  setLibrary(items: readonly LibraryItem[]): void;
  setInspecting(inspecting: boolean): void;
  setMenuItems(items: readonly MenuAction[]): void;
  setMenuLabel(action: MenuAction, label: string): void;
  openHelp(): void;
  showGuide(kind: 'view' | 'edit', touch: boolean): void;
  /** 美術館の名前の入力を始める（新しく作った直後） */
  startRename(): void;
  setObjectLibrary(items: readonly LibraryItem[]): void;
  /** 雰囲気の表示を今の値に合わせる */
  setStyle(style: StyleValue): void;
}

const TOOLS: { tool: EditTool; label: string; key: string; icon: string }[] = [
  { tool: 'select', label: '選択', key: 'V', icon: 'M5 3l13 8-6 1.5L9 19z' },
  { tool: 'floor', label: '床', key: 'F', icon: 'M3 15l9-5 9 5-9 5zM3 15v1M21 15v1' },
  { tool: 'wall', label: '壁', key: 'G', icon: 'M5 4h14v16H5zM5 9h14M5 14h14M12 4v5M9 9v5M15 9v5M12 14v6' },
  { tool: 'exhibit', label: '作品', key: 'B', icon: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4' },
  { tool: 'object', label: 'もの', key: 'O', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5' },
  { tool: 'style', label: '雰囲気', key: 'C', icon: 'M12 3a9 9 0 100 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 004-4c0-5.5-4-10-9-10zM7.5 12a1 1 0 100-2 1 1 0 000 2zM10 7.5a1 1 0 100-2 1 1 0 000 2zM15 7.5a1 1 0 100-2 1 1 0 000 2z' },
  { tool: 'delete', label: '削除', key: 'X', icon: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13' },
];

const MENU: { action: MenuAction; label: string }[] = [
  { action: 'export', label: '書き出す' },
  { action: 'import', label: '読み込む…' },
  { action: 'share', label: 'URL をコピー' },
  { action: 'quality', label: '軽量モード' },
  { action: 'help', label: 'ヘルプ' },
  { action: 'delete', label: 'この美術館を削除' },
];

const GUIDE_KEY = 'museum.guide.v1';
const GUIDES = {
  view: { pc: 'ドラッグで見回し、W A S D で歩く。作品はクリック。', touch: '指で見回し、右下のボタンで歩く。作品はタップ。' },
  edit: { pc: '床と壁を置いて、作品を飾る。', touch: '' },
} as const;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function mountShell(root: HTMLElement, opts: ShellOptions): Shell {
  root.innerHTML = `
<div class="app">
  <div id="viewport" class="app__viewport"></div>
  <section class="title-screen" aria-labelledby="title-heading">
    <div class="title-screen__inner">
      <h1 id="title-heading" class="m-hero">自分だけの<br />美術館を作ろう</h1>
      <div class="title-screen__actions">
        <button type="button" class="m-btn m-btn--primary m-btn--lg" data-start="new">美術館をつくる</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--lg" data-start="sample">サンプルを見る</button>
      </div>
      <ul class="title-screen__mine" aria-label="自分の美術館"></ul>
    </div>
    <button type="button" class="title-screen__about">この作品について</button>
  </section>
  <div class="hud" hidden data-mode="view">
    <header class="m-topbar">
      <button type="button" class="m-brand hud__home" aria-label="タイトルに戻る">MUSEUM</button>
      <div class="m-segment hud__modes" role="group" aria-label="モード">
        <button type="button" data-mode-btn="view" aria-pressed="true">鑑賞</button>
        <button type="button" data-mode-btn="edit" aria-pressed="false">編集</button>
      </div>
      <div class="m-topbar__group">
        <button type="button" class="hud__title" title="名前を変える"></button>
        <input class="hud__title-input" maxlength="60" aria-label="美術館の名前" hidden />
        <div class="hud__menu-wrap">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm m-btn--icon hud__menu-btn" aria-label="メニュー" aria-haspopup="menu" aria-expanded="false" aria-controls="hud-menu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
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
    <aside class="m-panel m-panel--dark hud__inspector" aria-label="選択中" hidden>
      <h2 class="hud__inspector-label"></h2>
      <input class="hud__inspector-name" maxlength="60" aria-label="作品の名前" />
      ${swatchRow('part')}
      <div class="hud__inspector-actions">
        <button type="button" class="m-btn m-btn--primary m-btn--sm hud__move" title="M">移動</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__rotate" title="R">回転</button>
        <button type="button" class="m-btn m-btn--danger m-btn--sm hud__delete" title="Delete">削除</button>
      </div>
    </aside>
    <aside class="m-panel m-panel--dark hud__library" aria-label="作品" hidden>
      <button type="button" class="m-btn m-btn--primary m-btn--sm hud__upload">＋ ファイルから追加</button>
      <input type="file" class="hud__upload-file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/*,.mp3,.m4a,.wav,.ogg,.glb,.txt,.md,text/plain" hidden />
      <ul class="hud__library-list"></ul>
    </aside>
    <aside class="m-panel m-panel--dark hud__library hud__objects" aria-label="もの" hidden>
      <button type="button" class="m-btn m-btn--primary m-btn--sm hud__upload-object">＋ 3D モデル（.glb）</button>
      <input type="file" class="hud__upload-object-file" accept=".glb,model/gltf-binary" hidden />
      <ul class="hud__library-list hud__objects-list"></ul>
    </aside>
    <aside class="m-panel m-panel--dark hud__style" aria-label="雰囲気" hidden>
      <div class="hud__presets">${PRESETS.map((p, i) => `<button type="button" data-preset="${i}" style="--a:${p.style.wall};--b:${p.style.floor}">${p.label}</button>`).join('')}</div>
      <label>壁</label>${swatchRow('wall')}
      <label>床</label>${swatchRow('floor')}
      <label for="hud-light">明るさ</label><input id="hud-light" type="range" min="0.4" max="1.6" step="0.05" data-style="light" />
      <label for="hud-warmth">光の色</label><input id="hud-warmth" type="range" min="-1" max="1" step="0.05" data-style="warmth" class="hud__warmth" />
    </aside>
    <aside class="m-panel hud__info" aria-labelledby="hud-info-title" hidden>
      <button type="button" class="hud__info-close" aria-label="閉じる（Esc）">✕</button>
      <h2 id="hud-info-title" class="hud__info-title"></h2>
      <p class="m-muted hud__info-meta"></p>
      <p class="hud__info-warning" hidden></p>
      <p class="hud__info-desc"></p>
    </aside>
    <div class="hud__inspect" role="group" aria-label="3D作品を近くで見る">
      <button type="button" class="m-btn m-btn--secondary m-btn--sm m-btn--icon" data-zoom="-0.25" aria-label="寄る">＋</button>
      <button type="button" class="m-btn m-btn--secondary m-btn--sm m-btn--icon" data-zoom="0.25" aria-label="離れる">−</button>
      <button type="button" class="m-btn m-btn--primary m-btn--sm hud__inspect-end">戻る</button>
    </div>
    <div class="move-pad" role="group" aria-label="移動（押している間歩く）">
      ${padButton('forward', '前へ', 'M6 15l6-6 6 6')}
      ${padButton('left', '左へ', 'M15 6l-6 6 6 6')}
      ${padButton('right', '右へ', 'M9 6l6 6-6 6')}
      ${padButton('back', '後ろへ', 'M6 9l6 6 6-6')}
    </div>
    <div class="m-panel m-panel--dark hud__guide" role="status" hidden>
      <p class="hud__guide-text"></p>
      <button type="button" class="m-btn m-btn--primary m-btn--sm hud__guide-ok">OK</button>
    </div>
    <div class="m-toast hud__toast" role="status" aria-live="polite" hidden></div>
  </div>
  <dialog class="help about" aria-labelledby="about-title">
    <form method="dialog" class="help__close"><button class="m-btn m-btn--secondary m-btn--sm m-btn--icon" value="close" aria-label="閉じる">✕</button></form>
    <h2 id="about-title">MUSEUM</h2>
    <p class="about__lead">床と壁を置いて自分の展示室を建て、作品を飾り、その中を歩くブラウザの美術館。</p>
    <ul>
      <li>画像・文章・動画・音・3D・HTML の 6 種類。自分のファイルも飾れる</li>
      <li>HTML 作品は 3D の壁の上でそのまま操作できる（<strong>HTML in Canvas</strong>、Chrome 157 以降。ほかのブラウザはパネルで操作）</li>
      <li>Three.js・TypeScript・Vite の静的サイト。作品と美術館はこのブラウザだけに保存</li>
    </ul>
    <p class="about__links"><a href="assets/CREDITS.md" target="_blank" rel="noopener">素材</a> ・ <a href="THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener">ライセンス</a></p>
  </dialog>
  <dialog class="help" aria-labelledby="help-title">
    <form method="dialog" class="help__close"><button class="m-btn m-btn--secondary m-btn--sm m-btn--icon" value="close" aria-label="閉じる">✕</button></form>
    <h2 id="help-title">ヘルプ</h2>
    <dl>
      <dt>見回す</dt><dd>ドラッグ ・ <kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd></dd>
      <dt>歩く</dt><dd><kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd> ・ <kbd class="m-kbd">Shift</kbd> で速く</dd>
      <dt>作品</dt><dd>クリック（動画・音は再生、3D は回して見る）</dd>
      <dt>編集の道具</dt><dd><kbd class="m-kbd">V</kbd> 選択 ・ <kbd class="m-kbd">F</kbd> 床 ・ <kbd class="m-kbd">G</kbd> 壁 ・ <kbd class="m-kbd">B</kbd> 作品 ・ <kbd class="m-kbd">X</kbd> 削除</dd>
      <dt>選んだもの</dt><dd><kbd class="m-kbd">M</kbd> 移動 ・ <kbd class="m-kbd">Delete</kbd> 削除 ・ <kbd class="m-kbd">Esc</kbd> 解除</dd>
      <dt>保存</dt><dd>自動（このブラウザ）。メニューから書き出し・読み込み</dd>
    </dl>
  </dialog>
</div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const viewport = q<HTMLElement>('#viewport');
  const title = q<HTMLElement>('.title-screen');
  const hud = q<HTMLElement>('.hud');
  const hudTitle = q<HTMLButtonElement>('.hud__title');
  const titleInput = q<HTMLInputElement>('.hud__title-input');
  const modes = q<HTMLElement>('.hud__modes');
  const palette = q<HTMLElement>('.hud__palette');
  const toastEl = q<HTMLElement>('.hud__toast');
  const inspector = q<HTMLElement>('.hud__inspector');
  const info = q<HTMLElement>('.hud__info');
  const library = q<HTMLElement>('.hud__library');
  const mine = q<HTMLElement>('.title-screen__mine');
  let mode: ViewMode = 'view';
  let canRename = false;
  let toastTimer = 0;

  // ---- タイトル画面 ----
  title.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const start = el.closest<HTMLButtonElement>('[data-start]')?.dataset.start;
    if (start === 'new') opts.onNew();
    if (start === 'sample') opts.onSample();
    const open = el.closest<HTMLButtonElement>('[data-museum]')?.dataset.museum;
    if (open) opts.onOpenMuseum(open);
  });
  const about = q<HTMLDialogElement>('.about');
  q<HTMLButtonElement>('.title-screen__about').addEventListener('click', () => about.showModal());

  // ---- 上部バー ----
  q<HTMLButtonElement>('.hud__home').addEventListener('click', () => opts.onHome());
  modes.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode-btn]');
    const next = btn?.dataset.modeBtn as ViewMode | undefined;
    if (next && next !== mode) opts.onModeChange(next);
  });
  // 美術館の名前：押すと入力欄になり、Enter・外側で確定、Esc で取り消し
  const startRename = () => {
    if (!canRename) return;
    titleInput.value = hudTitle.textContent ?? '';
    hudTitle.hidden = true;
    titleInput.hidden = false;
    titleInput.focus();
    titleInput.select();
  };
  const endRename = (commit: boolean) => {
    if (titleInput.hidden) return;
    const v = titleInput.value.trim();
    titleInput.hidden = true;
    hudTitle.hidden = false;
    if (commit && v && v !== hudTitle.textContent) {
      hudTitle.textContent = v;
      opts.onRename(v);
    }
  };
  hudTitle.addEventListener('click', startRename);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') endRename(true);
    if (e.key === 'Escape') {
      e.stopPropagation();
      endRename(false);
    }
  });
  titleInput.addEventListener('blur', () => endRename(true));

  // ---- メニュー ----
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
    if (action === 'import') fileInput.click();
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

  // ---- 編集：道具・選択中・作品ライブラリ ----
  palette.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tool]');
    if (btn && !btn.disabled) opts.onTool(btn.dataset.tool as EditTool);
  });
  q<HTMLButtonElement>('.hud__delete').addEventListener('click', () => opts.onDeleteSelected());
  q<HTMLButtonElement>('.hud__move').addEventListener('click', () => opts.onMoveSelected());
  q<HTMLButtonElement>('.hud__rotate').addEventListener('click', () => opts.onRotateSelected());
  // 色見本（選んだ壁・床、雰囲気の壁・床）
  const onSwatch = (root: HTMLElement, pick: (name: string, color: string) => void) => {
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-color]');
      const row = b?.closest<HTMLElement>('[data-swatches]');
      if (b && row) pick(row.dataset.swatches!, b.dataset.color!);
    });
    root.addEventListener('input', (e) => {
      const inp = e.target as HTMLInputElement;
      const row = inp.closest<HTMLElement>('[data-swatches]');
      if (inp.type === 'color' && row) pick(row.dataset.swatches!, inp.value);
    });
  };
  onSwatch(inspector, (_name, color) => opts.onColorSelected(color));
  const stylePanel = q<HTMLElement>('.hud__style');
  onSwatch(stylePanel, (name, color) => opts.onStyle(name === 'wall' ? { wall: color } : { floor: color }));
  stylePanel.addEventListener('click', (e) => {
    const p = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-preset]');
    if (p) opts.onStyle(PRESETS[Number(p.dataset.preset)].style);
  });
  stylePanel.addEventListener('change', (e) => {
    const inp = e.target as HTMLInputElement;
    if (inp.dataset.style === 'light' || inp.dataset.style === 'warmth') opts.onStyle({ [inp.dataset.style]: Number(inp.value) });
  });
  const objects = q<HTMLElement>('.hud__objects');
  const uploadObject = q<HTMLInputElement>('.hud__upload-object-file');
  q<HTMLButtonElement>('.hud__upload-object').addEventListener('click', () => uploadObject.click());
  uploadObject.addEventListener('change', () => {
    const file = uploadObject.files?.[0];
    uploadObject.value = '';
    if (file) opts.onUploadObject(file);
  });
  const nameInput = q<HTMLInputElement>('.hud__inspector-name');
  nameInput.addEventListener('change', () => nameInput.value.trim() && opts.onRenameSelected(nameInput.value.trim()));
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  const upload = q<HTMLInputElement>('.hud__upload-file');
  q<HTMLButtonElement>('.hud__upload').addEventListener('click', () => upload.click());
  upload.addEventListener('change', () => {
    const file = upload.files?.[0];
    upload.value = '';
    if (file) opts.onUpload(file);
  });
  for (const panel of [library, objects]) panel.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const remove = el.closest<HTMLButtonElement>('[data-remove]');
    if (remove) return opts.onRemoveAsset(remove.dataset.remove!);
    const btn = el.closest<HTMLButtonElement>('[data-asset]');
    if (!btn) return;
    panel.querySelectorAll('[data-asset]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    opts.onPickAsset(btn.dataset.asset!);
  });
  window.addEventListener('keydown', (e) => {
    if (hud.hidden || mode !== 'edit' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.code === 'Delete' || e.code === 'Backspace') {
      if (!inspector.hidden) {
        e.preventDefault();
        opts.onDeleteSelected();
      }
      return;
    }
    if (e.code === 'Escape') return opts.onClearSelection();
    if (e.code === 'KeyM' && !inspector.hidden && !q<HTMLButtonElement>('.hud__move').hidden) return opts.onMoveSelected();
    if (e.code === 'KeyR' && !inspector.hidden && !q<HTMLButtonElement>('.hud__rotate').hidden) return opts.onRotateSelected();
    const t = TOOLS.find((x) => `Key${x.key}` === e.code);
    const btn = t && palette.querySelector<HTMLButtonElement>(`[data-tool="${t.tool}"]`);
    if (t && btn && !btn.disabled) opts.onTool(t.tool);
  });

  // ---- 鑑賞：作品情報・近くで見る ----
  const closeInfo = () => {
    info.hidden = true;
    opts.onInfoClosed();
  };
  q<HTMLButtonElement>('.hud__info-close').addEventListener('click', closeInfo);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !isTyping(e.target) && (!info.hidden || hud.dataset.inspect === 'true')) closeInfo();
  });
  q<HTMLElement>('.hud__inspect').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.zoom) opts.onInspectZoom(Number(btn.dataset.zoom));
    else closeInfo();
  });

  // ---- ヘルプと初回の 1 行 ----
  const help = q<HTMLDialogElement>('.help:not(.about)');
  const openHelp = () => {
    if (!help.open) help.showModal();
  };
  window.addEventListener('keydown', (e) => {
    const isHelpKey = e.key === '?' || (e.code === 'Slash' && e.shiftKey);
    if (!isHelpKey || hud.hidden || isTyping(e.target)) return;
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
  q<HTMLButtonElement>('.hud__guide-ok').addEventListener('click', () => {
    guide.hidden = true;
    try {
      localStorage.setItem(GUIDE_KEY, JSON.stringify([...new Set([...seenGuides(), guideKind])]));
    } catch {
      /* 次回もう一度出るだけ */
    }
  });

  bindMovePad(q<HTMLElement>('.move-pad'), opts.onMove);

  return {
    viewport,
    showTitle({ museums, canCreate, focus }) {
      mine.replaceChildren(
        ...museums.map((m) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.museum = m.id;
          b.textContent = m.title; // textContent：利用者の付けた名前を HTML として扱わない
          li.append(b);
          return li;
        }),
      );
      mine.hidden = museums.length === 0;
      q<HTMLButtonElement>('[data-start="new"]').hidden = !canCreate;
      hud.hidden = true;
      title.hidden = false;
      if (focus) title.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({ preventScroll: true });
    },
    showViewer({ title: museumTitle, mode: next, canEdit, canRename: rename, focus }) {
      mode = next;
      canRename = rename && next === 'edit';
      hudTitle.textContent = museumTitle;
      hudTitle.disabled = !canRename;
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
      objects.hidden = tool !== 'object';
      stylePanel.hidden = tool !== 'style';
      for (const [panel, t] of [[library, 'exhibit'], [objects, 'object']] as const) {
        if (tool !== t) panel.querySelectorAll('[data-asset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      }
      palette.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
      });
    },
    setAvailableTools(tools) {
      palette.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
        b.disabled = !tools.includes(b.dataset.tool as EditTool);
      });
    },
    toast(message) {
      toastEl.textContent = message;
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toastEl.hidden = true), 2600);
    },
    showInspector(next) {
      inspector.hidden = !next;
      if (!next) return;
      q<HTMLElement>('.hud__inspector-label').textContent = next.title;
      q<HTMLElement>('.hud__inspector-label').hidden = next.exhibit;
      nameInput.hidden = !next.exhibit;
      nameInput.value = next.title;
      q<HTMLButtonElement>('.hud__move').hidden = !next.exhibit;
      q<HTMLButtonElement>('.hud__rotate').hidden = !next.rotatable;
      const sw = inspector.querySelector<HTMLElement>('[data-swatches="part"]')!;
      sw.hidden = next.color === undefined;
      sw.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === next.color)));
    },
    showExhibitInfo(next) {
      info.hidden = !next;
      if (!next) return;
      // すべて textContent（作品の文字列を HTML として解釈しない）
      q<HTMLElement>('.hud__info-title').textContent = next.title;
      const meta = q<HTMLElement>('.hud__info-meta');
      meta.textContent = next.meta;
      meta.hidden = !next.meta;
      const warn = q<HTMLElement>('.hud__info-warning');
      warn.textContent = next.warning ?? '';
      warn.hidden = !next.warning;
      const desc = q<HTMLElement>('.hud__info-desc');
      desc.textContent = next.description;
      desc.hidden = !next.description;
    },
    setObjectLibrary(items) {
      fillList(q<HTMLElement>('.hud__objects-list'), items);
    },
    setStyle(st) {
      for (const name of ['wall', 'floor'] as const) {
        const row = stylePanel.querySelector<HTMLElement>(`[data-swatches="${name}"]`)!;
        row.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === st[name])));
        row.querySelector<HTMLInputElement>('input[type=color]')!.value = st[name];
      }
      stylePanel.querySelector<HTMLInputElement>('[data-style="light"]')!.value = String(st.light);
      stylePanel.querySelector<HTMLInputElement>('[data-style="warmth"]')!.value = String(st.warmth);
    },
    setLibrary(items) {
      fillList(q<HTMLElement>('.hud__library:not(.hud__objects) .hud__library-list'), items);
    },
    setInspecting(inspecting) {
      hud.dataset.inspect = String(inspecting);
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
      const text = touch ? GUIDES[kind].touch : GUIDES[kind].pc;
      if (!text || seenGuides().includes(kind)) {
        guide.hidden = true;
        return;
      }
      guideKind = kind;
      q<HTMLElement>('.hud__guide-text').textContent = text;
      guide.hidden = false;
    },
    startRename,
  };
}

/** 作品・置き物の一覧を作る（名前は textContent。自分で追加した物には消すボタン） */
function fillList(list: HTMLElement, items: readonly LibraryItem[]) {
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
      if (it.own) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'hud__library-remove';
        x.dataset.remove = it.id;
        x.setAttribute('aria-label', `「${it.title}」を消す`);
        x.textContent = '✕';
        li.append(x);
      }
      return li;
    }),
  );
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
