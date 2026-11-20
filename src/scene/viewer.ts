// WebGL レンダラーの生成・サイズ追従・描画ループ。受け取った要素に canvas を入れるだけで、ほかの DOM には触れない。
import * as THREE from 'three';

export interface Viewer {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  dispose(): void;
}

export function createViewer(
  host: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onFrame?: (dt: number) => void,
): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const resize = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resize.observe(host);

  let last = performance.now();
  let running = true;
  function tick(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    onFrame?.(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    renderer,
    canvas: renderer.domElement,
    dispose() {
      running = false;
      resize.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
