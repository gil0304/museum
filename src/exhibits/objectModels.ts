// 内蔵の置き物の形（ベンチ・植物・柱・低い台・ランプ・ラグ）。three.js の基本の形だけで作る（外部の素材は使わない）。
// 原点は床の上の中心（y = 0）。正面は +Z。大きさは実寸（m）。
import * as THREE from 'three';

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const MODELS: Record<string, () => THREE.Group> = {
  bench() {
    const g = new THREE.Group();
    const wood = mat('#8a6a4a', { roughness: 0.65 });
    const metal = mat('#2a2d31', { metalness: 0.4, roughness: 0.5 });
    g.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 0.45), wood, 0, 0.45, 0));
    for (const x of [-0.68, 0.68]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.42, 0.4), metal, x, 0.21, 0));
    return g;
  },
  plant() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 24), mat('#d9d1c3'), 0, 0.21, 0));
    const leaf = mat('#5f7f5a', { roughness: 0.9 });
    const leaves: [number, number, number, number][] = [
      [0, 0.85, 0, 0.32],
      [0.14, 1.12, 0.05, 0.24],
      [-0.12, 1.05, -0.08, 0.22],
      [0.02, 1.3, -0.02, 0.18],
    ];
    for (const [x, y, z, r] of leaves) g.add(mesh(new THREE.IcosahedronGeometry(r, 1), leaf, x, y, z));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 8), mat('#6b5236'), 0, 0.6, 0));
    return g;
  },
  column() {
    const g = new THREE.Group();
    const white = mat('#eeebe5', { roughness: 0.6 });
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), white, 0, 0.06, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.19, 0.21, 2.76, 32), white, 0, 1.5, 0));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), white, 0, 2.94, 0));
    return g;
  },
  plinth() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), mat('#e4ded3', { roughness: 0.7 }), 0, 0.2, 0));
    return g;
  },
  lamp() {
    const g = new THREE.Group();
    const metal = mat('#2a2d31', { metalness: 0.5, roughness: 0.4 });
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 32), metal, 0, 0.015, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.35, 8), metal, 0, 0.7, 0));
    // 笠は内側から光って見える（照明は増やさず、材質だけ光らせる）
    const shade = mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.26, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#f4e6cc', emissive: '#ffd59a', emissiveIntensity: 0.9, side: THREE.DoubleSide }),
      0,
      1.47,
      0,
    );
    shade.castShadow = false;
    g.add(shade);
    return g;
  },
  rug() {
    const g = new THREE.Group();
    const r = mesh(new THREE.BoxGeometry(2.4, 0.012, 1.6), mat('#7a4a3a', { roughness: 1 }), 0, 0.006, 0);
    r.castShadow = false;
    g.add(r);
    const border = mesh(new THREE.BoxGeometry(2.2, 0.014, 1.4), mat('#a3684f', { roughness: 1 }), 0, 0.007, 0);
    border.castShadow = false;
    g.add(border);
    return g;
  },
};

/** 内蔵の置き物を作る。知らない名前なら null */
export function buildObjectModel(name: string | undefined): THREE.Group | null {
  return name && Object.hasOwn(MODELS, name) ? MODELS[name]() : null;
}
