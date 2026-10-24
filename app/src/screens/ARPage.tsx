import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ARCamera } from '../components/ARCamera';
import type { MoldRiskLevel } from '../domain/prediction';
import { useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { Mood } from '../ui/homeState';
import { Mold } from '../ui/Mold';
import type { CharacterKind } from '../ui/mascot/types';

const VIEW = { width: 402, height: 874 };

/** [x, y（下端）, 大きさ]。リスクが高いほど数と大きさを増やす。 */
const MOLDS: Record<MoldRiskLevel, readonly (readonly [number, number, number])[]> = {
  low: [[104, 604, 43]],
  medium: [[98, 604, 61], [150, 604, 43], [76, 548, 40]],
  high: [[94, 604, 79], [150, 604, 61], [196, 604, 43], [240, 604, 32], [70, 518, 58], [78, 448, 43], [84, 388, 32], [30, 668, 50]],
};

export function ARPage({ risk, mood, character, isVisible, isSettled, bottomInset }: {
  risk: MoldRiskLevel | null;
  mood: Mood;
  character: CharacterKind;
  isVisible: boolean;
  isSettled: boolean;
  bottomInset: number;
}) {
  const scheme = useScheme();
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const [bounds, setBounds] = useState(VIEW);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // 部屋の絵と同じviewBoxで配置し、端末のアスペクト比に合わせて切り抜く。
  const scale = Math.max(bounds.width / VIEW.width, bounds.height / VIEW.height);
  const offsetX = (bounds.width - VIEW.width * scale) / 2;
  const offsetY = (bounds.height - VIEW.height * scale) / 2;
  const scene = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {risk && MOLDS[risk].map(([x, bottom, size]) => (
        <Mold
          key={`${x}-${bottom}`}
          x={x * scale + offsetX}
          y={(bottom - size) * scale + offsetY}
          size={size * scale}
          variant={size >= 70 ? 'big' : size >= 45 ? 'normal' : 'small'}
          moving={isVisible && isActive}
        />
      ))}
      <View style={styles.character}><Character mood={mood} size={108} character={character} active={isVisible && isActive} /></View>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: scheme.surface }]} onLayout={({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="xMidYMid slice">
        <Path d="M0 0 H402 V874 H0 Z" fill={scheme.surfaceContainer} />
        <Path d="M0 0 L90 0 L90 600 L0 690 Z" fill={scheme.surfaceContainerHigh} />
        <Path d="M0 690 L90 600 L402 600 L402 874 L0 874 Z" fill={scheme.surfaceContainerHighest} />
        <Path d="M90 596 L402 596 L402 604 L90 604 Z" fill={scheme.outlineVariant} />
      </Svg>
      <ARCamera isVisible={isVisible} isSettled={isSettled} isActive={isActive} bottomInset={bottomInset}>{scene}</ARCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  character: { position: 'absolute', left: 0, right: 0, bottom: '14%', alignItems: 'center' },
});
