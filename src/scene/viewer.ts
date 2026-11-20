// WebGL レンダラーの生成・サイズ追従・描画ループ。受け取った要素に canvas を入れるだけで、ほかの DOM には触れない。
import * as THREE from 'three';

export interface Viewer {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  /** 表示するシーンとカメラを差し替える（美術館の切り替え） */
  setScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

/** onFrame(dt, t): dt は前フレームからの秒数（上限 0.05）、t は開始からの秒数 */
export function createViewer(
  host: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onFrame?: (dt: number, t: number) => void,
): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  let current = { scene, camera };

  function fitCamera() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    current.camera.aspect = w / h;
    current.camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const resize = new ResizeObserver(fitCamera);
  resize.observe(host);

  const start = performance.now();
  let last = start;
  let running = true;
  function tick(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    onFrame?.(dt, (now - start) / 1000);
    renderer.render(current.scene, current.camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    renderer,
    canvas: renderer.domElement,
    setScene(scene, camera) {
      current = { scene, camera };
      fitCamera();
    },
    dispose() {
      running = false;
      resize.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
