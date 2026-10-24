import type { ColorScheme } from '../theme/theme';

// Figma の「Room 案A」（明るいオーク / 北欧）を react-native-svg のパスに起こしたもの。
// 部屋は 10×10・壁高 10 の箱で、x は右の壁沿い、y は左の壁沿い、z は高さ。

export type SpotId = 'window' | 'bed' | 'shelf';
export const SPOT_IDS: readonly SpotId[] = ['window', 'bed', 'shelf'];

/** テーマの色名か、テーマに依存しない固定色（木の色・影）。 */
export type Paint = keyof ColorScheme | `#${string}`;

export interface Shape {
  readonly d: string;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Point = readonly [number, number];
type Range = readonly [number, number];

/** 部屋（x 33–369, y 274–601）と、その上に置くカビ・キャラが収まる範囲。Figma の 402×874 のフレームの座標で表す。 */
export const SCENE = { x: 0, y: 236, width: 402, height: 400 } as const;

/** 木は4トーンに固定する。光は左上から当て、天面 > 左前面 > 右前面の順に暗くする。 */
export const OAK = { o50: '#EBD9BA', o100: '#DCC39B', o200: '#C9A472', o300: '#AE8656' } as const;
const WOOD = [OAK.o100, OAK.o200, OAK.o300] as const;
const LINEN = ['surfaceContainerLowest', 'surfaceContainerHigh', 'surfaceContainerHighest'] as const;

export function project(x: number, y: number, z: number): Point {
  return [201 + 16 * x - 16 * y, 432 + 8 * x + 8 * y - 15 * z];
}

const round = (n: number) => Math.round(n * 100) / 100;
const polygon = (points: readonly Point[]) => `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L')} Z`;
const P = project;

function poly(points: readonly Point[], fill: Paint, opacity?: number): Shape {
  return { d: polygon(points), fill, opacity };
}
function line(a: Point, b: Point, stroke: Paint): Shape {
  return { d: `M${round(a[0])} ${round(a[1])} L${round(b[0])} ${round(b[1])}`, stroke, strokeWidth: 1 };
}
/** 右の壁（y 一定）・左の壁（x 一定）・床（z 一定）に貼りつく四角形。 */
const onRightWall = (y: number, [x0, x1]: Range, [z0, z1]: Range) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];
const onLeftWall = (x: number, [y0, y1]: Range, [z0, z1]: Range) => [P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)];
const onFloor = (z: number, [x0, x1]: Range, [y0, y1]: Range) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];

/** 見える3面（天面・左前面・右前面）。shade は左前面・右前面に重ねる黒の濃さ。 */
function box([x0, x1]: Range, [y0, y1]: Range, [z0, z1]: Range, [top, left, right]: readonly Paint[], shade?: readonly [number, number]): Shape[] {
  const leftFace = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
  const rightFace = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)];
  return [
    poly(leftFace, left), ...(shade ? [poly(leftFace, '#000000', shade[0])] : []),
    poly(rightFace, right), ...(shade ? [poly(rightFace, '#000000', shade[1])] : []),
    poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top),
  ];
}

