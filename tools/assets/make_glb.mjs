// サンプル3D作品「Knot No.3」の GLB を生成する（TMS 51）。外部のモデルは使わず、three.js の形状から作る。
// 使い方: node tools/assets/make_glb.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Node には FileReader が無いので、GLTFExporter が使う分だけ用意する
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const scene = new THREE.Scene();
// 三度ねじれて閉じる結び目（p=3, q=4 のトーラス結び目）。高さ約 1m、底面が y = 0
const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.3, 0.085, 220, 28, 3, 4),
  new THREE.MeshStandardMaterial({ color: '#9a6b4f', metalness: 0.55, roughness: 0.32, name: 'bronze' }),
);
knot.name = 'knot';
knot.rotation.x = Math.PI / 2.6;
knot.updateMatrixWorld();
// 小さな台（作品の一部としての台座。部屋の台座の上に載る）
const base = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.2, 0.06, 48),
  new THREE.MeshStandardMaterial({ color: '#2a2d31', metalness: 0.2, roughness: 0.6, name: 'base' }),
);
base.name = 'base';
const group = new THREE.Group();
group.name = 'Knot No.3';
// 結び目を台の上に載せ、台から結び目の中心まで細い支柱で支える（浮いて見えないように）
const box = new THREE.Box3().setFromObject(knot);
knot.position.y = 0.06 - box.min.y + 0.05;
base.position.y = 0.03;
const centerY = knot.position.y + (box.min.y + box.max.y) / 2;
const rod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.018, centerY - 0.06, 16),
  new THREE.MeshStandardMaterial({ color: '#2a2d31', metalness: 0.5, roughness: 0.4, name: 'rod' }),
);
rod.name = 'rod';
rod.position.y = 0.06 + (centerY - 0.06) / 2;
group.add(knot, base, rod);
scene.add(group);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true });
const out = fileURLToPath(new URL('../../public/assets/models/knot.glb', import.meta.url));
writeFileSync(out, Buffer.from(glb));
const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
console.log(out, Math.round(glb.byteLength / 1024), 'KB', 'size', size.toArray().map((v) => v.toFixed(2)).join(' x '));
