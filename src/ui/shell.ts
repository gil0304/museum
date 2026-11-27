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
}

/** 情報パネルに出す選択中のパーツ（TMS 42） */
export interface InspectorInfo {
  /** 例：「壁 10m」 */
  label: string;
  /** 例：「x -5〜5, z -4〜4」 */
  where: string;
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
}

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
      <p class="title-screen__note">PC の Google Chrome 推奨 ・ スマホは鑑賞のみ</p>
    </div>
  </section>
  <div class="hud" hidden data-mode="view">
    <header class="m-topbar">
      <button type="button" class="m-brand hud__home" aria-label="タイトルに戻る">MUSEUM</button>
      <div class="m-segment hud__modes" role="group" aria-label="モード">
        <button type="button" data-mode-btn="view" aria-pressed="true">鑑賞</button>
        <button type="button" data-mode-btn="edit" aria-pressed="false">編集</button>
      </div>
      <div class="m-topbar__group"><span class="hud__title"></span></div>
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
        <button type="button" class="m-btn m-btn--danger m-btn--sm hud__delete">削除（Delete）</button>
        <button type="button" class="m-btn m-btn--secondary m-btn--sm hud__deselect">選択を解除（Esc）</button>
      </div>
    </aside>
    <div class="m-toast hud__toast" role="status" aria-live="polite" hidden></div>
  </div>
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
  q<HTMLButtonElement>('.hud__delete').addEventListener('click', () => opts.onDeleteSelected());
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
