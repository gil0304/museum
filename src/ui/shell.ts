// アプリの外枠（DOM）：全面の 3D ビュー、タイトル画面、鑑賞中の上部バーとヒント。
// three.js や scene には依存しない。操作は main.ts から渡されるコールバックで伝える。レイアウトは docs/DESIGN.md。

export type StartKind = 'sample' | 'empty' | 'continue';

export interface ShellOptions {
  /** 体験開始ボタンが押された */
  onStart(kind: StartKind): void;
  /** ロゴが押された（タイトルに戻る） */
  onHome(): void;
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
    <div class="m-hint">ドラッグ：視点回転 ・ スクロール：ズーム</div>
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
