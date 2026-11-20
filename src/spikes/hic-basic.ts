// HTML in Canvas スパイク 01：実DOMを 2D canvas に描画できるかを確認する最小ページ（TMS 23）。
// 結果は画面の #status と window.__hic、console（[HIC] 接頭辞）に出す。

type Result = {
  supported: boolean;
  paintEvents: number;
  drawn: boolean;
  pixelCheck: 'pending' | 'ok' | 'ng';
  pixel?: number[];
  defaultSize?: ElementImageDefaultSize;
  dpr: number;
  error?: string;
  userAgent: string;
};

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const ctx = canvas.getContext('2d')!;

const PANEL_X = 48; // CSS px
const PANEL_Y = 40;

const result: Result = {
  supported:
    'drawElementImage' in CanvasRenderingContext2D.prototype && 'requestPaint' in HTMLCanvasElement.prototype,
  paintEvents: 0,
  drawn: false,
  pixelCheck: 'pending',
  dpr: window.devicePixelRatio,
  userAgent: navigator.userAgent,
};
(window as unknown as { __hic: Result }).__hic = result;

function render() {
  const lines = [
    `HTML in Canvas API : ${result.supported ? '<span class="ok">あり</span>' : '<span class="ng">なし（このブラウザは非対応）</span>'}`,
    `paint イベント回数 : ${result.paintEvents}`,
    `drawElementImage  : ${result.drawn ? '<span class="ok">成功</span>' : result.error ? '<span class="ng">失敗</span>' : '未実行'}`,
    `ピクセル判定       : ${result.pixelCheck === 'ok' ? '<span class="ok">パネルの赤帯を canvas 上で検出</span>' : result.pixelCheck === 'ng' ? '<span class="ng">検出できず</span>' : '待機中'}${result.pixel ? ` rgba(${result.pixel.join(',')})` : ''}`,
    `要素の既定サイズ   : ${result.defaultSize ? `${result.defaultSize.width} x ${result.defaultSize.height}` : '-'}`,
    `devicePixelRatio   : ${result.dpr}`,
    result.error ? `エラー             : <span class="ng">${result.error}</span>` : '',
    `UA                 : ${result.userAgent}`,
  ];
  statusEl.innerHTML = lines.filter(Boolean).join('\n');
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  result.dpr = dpr;
}

function drawBackdrop(w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1d2226');
  g.addColorStop(1, '#3a3127');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X - 12, PANEL_Y - 12, 344, 0); // 上の装飾線
  ctx.fillStyle = '#c9a86a';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('CANVAS 2D  ·  drawn by canvas commands', 16, h - 16);
}

function paint() {
  result.paintEvents++;
  const dpr = window.devicePixelRatio;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  try {
    ctx.reset();
    ctx.scale(dpr, dpr);
    drawBackdrop(w, h);
    // 要素画像の既定サイズは canvas の実ピクセル（CSS px × dpr）基準なので、
    // ctx.scale(dpr) を重ねると2倍になる。描画時だけ変換を外し、実ピクセル座標で描く。
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawElementImage(panel, PANEL_X * dpr, PANEL_Y * dpr);
    ctx.restore();
    result.drawn = true;
    result.error = undefined;
    result.defaultSize = canvas.getElementImageDefaultSize(panel);

    // パネル下部の赤帯（.swatch）が canvas 上に描かれたかを確認する
    const swatch = panel.querySelector<HTMLElement>('.swatch')!;
    const sx = PANEL_X + swatch.offsetLeft + swatch.offsetWidth / 2;
    const sy = PANEL_Y + swatch.offsetTop + swatch.offsetHeight / 2;
    const px = Array.from(ctx.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data);
    result.pixel = px;
    result.pixelCheck = px[0] > 150 && px[1] < 90 && px[2] < 90 && px[3] > 200 ? 'ok' : 'ng';
  } catch (e) {
    result.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  console.log('[HIC] paint', JSON.stringify(result));
  render();
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
  // 非対応ブラウザ：canvas の子要素は表示されないので、パネルを canvas の外に出して通常DOMで見せる
  canvas.after(panel);
  panel.style.marginTop = '12px';
  console.log('[HIC] unsupported', navigator.userAgent);
}
render();

export {}; // モジュールとして扱い、他のスパイクと変数名が衝突しないようにする
