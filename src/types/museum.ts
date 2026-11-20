// 美術館データの型。描画（scene）・画面（ui）・保存（JSON）で共有する。
// 座標はメートル単位、Y軸が上。原点は部屋の床の中心。
// 作品の共通データ型と座標系の正式な定義は TMS 44 で行う（ここは提出版に向けた土台）。

export type Vec3 = [number, number, number];

export type ExhibitType = 'image' | 'text' | 'video' | 'audio' | 'glb' | 'interactive-html';

/** 建築パーツ（床・壁・展示台）。position は箱の中心、size は幅・高さ・奥行き */
export interface RoomPart {
  id: string;
  type: 'floor' | 'wall' | 'pedestal';
  position: Vec3;
  size: Vec3;
  color?: string;
}

/** 展示物の配置 */
export interface ExhibitPlacement {
  id: string;
  type: ExhibitType;
  /** 作品の中心 */
  position: Vec3;
  /** Y軸まわりの回転（ラジアン） */
  rotationY?: number;
  /** 平面作品の幅・高さ（m） */
  size?: [number, number];
  /** 額縁の外寸（m）。なければ額縁なし */
  frameSize?: [number, number];
  title?: string;
  description?: string;
  /** 同梱素材のID（TMS 45〜53 で使う） */
  assetId?: string;
  /** 素材が入るまでの仮表示の色 */
  placeholderColor?: string;
}

export interface MuseumDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  objects: RoomPart[];
  exhibits: ExhibitPlacement[];
}
