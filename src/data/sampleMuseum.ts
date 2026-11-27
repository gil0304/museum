// サンプル美術館（提出版に同梱する1室、10×8m）。描画にも画面にも依存しない純粋なデータ。
// 床・壁はグリッド（1マス 1m、マスの境目は整数座標）に揃える。壁はマスの境目の上に立つ（TMS 39）。
// 作品は作品ライブラリ（data/library.ts）の id で参照する（TMS 44）。
import type { MuseumDocument } from '../types/museum';

const WALL = '#eeebe5';

export const sampleMuseum: MuseumDocument = {
  schemaVersion: 1,
  id: 'sample-first-light',
  title: 'サンプル美術館',
  objects: [
    { id: 'floor', type: 'floor', position: [0, -0.1, 0], size: [10, 0.2, 8], color: '#b9b2a8' },
    { id: 'wall-back', type: 'wall', position: [0, 1.5, -4], size: [10, 3, 0.2], color: WALL },
    { id: 'wall-left', type: 'wall', position: [-5, 1.5, 0], size: [0.2, 3, 8], color: '#f4f0e9' },
    { id: 'wall-right', type: 'wall', position: [5, 1.5, 0], size: [0.2, 3, 8], color: WALL },
    { id: 'wall-front', type: 'wall', position: [0, 1.5, 4], size: [10, 3, 0.2], color: WALL },
  ],
  // 6種類の作品を歩く順に並べる。入口（手前）から正面に HTML 作品が見える（docs/SUBMISSION_EXPERIENCE.md）。
  // 壁の内面：奥 z = -3.9、左 x = -4.9、右 x = 4.9（壁の中心線 ±0.1）
  exhibits: [
    { id: 'ex-html', assetId: 'html-clap-counter', type: 'interactive-html', mount: 'wall', position: [0.3, 1.5, -3.9], rotationY: 0 },
    { id: 'ex-first-light', assetId: 'image-first-light', type: 'image', mount: 'wall', position: [-2.7, 1.6, -3.9], rotationY: 0 },
    { id: 'ex-tidal', assetId: 'image-tidal-notes', type: 'image', mount: 'wall', position: [3.2, 1.6, -3.9], rotationY: 0 },
    { id: 'ex-text', assetId: 'text-room-notes', type: 'text', mount: 'wall', position: [-4.9, 1.55, -1.3], rotationY: Math.PI / 2 },
    { id: 'ex-video', assetId: 'video-slow-weather', type: 'video', mount: 'wall', position: [-4.9, 1.6, 1.6], rotationY: Math.PI / 2 },
    { id: 'ex-audio', assetId: 'audio-room-tone', type: 'audio', mount: 'wall', position: [4.9, 1.5, 1.5], rotationY: -Math.PI / 2 },
    { id: 'ex-knot', assetId: 'glb-knot', type: 'glb', mount: 'floor', position: [2.7, 0, 0.6], rotationY: -0.4 },
  ],
};
