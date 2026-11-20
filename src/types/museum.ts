// 美術館データの型。描画（scene）・画面（ui）・保存（JSON）で共有する。
// 座標はメートル単位、Y軸が上。原点は部屋の床の中心。
// 作品の共通データ型と座標系の正式な定義は TMS 44 で行う（ここは提出版に向けた土台）。

export type Vec3 = [number, number, number];

/** 展示室の寸法の初期値（docs/SUBMISSION_EXPERIENCE.md）。1マス = 1m、最大 12×12マス、壁の高さ 3m */
export const ROOM_GRID = { cell: 1, maxCells: 12, wallHeight: 3 } as const;

export type ExhibitType = 'image' | 'text' | 'video' | 'audio' | 'glb' | 'interactive-html';

/**
 * 建築パーツ（床・壁・展示台）。position は箱の中心、size は幅・高さ・奥行き。
 * 天井はパーツに含めない（編集の対象外。床と壁の範囲から描画側が自動で張る。TMS 34）。
 */
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