function room(): Shape[] {
  const plankJoints: readonly Point[] = [[0, 3.2], [1, 6.6], [2, 1.8], [3, 5.0], [4, 8.2], [5, 3.6], [6, 6.9], [7, 2.4]];
  return [
    poly([P(0, 0, 0), P(0, 10, 0), P(0, 10, 10), P(0, 0, 10)], 'surfaceContainerLow'),
    poly([P(0, 0, 0), P(10, 0, 0), P(10, 0, 10), P(0, 0, 10)], 'surfaceContainerLowest'),
    poly(onLeftWall(0.01, [0, 10], [0, 0.4]), OAK.o100),
    poly(onRightWall(0.01, [0, 10], [0, 0.4]), OAK.o100),
    poly([P(0, 0, 10), P(10, 0, 10), P(10, -0.5, 10), P(-0.5, -0.5, 10), P(-0.5, 10, 10), P(0, 10, 10)], 'surfaceContainerHighest'),
    poly([P(10, -0.5, 10), P(10, 0, 10), P(10, 0, -0.6), P(10, -0.5, -0.6)], 'outlineVariant'),
    poly([P(-0.5, 10, 10), P(0, 10, 10), P(0, 10, -0.6), P(-0.5, 10, -0.6)], 'surfaceContainerHighest'),
    poly(onFloor(0, [0, 10], [0, 10]), OAK.o50),
    ...[1, 2, 3, 4, 5, 6, 7].map((k) => line(P(0, k * 1.25, 0), P(10, k * 1.25, 0), OAK.o100)),
    ...plankJoints.map(([k, x]) => line(P(x, k * 1.25, 0), P(x, (k + 1) * 1.25, 0), OAK.o100)),
    poly([P(0, 10, 0), P(10, 10, 0), P(10, 10, -0.6), P(0, 10, -0.6)], OAK.o200),
    poly([P(10, 0, 0), P(10, 10, 0), P(10, 10, -0.6), P(10, 0, -0.6)], OAK.o300),
    poly(onFloor(0, [4.6, 8.6], [3.6, 7.6]), 'surfaceContainerHigh'),
  ];
}

function windowShapes(): Shape[] {
  return [
    poly(onRightWall(0.01, [0.6, 4.4], [3.8, 8.8]), OAK.o200),
    poly(onRightWall(0.02, [0.9, 2.4], [4.1, 8.5]), 'tertiaryContainer'),
    poly(onRightWall(0.02, [2.6, 4.1], [4.1, 8.5]), 'tertiaryContainer'),
    poly([P(1.2, 0, 6.6), P(1.5, 0, 6.6), P(2.1, 0, 8.0), P(1.8, 0, 8.0)], 'surfaceContainerLowest'),
    poly([P(2.9, 0, 5.0), P(3.1, 0, 5.0), P(3.6, 0, 6.1), P(3.4, 0, 6.1)], 'surfaceContainerLowest'),
    ...box([0.4, 4.6], [0, 0.5], [3.5, 3.8], WOOD),
  ];
}

function shelfShapes(): Shape[] {
  const front = 1.71;
  // [x0, x1, z0, z1, 色]: 棚に並べる本や箱
  const items: readonly (readonly [number, number, number, number, Paint])[] = [
    [7.3, 7.65, 0.3, 1.8, 'primaryContainer'], [7.7, 8.0, 0.3, 2.0, 'tertiaryContainer'], [8.05, 8.35, 0.3, 1.65, 'secondaryContainer'], [8.5, 9.1, 0.3, 1.3, OAK.o50],
    [7.3, 8.4, 2.55, 2.85, 'primaryContainer'], [7.35, 8.3, 2.85, 3.12, 'surfaceContainerLowest'], [8.6, 8.9, 2.55, 4.3, 'tertiaryContainer'], [8.95, 9.2, 2.55, 4.1, 'primaryContainer'],
    [7.3, 7.6, 4.85, 6.5, 'secondaryContainer'], [7.65, 7.95, 4.85, 6.7, 'primaryContainer'], [8.45, 9.1, 4.85, 5.8, 'surfaceContainerLowest'],
  ];
  return [
    ...box([6.9, 9.5], [0, 1.7], [0, 7.2], WOOD),
    ...([[0.3, 2.3], [2.55, 4.6], [4.85, 6.95]] as const).map((z) => poly(onRightWall(front, [7.15, 9.25], z), OAK.o300)),
    ...items.map(([x0, x1, z0, z1, fill]) => poly(onRightWall(front + 0.01, [x0, x1], [z0, z1]), fill)),
  ];
}

function bedShapes(): Shape[] {
  return [
    ...box([0, 0.35], [5.6, 9.4], [0, 3.6], WOOD),
    ...box([5.15, 5.55], [9.0, 9.4], [0, 0.35], WOOD),
    ...box([0.35, 5.6], [5.6, 9.4], [0.35, 1.1], WOOD),
    ...box([0.45, 5.45], [5.75, 9.25], [1.1, 1.85], LINEN),
    ...box([0.65, 1.8], [6.15, 8.85], [1.85, 2.25], LINEN),
    ...box([2.0, 5.55], [5.7, 9.3], [1.1, 1.95], ['secondaryContainer', 'secondaryContainer', 'secondaryContainer'], [0.06, 0.12]),
    poly(onFloor(1.951, [2.0, 2.6], [5.7, 9.3]), 'surfaceContainerLowest'),
    poly(onRightWall(9.301, [2.0, 2.6], [1.1, 1.95]), 'surfaceContainerHigh'),
  ];
}

