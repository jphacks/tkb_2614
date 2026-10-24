import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { space, type as typography, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { HomeState } from '../ui/homeState';
import { characterNames, nextCharacter, type CharacterKind } from '../ui/mascot/types';
import { Reading } from '../ui/Reading';

/** The top-right button cycles mascots; horizontal gestures navigate pages. */
export function MainPage({ home, bottomInset, topInset, character, onCharacterChange, active }: {
  home: HomeState;
  bottomInset: number;
  topInset: number;
  character: CharacterKind;
  onCharacterChange: (character: CharacterKind) => void;
  active: boolean;
}) {
  const scheme = useScheme();
  const { width, height, fontScale } = useWindowDimensions();
  // Give the mascot nearly the full screen width, reserving room for the
  // reading, top button, and movement during a tap reaction.
  const contentTop = topInset + 56;
  const reservedHeight = typography.reading.lineHeight * fontScale + space.s16 + 32;
  const size = Math.max(120, Math.min(440, width - space.s24, height - bottomInset - contentTop - reservedHeight));

  return (
    <View style={[styles.content, { paddingBottom: bottomInset, paddingTop: contentTop }]}>
      <Pressable
        onPress={() => onCharacterChange(nextCharacter(character, 1))}
        accessibilityRole="button"
        accessibilityLabel="キャラクターを切り替え"
        accessibilityHint={`現在は${characterNames[character]}。次は${characterNames[nextCharacter(character, 1)]}`}
        style={({ pressed }) => [styles.switchButton, {
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
      <Character key={character} mood={home.mood} size={size} character={character} active={active} />
      <Reading state={home.reading} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s16 },
  switchButton: { position: 'absolute', right: space.s16, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});
