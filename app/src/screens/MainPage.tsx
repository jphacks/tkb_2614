import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { space, type as typography, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { HomeState } from '../ui/homeState';
import { characterNames, nextCharacter, type CharacterKind } from '../ui/mascot/types';
import { Reading } from '../ui/Reading';

const previewStages = [null, 'fine', 'worried', 'dizzy'] as const;
const previewLabels = ['自動', '低', '中', '高'] as const;

/** The top-right button cycles mascots; horizontal gestures navigate pages. */
export function MainPage({ home, bottomInset, topInset, character, onCharacterChange, active, debugWeather }: {
  home: HomeState;
  bottomInset: number;
  topInset: number;
  character: CharacterKind;
  onCharacterChange: (character: CharacterKind) => void;
  active: boolean;
  /** TODO: 天気の取得確認用の仮表示。 */
  debugWeather?: ReactNode;
}) {
  const scheme = useScheme();
  // Preview only the mascot. Never mutate measurements, prediction, or theme.
  const [previewStage, setPreviewStage] = useState(0);
  const previewMood = __DEV__ ? previewStages[previewStage] : null;
  const { width, height, fontScale } = useWindowDimensions();
  // Give the mascot nearly the full screen width, reserving room for the
  // reading, top button, and movement during a tap reaction.
  const contentTop = topInset + 56;
  const reservedHeight = typography.reading.lineHeight * fontScale + space.s16 + 32;
  const size = Math.max(120, Math.min(440, width - space.s24, height - bottomInset - contentTop - reservedHeight));

  return (
    <View style={[styles.content, { paddingBottom: bottomInset, paddingTop: contentTop }]}>
      {__DEV__ && (
        <Pressable
          onPress={() => setPreviewStage((stage) => (stage + 1) % previewStages.length)}
          accessibilityRole="button"
          accessibilityLabel={`開発用マスコット段階：${previewLabels[previewStage]}`}
          accessibilityHint="自動、低、中、高の順に切り替えます。実際の危険度には影響しません"
          style={({ pressed }) => [styles.cornerButton, styles.previewButton, {
            top: topInset + space.s8,
            backgroundColor: pressed ? scheme.primaryContainer : scheme.surfaceContainerHigh,
          }]}
        >
          <Text style={[styles.previewLabel, { color: scheme.onSurfaceVariant }]}>DEV · {previewLabels[previewStage]}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => onCharacterChange(nextCharacter(character, 1))}
        accessibilityRole="button"
        accessibilityLabel="キャラクターを切り替え"
        accessibilityHint={`現在は${characterNames[character]}。次は${characterNames[nextCharacter(character, 1)]}`}
        style={({ pressed }) => [styles.cornerButton, styles.switchButton, {
          top: topInset + space.s8,
          backgroundColor: pressed ? scheme.primaryContainer : scheme.surfaceContainerHigh,
        }]}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" accessible={false}>
          <Path d="M4 7a9 9 0 0 1 15-1M19 2v4h-4M20 17a9 9 0 0 1-15 1M5 22v-4h4" fill="none" stroke={scheme.onSurfaceVariant} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={4.5} fill="none" stroke={scheme.onSurfaceVariant} strokeWidth={1.5} />
          <Circle cx={10.5} cy={11.5} r={0.65} fill={scheme.onSurfaceVariant} />
          <Circle cx={13.5} cy={11.5} r={0.65} fill={scheme.onSurfaceVariant} />
          <Path d="M10.5 13.3q1.5 1.4 3 0" fill="none" stroke={scheme.onSurfaceVariant} strokeWidth={1.2} strokeLinecap="round" />
        </Svg>
      </Pressable>
      <Character mood={previewMood ?? home.mood} size={size} character={character} active={active} />
      <Reading state={home.reading} />
      {debugWeather}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s16 },
  cornerButton: { position: 'absolute', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  switchButton: { right: space.s16, width: 48 },
  previewButton: { left: space.s16, paddingHorizontal: space.s16 },
  previewLabel: { fontSize: 12, fontWeight: '600' },
});
