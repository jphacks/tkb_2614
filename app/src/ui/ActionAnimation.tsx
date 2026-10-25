import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { artwork } from './action/artwork';
import type { ActionMotion, ActionName, ActionNode } from './action/types';
import { MascotClock } from './mascot/MascotClock';
import { easeAt, sampleMotion } from './mascot/motionState';

const elements = { g: G, path: Path, circle: Circle };

function opacityAt(motion: ActionMotion, elapsed: number) {
  const frames = motion.opacity;
  const time = elapsed - motion.delay;
  const phase = time <= 0 ? 0 : (time % motion.duration) / motion.duration;
  const endIndex = frames.findIndex((frame) => frame.at >= phase);
  if (endIndex <= 0) return frames[0].value;
  const start = frames[endIndex - 1], end = frames[endIndex];
  return start.value + (end.value - start.value) * easeAt((phase - start.at) / (end.at - start.at), motion.easing);
}

/** 止まっているとき（画面外・視差効果を減らす設定）は、CSS の animation: none と同じく変形も不透明度も元の値にする。 */
function ActionGroup({ motion, clock, children }: { motion: ActionMotion; clock: MascotClock; children: ReactNode }) {
  const group = useRef<G<unknown>>(null);
  useEffect(() => clock.subscribe((elapsed, _reactionAt, active) => {
    const frame = active && motion.frames.length ? sampleMotion(motion, elapsed, true) : null;
    group.current?.setNativeProps({
      x: frame?.x ?? 0, y: frame?.y ?? 0, rotation: frame?.rotation ?? 0,
      scaleX: frame?.scaleX ?? 1, scaleY: frame?.scaleY ?? 1,
      opacity: active && motion.opacity.length ? opacityAt(motion, elapsed) : 1,
    });
  }), [clock, motion]);
  const [x, y] = motion.origin;
  return (
    <G transform={`translate(${x} ${y})`}>
      <G ref={group}>
        <G transform={`translate(${-x} ${-y})`}>{children}</G>
      </G>
    </G>
  );
}

function Drawing({ nodes, clock }: { nodes: ActionNode[]; clock: MascotClock }) {
  return nodes.map((node, index) => {
    const Element = elements[node.tag];
    const children = node.children.length ? <Drawing nodes={node.children} clock={clock} /> : undefined;
    return node.motion ? (
      <G key={index} {...node.props}>
        <ActionGroup motion={node.motion} clock={clock}>{children}</ActionGroup>
      </G>
    ) : <Element key={index} {...node.props}>{children}</Element>;
  });
}

/**
 * 窓の開閉などのアクションを、assets/actions の SVG のとおりに繰り返し動かす。
 * active でないとき（メインページを見ていない）・バックグラウンド・視差効果を減らす設定では止める。
 * 絵は飾りで、伝えたいことは吹き出しの文に書くので、読み上げない。
 */
export function ActionAnimation({ name, size, active }: { name: ActionName; size: number; active: boolean }) {
  const [clock] = useState(() => new MascotClock(requestAnimationFrame, cancelAnimationFrame));
  const [appState, setAppState] = useState(AppState.currentState);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSubscription = AppState.addEventListener('change', setAppState);
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); }).catch(() => {});
    return () => { mounted = false; subscription.remove(); appSubscription.remove(); };
  }, []);
  const animate = active && !reducedMotion && (appState === null || appState === 'active');
  useEffect(() => {
    clock.setActive(animate);
    return () => clock.setActive(false);
  }, [clock, animate, name]);
  const { viewBox, nodes } = artwork[name];
  return (
    <Svg width={size} height={size} viewBox={viewBox} accessible={false}>
      <Drawing key={name} nodes={nodes} clock={clock} />
    </Svg>
  );
}
