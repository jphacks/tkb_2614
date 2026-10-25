import type { Motion } from '../mascot/types';

export const actionNames = ['window-open', 'window-open-brief', 'window-close-rain', 'window-close-wind', 'window-close-pollen', 'aircon-dry'] as const;
/** 吹き出しに出す、部屋の環境アクションのアニメーション。assets/actions の SVG と同じ名前。 */
export type ActionName = typeof actionNames[number];

export interface OpacityFrame {
  at: number;
  value: number;
}
/** frames（変形）と opacity はそれぞれ、CSS でそのプロパティを指定したキーフレームだけで区間を作る。どちらも空なら動かさない。 */
export interface ActionMotion extends Motion {
  origin: number[];
  opacity: OpacityFrame[];
}
export interface ActionNode {
  tag: 'g' | 'path' | 'circle';
  props: Record<string, string>;
  children: ActionNode[];
  motion?: ActionMotion;
}
export type ActionArtwork = Record<ActionName, { label: string; viewBox: string; nodes: ActionNode[] }>;
