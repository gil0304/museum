// HTML作品の公式テンプレート（TMS 53）。アプリに同梱したコードだけで DOM を組み立てる。
// 美術館データ（JSON）からは名前で選ぶだけで、任意の HTML・JS は受け取らない（CLAUDE.md の安全方針）。
// 見た目は src/styles.css の .hic-* 。

export interface HtmlTemplate {
  /** canvas の子に入れる（または代替表示のダイアログに移す）パネル */
  panel: HTMLElement;
  /** 代替表示の案内に出す今の様子（例「拍手 3 回」） */
  summary(): string;
  /** 状態が変わったら呼ぶ（代替表示の案内を描き直す） */
  onChange(cb: () => void): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * 「拍手のカウンター」：押すと数が増えるボタン、リセット、展示室の明るさを変えるスライダー。
 * スライダーを動かすとパネルから `museum:light`（detail = 0〜100）を発行する（main.ts が展示室の照明に反映）。
 */
function clapCounter(): HtmlTemplate {
  const panel = el('div', 'hic-panel');
  panel.setAttribute('drawable', '');
  panel.append(el('div', 'hic-eyebrow', 'INTERACTIVE ・ HTML'), el('h2', 'hic-title', '拍手のカウンター'));
  const count = el('div', 'hic-count', '0');
  count.setAttribute('aria-live', 'polite');
  const row = el('div', 'hic-row');
  const clap = el('button', 'hic-btn hic-btn--primary', '拍手する');
  const reset = el('button', 'hic-btn', 'リセット');
  clap.type = reset.type = 'button';
  row.append(clap, reset);
  const slider = el('div', 'hic-slider');
  const label = el('label');
  const value = el('span', undefined, '50');
  label.append(el('span', undefined, '展示室の明るさ'), value);
  const range = el('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = '50';
  range.id = `hic-light-${Math.random().toString(36).slice(2, 8)}`;
  label.htmlFor = range.id;
  slider.append(label, range);
  panel.append(count, row, slider, el('p', 'hic-note', '3D の壁の上の、本物の HTML です。'));

  let n = 0;
  const listeners: (() => void)[] = [];
  const changed = () => listeners.forEach((f) => f());
  clap.addEventListener('click', () => {
    count.textContent = String(++n);
    changed();
  });
  reset.addEventListener('click', () => {
    n = 0;
    count.textContent = '0';
    changed();
  });
  range.addEventListener('input', () => {
    value.textContent = range.value;
    panel.dispatchEvent(new CustomEvent('museum:light', { detail: Number(range.value), bubbles: true }));
    changed();
  });
  return {
    panel,
    summary: () => `拍手 ${n} 回 ・ 明るさ ${range.value}`,
    onChange: (cb) => listeners.push(cb),
  };
}

const TEMPLATES: Record<string, () => HtmlTemplate> = {
  'clap-counter': clapCounter,
};

/** テンプレート名から作る。知らない名前は null（データに任意の名前が入っていても何も実行しない） */
export function createTemplate(name: string | undefined): HtmlTemplate | null {
  // Object.hasOwn："toString" などの名前でプロトタイプの関数を呼ばないように
  const make = name && Object.hasOwn(TEMPLATES, name) ? TEMPLATES[name] : undefined;
  return make ? make() : null;
}
