import type { MoldRiskLevel } from '../../domain/prediction';

export const characterKinds = ['mimi', 'antenna', 'fin', 'mushroom', 'cloudtail'] as const;
export type CharacterKind = typeof characterKinds[number];
export const characterNames: Record<CharacterKind, string> = {
  mimi: 'みみばね', antenna: 'ふさアンテナ', fin: 'しめり背びれ', mushroom: 'きのこまもり', cloudtail: 'くもりしっぽ',
};
export interface MotionFrame {
  at: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
export interface Motion {
  frames: MotionFrame[];
  duration: number;
  delay: number;
  easing: 'linear' | 'inOut' | 'out';
}
export interface ArtworkNode {
  tag: 'g' | 'path' | 'ellipse' | 'circle';
  props: Record<string, string>;
  children: ArtworkNode[];
  motion?: { origin: number[]; idle?: Motion; reaction?: Motion };
}
export type Artwork = Record<CharacterKind, Record<MoldRiskLevel, ArtworkNode[]>>;

export function nextCharacter(current: CharacterKind, direction: number): CharacterKind {
  return characterKinds[(characterKinds.indexOf(current) + direction + characterKinds.length) % characterKinds.length];
}
/** Horizontal gestures belong to the page navigator. Small vertical movements are taps. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dy) < 44 || Math.abs(dy) <= Math.abs(dx) * 1.4) return 0;
  return dy < 0 ? 1 : -1;
}
