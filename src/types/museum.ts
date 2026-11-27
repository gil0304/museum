// 美術館データの型。描画（scene・exhibits）・画面（ui）・保存（JSON）で共有する。
// 座標系（TMS 44、詳細は docs/EXHIBITS.md）：単位はメートル、Y 軸が上、原点は床の中心。床の上面が y = 0。
// グリッドは 1マス 1m、マスの境目は整数座標。回転 rotationY は Y 軸まわりのラジアンで、0 のとき作品の正面は +Z を向く。

export type Vec3 = [number, number, number];

/** 展示室の寸法の初期値（docs/SUBMISSION_EXPERIENCE.md）。1マス = 1m、最大 12×12マス、壁の高さ 3m */
export const ROOM_GRID = { cell: 1, maxCells: 12, wallHeight: 3 } as const;

/** 作品の種類。object は作品ではない置き物（ベンチ・植物など。台座なし、解説なし） */
export type ExhibitType = 'image' | 'text' | 'video' | 'audio' | 'glb' | 'interactive-html' | 'object';

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

/** 作品の置き方。wall = 壁に掛ける（平面の作品）、floor = 床に置く（台座付きの立体・スクリーンなど） */
export type ExhibitMount = 'wall' | 'floor';

/**
 * 同梱の作品（作品ライブラリの 1 点。TMS 44）。素材は public/assets/ に置き、データからは id で参照する。
 * 任意の URL・HTML は扱わない（JSON を読み込んでも、同梱の素材とテンプレートしか表示しない：CLAUDE.md の安全方針）。
 */
export interface ExhibitAsset {
  id: string;
  type: ExhibitType;
  mount: ExhibitMount;
  title: string;
  author: string;
  year?: string;
  description: string;
  /** 素材のパス（public/ からの相対。例 assets/images/first-light.jpg）。文章・HTML作品は無し */
  src?: string;
  /**
   * 大きさ（m）。wall：作品面の幅×高さ。floor：台座の幅（正方形）×台座の上の作品の高さ
   */
  size: [number, number];
  /** 額縁の外寸（m）。壁の作品で額縁があるとき */
  frameSize?: [number, number];
  /** 文章作品の本文（TMS 48） */
  body?: string;
  /** HTML作品の公式テンプレート名（TMS 53） */
  template?: string;
  /** 素材が読み込めないとき・読み込み中の色 */
  placeholderColor: string;
  /** 利用者がこのブラウザで追加した作品（IndexedDB に保存。src は blob: の URL） */
  own?: boolean;
  /** 置き物（type 'object'）の内蔵の形（bench・plant など）。無ければ src の GLB */
  model?: string;
  /** 置き物の床の上の大きさ（幅×奥行き、m）。当たり判定に使う。walkable なら上を歩ける（ラグ） */
  footprint?: [number, number];
  walkable?: boolean;
}

/**
 * 作品の配置（美術館データに保存するのはこれだけ）。
 * - wall：position は作品の裏面が触れる**壁の表面上の点**（作品の中心の高さ）。rotationY は作品の正面の向き。
 * - floor：position は台座の底の中心（y = 0）。rotationY は作品の正面の向き。
 */
export interface ExhibitPlacement {
  id: string;
  /** 作品ライブラリの id */
  assetId: string;
  /** 読みやすさのための写し（描画はライブラリの type を使う） */
  type: ExhibitType;
  mount: ExhibitMount;
  position: Vec3;
  rotationY: number;
  /** ライブラリのタイトル・解説を上書きしたいとき */
  title?: string;
  description?: string;
}

/**
 * 展示室の雰囲気（色と光）。無ければ既定（明るいギャラリー）。
 * wall・floor は色の付いていない壁・床に使う（パーツごとの color が優先）。
 */
export interface MuseumStyle {
  wall: string;
  floor: string;
  /** 明るさ（0.4〜1.6、1 が既定） */
  light: number;
  /** 光の色（-1 青白い〜 0 自然〜 1 暖かい） */
  warmth: number;
}

export interface MuseumDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  objects: RoomPart[];
  exhibits: ExhibitPlacement[];
  style?: MuseumStyle;
}
