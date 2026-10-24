import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { Mood } from './homeState';
import { artwork } from './mascot/artwork';
import { MotionGroup } from './mascot/MotionGroup';
import { characterNames, type ArtworkNode, type CharacterKind } from './mascot/types';

const elements = { g: G, path: Path, ellipse: Ellipse, circle: Circle };
const levels = { fine: 'low', worried: 'medium', dizzy: 'high', sleep: 'low' } as const;
const moodLabels: Record<Mood, string> = { fine: '危険度：低', worried: '危険度：中', dizzy: '危険度：高', sleep: '計測データなし' };

function Drawing({ nodes, tap, active }: { nodes: ArtworkNode[]; tap: number; active: boolean }) {
  return nodes.map((node, index) => {
    const Element = elements[node.tag];
    const children = <Drawing nodes={node.children} tap={tap} active={active} />;
    return node.motion ? (
      <G key={index} {...node.props}>
        <MotionGroup motion={node.motion} tap={tap} active={active}>{children}</MotionGroup>
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
  const [tap, setTap] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const animate = active && !reducedMotion && mood !== 'sleep';
  return (
    <Pressable
      onPress={() => setTap((value) => value + 1)}
      accessibilityRole="button"
      accessibilityLabel={`${characterNames[character]}、${moodLabels[mood]}`}
      accessibilityHint="タップするとキャラクターが反応します"
      style={{ width: size, height: size, opacity: mood === 'sleep' ? 0.45 : 1 }}
    >
      <Svg width={size} height={size} viewBox="0 0 320 280" accessible={false}>
        <Drawing key={`${character}-${mood}`} nodes={artwork[character][levels[mood]]} tap={tap} active={animate} />
      </Svg>
    </Pressable>
  );
}
