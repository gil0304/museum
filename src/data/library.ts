// 作品ライブラリ（同梱のサンプル作品。TMS 44）。編集モードの「作品」から選んで置く。
// 素材（public/assets/）はすべてこのアプリのために新しく作ったもの（著作権の確認は TMS 68、一覧は public/assets/CREDITS.md）。
// 任意の URL・HTML は扱わない。美術館データ（JSON）からは id でしか参照できない。
import type { ExhibitAsset } from '../types/museum';

export const LIBRARY: readonly ExhibitAsset[] = [
  {
    id: 'image-first-light',
    type: 'image',
    mount: 'wall',
    title: 'First Light',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: '夜明けの数分間、空の色が入れ替わっていく境目を、重なる色の帯で描いた抽象画。',
    src: 'assets/images/first-light.jpg',
    size: [1.6, 1.2],
    frameSize: [1.8, 1.4],
    placeholderColor: '#517e87',
  },
  {
    id: 'image-tidal-notes',
    type: 'image',
    mount: 'wall',
    title: 'Tidal Notes',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: '潮が満ちて引くリズムを、等間隔の円と線の揺らぎで記録した図。',
    src: 'assets/images/tidal-notes.jpg',
    size: [1.1, 1.4],
    frameSize: [1.28, 1.58],
    placeholderColor: '#d3a575',
  },
  {
    id: 'text-room-notes',
    type: 'text',
    mount: 'wall',
    title: '展示室のための覚え書き',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: '文章も作品として壁に掛けられる。読む速さで、部屋の中を歩いてほしい。',
    body:
      '部屋は、置かれたものの順番でできている。\n\n' +
      '壁を一枚足すと、見える景色が一つ減り、立ち止まる理由が一つ増える。\n\n' +
      'ここにあるのは、絵と、文章と、映像と、音と、立体と、触れる作品。' +
      'どれも同じ光の下で、同じ床の上に並んでいる。\n\n' +
      'あなたの世界も、こうして部屋にできる。',
    size: [1.2, 1.5],
    frameSize: [1.24, 1.54], // 紙の色が壁に溶けないよう、細い縁を付ける
    placeholderColor: '#f4efe6',
  },
  {
    id: 'video-slow-weather',
    type: 'video',
    mount: 'wall',
    title: 'Slow Weather',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: 'ゆっくり形を変える雲のような色の流れ（12 秒でひと巡り、音は無し）。スクリーンをクリックすると一時停止・再生。',
    src: 'assets/video/slow-weather.mp4',
    size: [1.6, 0.9],
    frameSize: [1.7, 1.0], // スクリーンの縁
    placeholderColor: '#2a3b45',
  },
  {
    id: 'audio-room-tone',
    type: 'audio',
    mount: 'wall',
    title: 'Room Tone',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: '展示室のために作った、静かに重なる和音。クリックで再生・停止。',
    src: 'assets/audio/room-tone.mp3',
    size: [0.8, 0.8],
    placeholderColor: '#3b3530',
  },
  {
    id: 'glb-knot',
    type: 'glb',
    mount: 'floor',
    title: 'Knot No.3',
    author: 'MUSEUM サンプル作品',
    year: '2026',
    description: '一本の線が三度ねじれて閉じる立体。クリックすると近くで回して見られる。',
    src: 'assets/models/knot.glb',
    size: [0.9, 1.0],
    placeholderColor: '#9a8273',
  },
  {
    id: 'html-clap-counter',
    type: 'interactive-html',
    mount: 'wall',
    title: '拍手のカウンター',
    author: 'MUSEUM 公式テンプレート',
    year: '2026',
    description: '3D の壁の上で、本物の HTML のボタンとスライダーをそのまま押せる作品（HTML in Canvas）。',
    template: 'clap-counter',
    size: [1.3, 1.0],
    placeholderColor: '#f4efe6',
  },
];

/**
 * 内蔵の置き物（作品ではない物）。形は exhibits/objectModels.ts が three.js で作る（外部の素材は使わない）。
 * size：[床の上の大きさの長いほう, 高さ]、footprint：当たり判定の幅×奥行き
 */
export const OBJECTS: readonly ExhibitAsset[] = [
  { id: 'obj-bench', type: 'object', mount: 'floor', model: 'bench', title: 'ベンチ', author: '', description: '', size: [1.6, 0.45], footprint: [1.6, 0.5], placeholderColor: '#8a6a4a' },
  { id: 'obj-plant', type: 'object', mount: 'floor', model: 'plant', title: '植物', author: '', description: '', size: [0.6, 1.4], footprint: [0.5, 0.5], placeholderColor: '#5f7f5a' },
  { id: 'obj-column', type: 'object', mount: 'floor', model: 'column', title: '柱', author: '', description: '', size: [0.5, 3], footprint: [0.5, 0.5], placeholderColor: '#eeebe5' },
  { id: 'obj-plinth', type: 'object', mount: 'floor', model: 'plinth', title: '低い台', author: '', description: '', size: [1.2, 0.4], footprint: [1.2, 0.8], placeholderColor: '#e4ded3' },
  { id: 'obj-lamp', type: 'object', mount: 'floor', model: 'lamp', title: 'ランプ', author: '', description: '', size: [0.4, 1.6], footprint: [0.4, 0.4], placeholderColor: '#2a2d31' },
  { id: 'obj-rug', type: 'object', mount: 'floor', model: 'rug', title: 'ラグ', author: '', description: '', size: [2.4, 0.02], footprint: [2.4, 1.6], walkable: true, placeholderColor: '#7a4a3a' },
];

const byId = new Map([...LIBRARY, ...OBJECTS].map((a) => [a.id, a]));

// 利用者がこのブラウザで追加した作品（storage/userAssets.ts が起動時に登録する）
const ownAssets = new Map<string, ExhibitAsset>();

export function registerOwnAsset(asset: ExhibitAsset) {
  ownAssets.set(asset.id, { ...asset, own: true });
}
export function unregisterOwnAsset(id: string) {
  ownAssets.delete(id);
}
/** 作品の一覧（自分の作品を先に） */
export function allAssets(): ExhibitAsset[] {
  return [...[...ownAssets.values()].filter((a) => a.type !== 'object'), ...LIBRARY];
}
/** 置き物の一覧（自分で追加した 3D モデルを先に） */
export function allObjects(): ExhibitAsset[] {
  return [...[...ownAssets.values()].filter((a) => a.type === 'object'), ...OBJECTS];
}

/** id から作品を引く。無い id（壊れた JSON・別の端末で追加した作品など）は undefined */
export function findAsset(id: string): ExhibitAsset | undefined {
  return byId.get(id) ?? ownAssets.get(id);
}
