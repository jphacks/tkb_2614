import type { SpotId } from '../domain/roomSpots';
import type { ColorScheme } from '../theme/theme';

// Figma の「Room 案A」（明るいオーク / 北欧）を react-native-svg のパスに起こしたもの。
// 部屋は 10×10・壁高 10 の箱で、x は右の壁沿い、y は左の壁沿い、z は高さ。

/** テーマの色名か、テーマに依存しない固定色（木の色・影）。 */
export type Paint = keyof ColorScheme | `#${string}`;

export interface Shape {
  readonly d: string;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

type Point = readonly [number, number];
type Range = readonly [number, number];

/**
 * 画面に収める範囲。Figma の 402×874 のフレームの座標で表す。横は部屋の外形（x 33–369）ちょうどにして、
 * 最初から部屋の横幅を画面幅に合わせる。縦は部屋（y 274–601）と、その上に立つキャラが収まる高さ。
 */
export const SCENE = { x: 33, y: 236, width: 336, height: 400 } as const;

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
    // 足元側の2本の脚。頭側の脚はヘッドボードに隠れるので描かない。
    ...box([5.15, 5.55], [5.6, 6.0], [0, 0.35], WOOD),
    ...box([5.15, 5.55], [9.0, 9.4], [0, 0.35], WOOD),
    ...box([0.35, 5.6], [5.6, 9.4], [0.35, 1.1], WOOD),
    ...box([0.45, 5.45], [5.75, 9.25], [1.1, 1.85], LINEN),
    ...box([0.65, 1.8], [6.15, 8.85], [1.85, 2.25], LINEN),
    ...box([2.0, 5.55], [5.7, 9.3], [1.1, 1.95], ['secondaryContainer', 'secondaryContainer', 'secondaryContainer'], [0.06, 0.12]),
    poly(onFloor(1.951, [2.0, 2.6], [5.7, 9.3]), 'surfaceContainerLowest'),
    poly(onRightWall(9.301, [2.0, 2.6], [1.1, 1.95]), 'surfaceContainerHigh'),
  ];
}

export const ROOM_SHAPES: readonly Shape[] = room();

export const SPOT_SHAPES: Readonly<Record<SpotId, readonly Shape[]>> = { window: windowShapes(), shelf: shelfShapes(), bed: bedShapes() };

/**
 * 奥から手前へ重ねる層。各層で家具を描いてから、その層のキャラを置く。
 * 棚のキャラは棚より奥の層に置き、棚の陰から顔を出しているように見せる。
 */
export const LAYERS: readonly { readonly spots: readonly SpotId[]; readonly characters: readonly SpotId[] }[] = [
  { spots: ['window'], characters: ['shelf'] },
  { spots: ['shelf', 'bed'], characters: ['window', 'bed'] },
];

/** 窓が結露しているときにガラスへ重ねる水滴。下端（サッシ・パッキン）ほど多くたまる。 */
export const CONDENSATION_SHAPES: readonly Shape[] = ([
  [1.3, 5.6], [2.0, 6.9], [1.6, 4.6], [2.15, 4.4], [3.0, 7.4], [3.7, 6.2], [3.2, 4.7], [3.85, 4.4],
] as const).map(([x, z]) => {
  const [cx, cy] = P(x, 0.03, z);
  // 上がとがった雫の形。壁の傾きに合わせず、縦に落ちる向きで描く。
  return { d: `M${round(cx)} ${round(cy - 6)} Q${round(cx + 4)} ${round(cy)} ${round(cx)} ${round(cy + 3)} Q${round(cx - 4)} ${round(cy)} ${round(cx)} ${round(cy - 6)} Z`, fill: 'surfaceContainerLowest', opacity: 0.9 };
});

const below = ([x, y]: Point, dy: number): Point => [x, y + dy];

/**
 * キャラの足元の位置。窓は窓台の上、ベッドは掛け布団の上（枕寄り）、棚は棚の左の床で、体の右半分が棚に隠れる。
 * キャラの絵は足元の下に影の分の余白があるので、乗せる面より少し下に置くと面に乗って見える。
 */
export const CHARACTER_ANCHORS: Readonly<Record<SpotId, Point>> = {
  window: below(P(2.5, 0.25, 3.8), 8),
  bed: below(P(2.6, 7.6, 1.95), 20),
  shelf: below(P(5.25, 0.3, 0), 8),
};
