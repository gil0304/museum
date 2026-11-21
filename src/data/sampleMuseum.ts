// サンプル美術館（提出版に同梱する1室）。描画にも画面にも依存しない純粋なデータ。
// 現在の作品は仮表示（色の板・仮の彫刻）。実際の素材への置き換えは TMS 45〜53・58。
import type { MuseumDocument } from '../types/museum';

const WALL = '#eeebe5';

export const sampleMuseum: MuseumDocument = {
  schemaVersion: 1,
  id: 'sample-first-light',
  title: 'サンプル美術館',
  objects: [
    { id: 'floor', type: 'floor', position: [0, -0.1, 0], size: [9, 0.2, 7], color: '#b9b2a8' },
    { id: 'wall-back', type: 'wall', position: [0, 1.5, -3.5], size: [9, 3, 0.2], color: WALL },
    { id: 'wall-left', type: 'wall', position: [-4.5, 1.5, 0], size: [0.2, 3, 7], color: '#f4f0e9' },
    { id: 'wall-right', type: 'wall', position: [4.5, 1.5, 0], size: [0.2, 3, 7], color: WALL },
    { id: 'wall-front', type: 'wall', position: [0, 1.5, 3.5], size: [9, 3, 0.2], color: WALL },
    { id: 'pedestal-1', type: 'pedestal', position: [2.65, 0.42, 0.7], size: [1.15, 0.85, 1.15], color: WALL },
  ],
  exhibits: [
    {
      id: 'exhibit-001',
      type: 'image',
      position: [-2, 1.6, -3.24],
      size: [2.05, 1.54],
      frameSize: [2.3, 1.8],
      title: 'First Light',
      description: 'デモ展示：HTMLは現在通常DOMとして表示しています。',
      placeholderColor: '#517e87',
    },
    {
      id: 'exhibit-002',
      type: 'image',
      position: [1.35, 1.7, -3.23],
      size: [1.54, 1.24],
      frameSize: [1.8, 1.5],
      placeholderColor: '#d3a575',
    },
    {
      id: 'exhibit-003',
      type: 'glb',
      position: [2.65, 1.28, 0.7],
      placeholderColor: '#9a8273',
    },
  ],
};
