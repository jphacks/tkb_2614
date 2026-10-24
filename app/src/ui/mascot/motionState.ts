import type { ArtworkNode, Motion } from './types';

/** A reaction-only group must explicitly return to an identity transform. */
export const restMotion: Motion = {
  duration: 0,
  delay: 0,
  easing: 'linear',
  frames: [0, 1].map((at) => ({ at, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })),
};

export function selectMotion(motion: NonNullable<ArtworkNode['motion']>, reacting: boolean, active: boolean): Motion {
  if (!active) return restMotion;
  return (reacting ? motion.reaction ?? motion.idle : motion.idle) ?? restMotion;
}
