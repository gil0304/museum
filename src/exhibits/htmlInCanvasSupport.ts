// HTML in Canvas（Chrome 157+）が3D表示で使えるかの判定。
// 使えない場合は「3D内に案内表示 → クリックで通常DOMのパネルを開く」代替表示にする（docs/HTML_IN_CANVAS.md）。

export type HtmlInCanvasMode = 'html-in-canvas' | 'dom-fallback';

/** WebGL（Three.js）で HTML 作品を描画・操作するのに必要な API がそろっているか */
export function supportsHtmlInCanvas3D(): boolean {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    'requestPaint' in HTMLCanvasElement.prototype &&
    'updateElementGeometry' in HTMLCanvasElement.prototype &&
    'clearElementGeometry' in HTMLCanvasElement.prototype &&
    'getElementImageDefaultSize' in HTMLCanvasElement.prototype &&
    typeof WebGL2RenderingContext !== 'undefined' &&
    'texElementSubImage2D' in WebGL2RenderingContext.prototype
  );
}

/**
 * 表示方式を決める。URL に `?fallback=1` があれば、対応ブラウザでも代替表示を強制する
 * （非対応ブラウザでの見え方を Chrome で確認するため）。
 */
export function detectHtmlInCanvasMode(search: string = location.search): HtmlInCanvasMode {
  if (new URLSearchParams(search).get('fallback') === '1') return 'dom-fallback';
  return supportsHtmlInCanvas3D() ? 'html-in-canvas' : 'dom-fallback';
}
