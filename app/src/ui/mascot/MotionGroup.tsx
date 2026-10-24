import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { G } from 'react-native-svg';

import type { ArtworkNode, Motion } from './types';
import { selectMotion } from './motionState';

const AnimatedG = Animated.createAnimatedComponent(G);
const easingFor = (motion: Motion) => motion.easing === 'linear' ? Easing.linear : motion.easing === 'out' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease);

/** SVG group transforms use the JS driver; there is no DOM or CSS dependency. */
export function MotionGroup({ motion, tap, active, children }: {
  motion: NonNullable<ArtworkNode['motion']>;
  tap: number;
  active: boolean;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [completedTap, setCompletedTap] = useState(tap);
  const reacting = tap > completedTap && !!motion.reaction;
  const selected = selectMotion(motion, reacting, active);

  useEffect(() => {
    progress.setValue(0);
    if (selected.duration === 0) return;
    const timing = (duration: number) => Animated.timing(progress, {
      toValue: 1, duration, easing: easingFor(selected), useNativeDriver: false, isInteraction: false,
    });
    let animation: Animated.CompositeAnimation;
    if (reacting) {
      animation = timing(selected.duration);
      animation.start(({ finished }) => { if (finished) setCompletedTap(tap); });
    } else {
      const phase = ((-selected.delay % selected.duration) + selected.duration) % selected.duration / selected.duration;
      progress.setValue(phase);
      animation = Animated.sequence([
        timing(selected.duration * (1 - phase)),
        Animated.loop(timing(selected.duration)),
      ]);
      animation.start();
    }
    return () => animation.stop();
  }, [active, selected, reacting, tap, progress]);

  // Keep the same SVG hierarchy when a reaction ends. Replacing the pivoted
  // groups with a plain G can leave a recycled native group with a stale matrix.
  const interpolate = (property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY') => progress.interpolate({
    inputRange: selected.frames.map((frame) => frame.at),
    outputRange: selected.frames.map((frame) => frame[property]),
  });
  const [x, y] = motion.origin;
  return (
    <G transform={`translate(${x} ${y})`}>
      <AnimatedG x={interpolate('x')} y={interpolate('y')} rotation={interpolate('rotation')} scaleX={interpolate('scaleX')} scaleY={interpolate('scaleY')}>
        <G transform={`translate(${-x} ${-y})`}>{children}</G>
      </AnimatedG>
    </G>
  );
}
