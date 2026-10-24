import type { ArtworkNode, Motion, MotionFrame } from './types';

/** A reaction-only group must explicitly return to an identity transform. */
export const restMotion: Motion = {
  duration: 0,
  delay: 0,
  easing: [0, 0, 1, 1],
  frames: [0, 1].map((at) => ({ at, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })),
};

export function selectMotion(motion: NonNullable<ArtworkNode['motion']>, reacting: boolean, active: boolean): Motion {
  if (!active) return restMotion;
  return (reacting ? motion.reaction ?? motion.idle : motion.idle) ?? restMotion;
}

/** CSS timing functions apply separately to each keyframe interval. */
export function easeAt(progress: number, [x1, y1, x2, y2]: Motion['easing']): number {
  if (progress <= 0 || progress >= 1) return progress;
  const cubic = (t: number, a: number, b: number) => 3*(1-t)*(1-t)*t*a + 3*(1-t)*t*t*b + t*t*t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, x1, x2) < progress) lo = mid;
    else hi = mid;
  }
  return cubic((lo + hi) / 2, y1, y2);
}

export function sampleMotion(motion: Motion, elapsed: number, loop: boolean): MotionFrame {
  if (motion.duration === 0) return restMotion.frames[0];
  const time = elapsed - motion.delay;
  const phase = time <= 0 ? 0 : loop ? (time % motion.duration) / motion.duration : Math.min(time / motion.duration, 1);
  const endIndex = motion.frames.findIndex((frame) => frame.at >= phase);
  if (endIndex <= 0) return motion.frames[0];
  const start = motion.frames[endIndex - 1], end = motion.frames[endIndex];
  const amount = easeAt((phase - start.at) / (end.at - start.at), motion.easing);
  const mix = (key: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY') => start[key] + (end[key] - start[key]) * amount;
  return { at: phase, x: mix('x'), y: mix('y'), rotation: mix('rotation'), scaleX: mix('scaleX'), scaleY: mix('scaleY') };
}

export function groupFrame(motion: NonNullable<ArtworkNode['motion']>, elapsed: number, reactionAt: number | null, active: boolean): MotionFrame {
  const reacting = reactionAt !== null && !!motion.reaction && elapsed - reactionAt < motion.reaction.duration + motion.reaction.delay;
  const selected = selectMotion(motion, reacting, active);
  return sampleMotion(selected, reacting ? elapsed - reactionAt! : elapsed, !reacting);
}
