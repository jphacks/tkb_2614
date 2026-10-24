import { useEffect, useRef, type ReactNode } from 'react';
import { G } from 'react-native-svg';

import type { MascotClock } from './MascotClock';
import { groupFrame } from './motionState';
import type { ArtworkNode } from './types';

/** All groups share one clock; idle groups never restart in response to taps. */
export function MotionGroup({ motion, clock, children }: {
  motion: NonNullable<ArtworkNode['motion']>;
  clock: MascotClock;
  children: ReactNode;
}) {
  const group = useRef<G<unknown>>(null);
  useEffect(() => {
    let previous: number[] | undefined;
    return clock.subscribe((elapsed, reactionAt, active) => {
      const frame = groupFrame(motion, elapsed, reactionAt, active);
      const values = [frame.x, frame.y, frame.rotation, frame.scaleX, frame.scaleY];
      if (previous?.every((value, index) => value === values[index])) return;
      previous = values;
      group.current?.setNativeProps({
        x: frame.x, y: frame.y, rotation: frame.rotation,
        scaleX: frame.scaleX, scaleY: frame.scaleY,
      });
    });
  }, [clock, motion]);

  const [x, y] = motion.origin;
  // Preserve this hierarchy even at rest and explicitly write the identity
  // transform, so native SVG groups cannot retain an old reaction matrix.
  return (
    <G transform={`translate(${x} ${y})`}>
      <G ref={group}>
        <G transform={`translate(${-x} ${-y})`}>{children}</G>
      </G>
    </G>
  );
}
