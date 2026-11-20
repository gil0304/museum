// HTML in Canvas (Chrome 157+) の型定義。TypeScript 標準の lib.dom にまだ無いため最小限を宣言する。
// 仕様: https://github.com/WICG/html-in-canvas  / 確認記録: docs/HTML_IN_CANVAS.md

interface ElementImage {
  close(): void;
}

interface ElementImageDefaultSize {
  width: number;
  height: number;
}

interface UpdateElementGeometryOptions {
  preserveHitTestOrder?: boolean;
  canvasClip?: DOMRectInit;
  canvasTransform?: DOMMatrixInit;
}

interface DrawElementImageOptions {
  preserveElementGeometry?: boolean;
}

interface CanvasPaintEvent extends Event {
  readonly changedElements: ReadonlyArray<Element>;
}

interface HTMLCanvasElement {
  onpaint: ((this: HTMLCanvasElement, ev: CanvasPaintEvent) => unknown) | null;
  requestPaint(): void;
  captureElementImage(element: Element): ElementImage;
  updateElementGeometry(element: Element | ElementImage, options?: UpdateElementGeometryOptions): void;
  clearElementGeometry(element: Element | ElementImage): void;
  getElementTransform(element: Element): DOMMatrix;
  getElementImageDefaultSize(element: Element | ElementImage): ElementImageDefaultSize;
}

interface HTMLCanvasElementEventMap {
  paint: CanvasPaintEvent;
}

interface CanvasRenderingContext2D {
  drawElementImage(element: Element | ElementImage, dx: number, dy: number, options?: DrawElementImageOptions): void;
  drawElementImage(
    element: Element | ElementImage,
    dx: number,
    dy: number,
    dwidth: number,
    dheight: number,
    options?: DrawElementImageOptions,
  ): void;
}

interface WebGLCopyElementImageConfig {
  sx?: number;
  sy?: number;
  swidth?: number;
  sheight?: number;
  width?: number;
  height?: number;
}

interface WebGLRenderingContextBase {
  texElementSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    element: Element | ElementImage,
    config?: WebGLCopyElementImageConfig,
  ): void;
}
