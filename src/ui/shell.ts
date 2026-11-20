// アプリの外枠（ヘッダー・案内・作品情報パネル・フッター）の DOM。three.js や scene には依存しない。
// 3D 側への反映は main.ts から渡されるコールバックで行う。
import type { ExhibitPlacement } from '../types/museum';

export interface ShellOptions {
  /** 作品情報パネルに出す展示物 */
  featured?: ExhibitPlacement;
  /** 「展示の明るさ」スライダーの初期値（0〜100） */
  initialLight: number;
  onLightChange(value: number): void;
}

export interface Shell {
  /** 3D ビューを入れる要素 */
  viewport: HTMLElement;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function mountShell(root: HTMLElement, opts: ShellOptions): Shell {
  const title = escapeHtml(opts.featured?.title ?? '');
  const description = escapeHtml(opts.featured?.description ?? '');
  root.innerHTML = `<main class="shell"><header><div class="brand">MUSEUM <small>LAB / 0.1</small></div><div class="header-note">自分の世界を、美術館にする。</div></header><section class="view"><div id="viewport"></div><div class="overlay"><div class="eyebrow">EARLY PROTOTYPE</div><h1>作品を飾る場所を、<br>自分でつくる。</h1><p>これは初期展示室のプレビューです。<br>HTML in Canvasと建築エディタは次のタスクで実装します。</p><button id="toggle">展示を見る</button></div><div id="detail" class="detail" hidden><span>EXHIBIT / 001</span><h2>${title}</h2><p>${description}</p><label>展示の明るさ <input id="light" type="range" min="0" max="100" value="${opts.initialLight}" /></label></div><div class="hint">ドラッグ：視点回転 ・ スクロール：ズーム</div></section><footer>THREE.JS SCENE  /  HTML IN CANVAS SPIKE PENDING <span>© MUSEUM LAB</span></footer></main>`;

  const viewport = root.querySelector<HTMLElement>('#viewport')!;
  const overlay = root.querySelector<HTMLElement>('.overlay')!;
  const detail = root.querySelector<HTMLElement>('#detail')!;

  root.querySelector<HTMLButtonElement>('#toggle')!.addEventListener('click', () => {
    overlay.classList.toggle('minimized');
    detail.hidden = !detail.hidden;
  });
  root.querySelector<HTMLInputElement>('#light')!.addEventListener('input', (e) => {
    opts.onLightChange(Number((e.target as HTMLInputElement).value));
  });

  return { viewport };
}
