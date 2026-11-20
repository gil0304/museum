// HTML in Canvas スパイク 02：canvas に描いた実DOMのボタンがクリックを受け取れるか（TMS 24）。
// 結果は画面の #status と window.__hic、console（[HIC] 接頭辞）に出す。

type ClickLog = { target: string; trusted: boolean; x: number; y: number };
type Result = {
  supported: boolean;
  paintEvents: number;
  applauseClicks: number;
  resetClicks: number;
  canvasOnlyClicks: number; // パネル外（canvas の背景）でのクリック
  lastClick?: ClickLog;
  renderedCount?: string; // 最後の paint 時点でパネル内に表示されていた数字
  hoverSeen: boolean;
  focusSeen: boolean;
  // TMS 25：スライダー
  sliderInputEvents: number;
  sliderValue: number; // DOM の値
  renderedSliderLabel?: string; // 最後の paint 時点でパネル内に表示されていた数値
  lampPixel?: number[]; // canvas 上でサンプルした色見本の色
  lampExpected?: number; // 値から計算した期待の明るさ
  lampMatches?: boolean;
  error?: string;
};

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
const countEl = document.querySelector<HTMLElement>('#count')!;
const applause = document.querySelector<HTMLButtonElement>('#applause')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const light = document.querySelector<HTMLInputElement>('#light')!;
const lightValue = document.querySelector<HTMLElement>('#lightValue')!;
const lamp = document.querySelector<HTMLElement>('#lamp')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const ctx = canvas.getContext('2d')!;

const PANEL_X = 48; // CSS px
const PANEL_Y = 40;

const result: Result = {
  supported:
    'drawElementImage' in CanvasRenderingContext2D.prototype && 'requestPaint' in HTMLCanvasElement.prototype,
  paintEvents: 0,
  applauseClicks: 0,
  resetClicks: 0,
  canvasOnlyClicks: 0,
  hoverSeen: false,
  focusSeen: false,
  sliderInputEvents: 0,
  sliderValue: Number(light.value),
};
(window as unknown as { __hic: Result }).__hic = result;

let count = 0;
const ok = (b: boolean, yes: string, no: string) => (b ? `<span class="ok">${yes}</span>` : `<span class="ng">${no}</span>`);

function render() {
  statusEl.innerHTML = [
    `HTML in Canvas API : ${ok(result.supported, 'あり', 'なし')}`,
    `paint イベント回数 : ${result.paintEvents}`,
    `「拍手する」click  : ${result.applauseClicks}`,
    `「リセット」click  : ${result.resetClicks}`,
    `パネル外の click   : ${result.canvasOnlyClicks}（canvas 本体に届いた数）`,
    `最後の click       : ${result.lastClick ? `${result.lastClick.target} / isTrusted=${result.lastClick.trusted} / (${result.lastClick.x}, ${result.lastClick.y})` : '-'}`,
    `canvas 上の表示    : ${result.renderedCount ?? '-'}（DOM の値 ${count}）${result.renderedCount === String(count) ? ' <span class="ok">一致</span>' : ''}`,
    `hover / focus      : ${ok(result.hoverSeen, 'hover あり', 'hover なし')} / ${ok(result.focusSeen, 'focus あり', 'focus なし')}`,
    `スライダー input   : ${result.sliderInputEvents} 回 / DOM の値 ${result.sliderValue} / canvas 上の表示 ${result.renderedSliderLabel ?? '-'}${result.renderedSliderLabel === String(result.sliderValue) ? ' <span class="ok">一致</span>' : ''}`,
    `色見本のピクセル   : ${result.lampPixel ? `rgb(${result.lampPixel.slice(0, 3).join(',')}) / 期待 ${result.lampExpected}` : '-'} ${result.lampMatches === undefined ? '' : ok(result.lampMatches, '一致', '不一致')}`,
    result.error ? `エラー             : <span class="ng">${result.error}</span>` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

function paint() {
  result.paintEvents++;
  const dpr = window.devicePixelRatio;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  try {
    ctx.reset();
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1d2226');
    g.addColorStop(1, '#3a3127');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a86a';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ここ（パネル外）をクリックしても、ボタンは反応しない', w - 16, h - 16);
    // 要素画像は canvas の実ピクセル基準（docs/HTML_IN_CANVAS.md）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawElementImage(panel, PANEL_X * dpr, PANEL_Y * dpr);
    ctx.restore();
    result.renderedCount = countEl.textContent ?? '';
    result.renderedSliderLabel = lightValue.textContent ?? '';
    // 色見本（#lamp）の中央を canvas 上でサンプルし、スライダーの値どおりの明るさで描かれたか確かめる
    const lx = (PANEL_X + lamp.offsetLeft + lamp.offsetWidth / 2) * dpr;
    const ly = (PANEL_Y + lamp.offsetTop + lamp.offsetHeight / 2) * dpr;
    const px = Array.from(ctx.getImageData(Math.round(lx), Math.round(ly), 1, 1).data);
    result.lampPixel = px;
    result.lampExpected = lampLevel(Number(lightValue.textContent));
    result.lampMatches = px.slice(0, 3).every((c) => Math.abs(c - result.lampExpected!) <= 3);
    result.error = undefined;
  } catch (e) {
    result.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  render();
}

function logClick(name: string, e: MouseEvent) {
  result.lastClick = { target: name, trusted: e.isTrusted, x: e.clientX, y: e.clientY };
  console.log('[HIC] click', name, JSON.stringify(result.lastClick));
}

// スライダー値 0〜100 → 色見本のグレー 20〜250
function lampLevel(v: number) {
  return Math.round(20 + (v / 100) * 230);
}
function applyLight() {
  const v = Number(light.value);
  result.sliderValue = v;
  lightValue.textContent = String(v);
  const c = lampLevel(v);
  lamp.style.background = `rgb(${c}, ${c}, ${c})`;
}
light.addEventListener('input', () => {
  result.sliderInputEvents++;
  applyLight(); // DOM 変更 → paint で再描画されるはず
  render();
});
applyLight();

applause.addEventListener('click', (e) => {
  result.applauseClicks++;
  count++;
  countEl.textContent = String(count); // DOM 変更 → 次のフレームで paint が発火するはず
  logClick('applause', e);
  render();
});
reset.addEventListener('click', (e) => {
  result.resetClicks++;
  count = 0;
  countEl.textContent = '0';
  logClick('reset', e);
  render();
});
canvas.addEventListener('click', (e) => {
  if (e.target === canvas) {
    result.canvasOnlyClicks++;
    logClick('canvas', e);
    render();
  }
});
applause.addEventListener('pointerenter', () => {
  result.hoverSeen = true;
  render();
});
for (const b of [applause, reset]) {
  b.addEventListener('focus', () => {
    result.focusSeen = true;
    render();
  });
}

if (result.supported) {
  resizeCanvas();
  canvas.onpaint = paint;
  canvas.requestPaint();
  new ResizeObserver(() => {
    resizeCanvas();
    canvas.requestPaint();
  }).observe(canvas);
} else {
  canvas.after(panel);
  panel.style.marginTop = '12px';
}
render();

export {}; // モジュールとして扱い、他のスパイクと変数名が衝突しないようにする
