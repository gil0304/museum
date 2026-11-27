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

const byId = new Map(LIBRARY.map((a) => [a.id, a]));

/** id から作品を引く。無い id（壊れた JSON など）は undefined */
export function findAsset(id: string): ExhibitAsset | undefined {
  return byId.get(id);
}