/** 選択中に、スポットの下や背面へ敷く primaryContainer の面。 */
const SELECTED_PADS: Record<SpotId, readonly (readonly Point[])[]> = {
  window: [onRightWall(0.005, [0.1, 4.9], [3.2, 9.1])],
  bed: [onFloor(0, [0.05, 6.2], [5.0, 9.95])],
  shelf: [onRightWall(0.005, [6.6, 9.8], [0, 7.5]), onFloor(0, [6.6, 9.8], [0, 2.0])],
};

/** スポットの外形を囲う直方体（縁取り・タップ領域の計算に使う）。 */
const SPOT_BOXES: Record<SpotId, readonly (readonly [Range, Range, Range])[]> = {
  window: [[[0.4, 4.6], [0, 0.5], [3.5, 8.8]]],
  shelf: [[[6.9, 9.5], [0, 1.7], [0, 7.2]]],
  bed: [[[0, 5.6], [5.6, 9.4], [0, 3.6]]],
};

function corners(id: SpotId): Point[] {
  return SPOT_BOXES[id].flatMap(([xs, ys, zs]) => xs.flatMap((x) => ys.flatMap((y) => zs.map((z) => P(x, y, z)))));
}

/** 凸包（Andrew の単調連鎖法）。 */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export const ROOM_SHAPES: readonly Shape[] = room();

/** 描く順（奥から手前）。タップ領域が重なるところは後のスポットを優先する。 */
export const SPOT_SHAPES: Readonly<Record<SpotId, readonly Shape[]>> = { window: windowShapes(), shelf: shelfShapes(), bed: bedShapes() };
export const DRAW_ORDER: readonly SpotId[] = ['window', 'shelf', 'bed'];

export function selectedPads(id: SpotId): Shape[] {
  return SELECTED_PADS[id].map((points) => poly(points, 'primaryContainer'));
}

export function selectedOutline(id: SpotId): Shape {
  return { d: polygon(hull(corners(id))), stroke: 'primary', strokeWidth: 3 };
}

/** スポットの外形に 8 の余白を足し、最小 48×48 にした矩形。 */
function hitArea(id: SpotId): Rect {
  const points = corners(id);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  let x = Math.min(...xs) - 8;
  let y = Math.min(...ys) - 8;
  let width = Math.max(...xs) + 8 - x;
  let height = Math.max(...ys) + 8 - y;
  if (width < 48) { x -= (48 - width) / 2; width = 48; }
  if (height < 48) { y -= (48 - height) / 2; height = 48; }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export const HIT_AREAS: Readonly<Record<SpotId, Rect>> = { window: hitArea('window'), shelf: hitArea('shelf'), bed: hitArea('bed') };

/**
 * スポットごとのカビの画像の中心座標。結露から目で追えるよう、窓はガラスではなくサッシ下端のパッキンに置く。
 * 窓 = サッシ下端、ベッド = 枕元の壁とベッド下、棚 = 棚の脇と棚の上の壁。
 */
export const MOLD_ANCHORS: Readonly<Record<SpotId, readonly Point[]>> = {
  window: [P(0.9, 0, 4.15), P(4.0, 0, 4.15)],
  bed: [P(0.05, 9.75, 2.4), P(3.2, 9.4, 0.15)],
  shelf: [P(9.75, 0, 2.2), P(8.2, 0, 7.7)],
};

/** 選んだスポットの前の床。キャラの足元をここに合わせる。 */
export const CHARACTER_ANCHORS: Readonly<Record<SpotId, Point>> = {
  window: P(2.5, 2.4, 0),
  bed: P(7.4, 7.6, 0),
  shelf: P(8.2, 3.6, 0),
};
