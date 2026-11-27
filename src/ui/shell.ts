// アプリの外枠（DOM）：全面の 3D ビュー、タイトル画面、鑑賞中の上部バーとヒント。
// three.js や scene には依存しない。操作は main.ts から渡されるコールバックで伝える。レイアウトは docs/DESIGN.md。

export type StartKind = 'sample' | 'empty' | 'continue';

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
}

export interface Shell {
  /** 3D ビューを入れる要素 */
  viewport: HTMLElement;
  /** focus: 鑑賞から戻ったときは主ボタンにフォーカスを移す（最初の表示では移さない） */
  showTitle(opts: { canContinue: boolean; focus: boolean }): void;
  /** focus: タイトルから入ったときはロゴにフォーカスを移す（URL から直接開いたときは移さない） */
  showViewer(opts: { title: string; focus: boolean }): void;
}

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
  <div class="hud" hidden>
    <header class="m-topbar">
      <button type="button" class="m-brand hud__home" aria-label="タイトルに戻る">MUSEUM</button>
      <div class="m-segment" role="group" aria-label="モード">
        <button type="button" aria-pressed="true">鑑賞</button>
        <button type="button" aria-pressed="false" disabled title="準備中">編集</button>
      </div>
      <div class="m-topbar__group"><span class="hud__title"></span></div>
    </header>
    <div class="m-hint">
      ドラッグ：見回す<span class="hud__keys"> ・ <kbd class="m-kbd">W</kbd><kbd class="m-kbd">A</kbd><kbd class="m-kbd">S</kbd><kbd class="m-kbd">D</kbd> / 矢印：歩く ・ <kbd class="m-kbd">Shift</kbd>：速く ・ <kbd class="m-kbd">Q</kbd><kbd class="m-kbd">E</kbd>：向きを変える</span><span class="hud__touch"> ・ 右下のボタン：歩く</span>
    </div>
    <div class="move-pad" role="group" aria-label="移動（押している間歩く）">
      ${padButton('forward', '前へ', 'M6 15l6-6 6 6')}
      ${padButton('left', '左へ', 'M15 6l-6 6 6 6')}
      ${padButton('right', '右へ', 'M9 6l6 6-6 6')}
      ${padButton('back', '後ろへ', 'M6 9l6 6 6-6')}
    </div>
  </div>
</div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const viewport = q<HTMLElement>('#viewport');
  const title = q<HTMLElement>('.title-screen');
  const hud = q<HTMLElement>('.hud');
  const hudTitle = q<HTMLElement>('.hud__title');
  const continueBtn = q<HTMLButtonElement>('[data-start="continue"]');
  const primaryBtn = q<HTMLButtonElement>('[data-start="sample"]');

  title.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-start]');
    if (btn) opts.onStart(btn.dataset.start as StartKind);
  });
  q<HTMLButtonElement>('.hud__home').addEventListener('click', () => opts.onHome());
  bindMovePad(q<HTMLElement>('.move-pad'), opts.onMove);

  return {
    viewport,
    showTitle({ canContinue, focus }) {
      continueBtn.hidden = !canContinue;
      hud.hidden = true;
      title.hidden = false;
      if (focus) primaryBtn.focus({ preventScroll: true });
    },
    showViewer({ title: museumTitle, focus }) {
      hudTitle.textContent = museumTitle; // textContent なので HTML として解釈されない
      title.hidden = true;
      hud.hidden = false;
      if (focus) q<HTMLButtonElement>('.hud__home').focus({ preventScroll: true });
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
