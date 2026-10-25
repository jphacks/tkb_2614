import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { Mood } from './homeState';
import { artwork } from './mascot/artwork';
import { MotionGroup } from './mascot/MotionGroup';
import { MascotClock } from './mascot/MascotClock';
import { useTapSound } from './mascot/useTapSound';
import { mascotViewBox } from './mascot/viewport';
import { characterNames, type ArtworkNode, type CharacterKind } from './mascot/types';

const elements = { g: G, path: Path, ellipse: Ellipse, circle: Circle };
const levels = { fine: 'low', worried: 'medium', dizzy: 'high', sleep: 'low' } as const;
const moodLabels: Record<Mood, string> = { fine: '危険度：低', worried: '危険度：中', dizzy: '危険度：高', sleep: '計測データなし' };

function Drawing({ nodes, clock }: { nodes: ArtworkNode[]; clock: MascotClock }) {
  return nodes.map((node, index) => {
    const Element = elements[node.tag];
    const children = <Drawing nodes={node.children} clock={clock} />;
    return node.motion ? (
      <G key={index} {...node.props}>
        <MotionGroup motion={node.motion} clock={clock}>{children}</MotionGroup>
      </G>
    ) : <Element key={index} {...node.props}>{node.children.length ? children : undefined}</Element>;
  });
}

export function Character({ mood, size, character = 'mimi', active = true }: {
  mood: Mood;
  size: number;
  character?: CharacterKind;
  active?: boolean;
}) {
  const [clock] = useState(() => new MascotClock(requestAnimationFrame, cancelAnimationFrame));
  const playTapSound = useTapSound();
  const [appState, setAppState] = useState(AppState.currentState);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSubscription = AppState.addEventListener('change', setAppState);
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); }).catch(() => {});
    return () => { mounted = false; subscription.remove(); appSubscription.remove(); };
  }, []);
  const animate = active && !reducedMotion && mood !== 'sleep' && (appState === null || appState === 'active');
  useEffect(() => {
    clock.setActive(animate);
    return () => clock.setActive(false);
  }, [clock, animate, character, mood]);
  return (
    <Pressable
      onPress={() => {
        playTapSound();
        if (animate) clock.react();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${characterNames[character]}、${moodLabels[mood]}`}
      accessibilityHint="タップするとキャラクターが音を出して反応します"
      style={{ width: size, height: size, opacity: mood === 'sleep' ? 0.45 : 1 }}
    >
      <Svg width={size} height={size} viewBox={mascotViewBox} preserveAspectRatio="xMidYMid meet" accessible={false}>
        <Drawing key={`${character}-${mood}`} nodes={artwork[character][levels[mood]]} clock={clock} />
      </Svg>
    </Pressable>
  );
}
