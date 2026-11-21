// 「空の部屋から作る」の初期状態：床と四方の壁だけの1室（作品なし）。中を歩いて見回すので壁で閉じる（TMS 36）。
import type { MuseumDocument } from '../types/museum';

const WALL = '#eeebe5';

export const emptyRoom: MuseumDocument = {
  schemaVersion: 1,
  id: 'empty-room',
  title: '新しい展示室',
  objects: [
    { id: 'floor', type: 'floor', position: [0, -0.1, 0], size: [9, 0.2, 7], color: '#b9b2a8' },
    { id: 'wall-back', type: 'wall', position: [0, 1.5, -3.5], size: [9, 3, 0.2], color: WALL },
    { id: 'wall-left', type: 'wall', position: [-4.5, 1.5, 0], size: [0.2, 3, 7], color: '#f4f0e9' },
    { id: 'wall-right', type: 'wall', position: [4.5, 1.5, 0], size: [0.2, 3, 7], color: WALL },
    { id: 'wall-front', type: 'wall', position: [0, 1.5, 3.5], size: [9, 3, 0.2], color: WALL },
  ],
  exhibits: [],
};
