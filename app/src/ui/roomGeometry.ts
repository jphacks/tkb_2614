/** タップで選べる部屋のスポット。 */
export type SpotId = 'window' | 'bed' | 'shelf';

export const SPOT_IDS: readonly SpotId[] = ['window', 'bed', 'shelf'];

export interface Point { readonly x: number; readonly y: number }
export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

// 座標はすべて Figma「アプリデザイン」> Room 案A > 「A / Room (default)」フレーム（402×874）の座標系。
// SVG もこのフレームから書き出したので、パスの座標と同じ単位で扱える。
// react-native に依存させず、node のテストから読めるようにしている。

/**
 * 画面に収める範囲。絵の外形（x 33〜369, y 274〜601）に、
 * アンカーに置くキャラ・カビがはみ出す分の余白を足している。
 */
export const ROOM_VIEW: Rect = { x: 17, y: 258, width: 368, height: 360 };

/**
 * キャラ・カビを置く位置（Figma の overlay/mold-anchors の赤丸の中心）。
 * 赤丸は 28×28 で、Figma 上の左上座標に +14 した値。並びは mold/<spot>/0, /1 の順。
 * - window/0: 窓の左下（窓枠と窓台の間）   left 201.4, top 362.95
 * - window/1: 窓の右下（窓台の右端）       left 251,   top 387.75
 * - bed/0:    ヘッドボードの左             left 31.8,  top 460.4
 * - bed/1:    ベッドの手前（足元の下）     left 87.8,  top 516.55
 * - shelf/0:  棚の右側面                   left 343,   top 463
 * - shelf/1:  棚の天板の上                 left 318.2, top 368.1
 */
export const SPOT_ANCHORS: Record<SpotId, readonly [Point, Point]> = {
  window: [{ x: 215.4, y: 376.95 }, { x: 265, y: 401.75 }],
  bed: [{ x: 45.8, y: 474.4 }, { x: 101.8, y: 530.55 }],
  shelf: [{ x: 357, y: 477 }, { x: 332.2, y: 382.1 }],
};

/** タップ領域（Figma の overlay/hit-areas。角丸 12 の矩形）。 */
export const SPOT_HIT_AREAS: Record<SpotId, Rect> = {
  window: { x: 191, y: 295, width: 91, height: 133 },
  bed: { x: 43, y: 415, width: 166, height: 145 },
  shelf: { x: 276, y: 371, width: 85, height: 158 },
};

/** 部屋の座標を、ROOM_VIEW を bounds に収めた（xMidYMid meet）ときの画面座標に変換する。 */
export function fitRoom(bounds: { width: number; height: number }) {
  const scale = Math.min(bounds.width / ROOM_VIEW.width, bounds.height / ROOM_VIEW.height);
  const offsetX = (bounds.width - ROOM_VIEW.width * scale) / 2 - ROOM_VIEW.x * scale;
  const offsetY = (bounds.height - ROOM_VIEW.height * scale) / 2 - ROOM_VIEW.y * scale;
  const toScreen = (p: Point): Point => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY });
  return { scale, toScreen };
}

export type RoomLayout = ReturnType<typeof fitRoom>;
