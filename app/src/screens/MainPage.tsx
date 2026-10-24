import { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';

import { space, type as typography, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { HomeState } from '../ui/homeState';
import { characterKinds, characterNames, nextCharacter, swipeDirection, type CharacterKind } from '../ui/mascot/types';
import { Reading } from '../ui/Reading';

/** Vertical gestures select a mascot; horizontal gestures remain with the page navigator. */
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
  // reading, selection dots, and movement during a swipe or tap reaction.
  const reservedHeight = typography.reading.lineHeight * fontScale + 5 + space.s16 * 2 + 32;
  const size = Math.max(120, Math.min(440, width - space.s24, height - bottomInset - topInset - reservedHeight));
  const [drag] = useState(() => new Animated.Value(0));
  const [tapSignal, setTapSignal] = useState(0);
  const responder = useMemo(() => {
    const reset = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, isInteraction: false }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.4,
      onPanResponderMove: (_, { dy }) => drag.setValue(Math.max(-60, Math.min(60, dy * 0.3))),
      onPanResponderRelease: (_, { dx, dy }) => {
        const direction = swipeDirection(dx, dy);
        if (direction) onCharacterChange(nextCharacter(character, direction));
        reset();
      },
      onPanResponderTerminate: reset,
    });
  }, [character, onCharacterChange, drag]);

  return (
    <View style={[styles.content, { paddingBottom: bottomInset, paddingTop: topInset }]} {...responder.panHandlers}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`キャラクター、${home.risk ? { low: '危険度：低', medium: '危険度：中', high: '危険度：高' }[home.risk] : '危険度未判定'}`}
        accessibilityValue={{ min: 1, max: 5, now: characterKinds.indexOf(character) + 1, text: characterNames[character] }}
        accessibilityHint="上下にスワイプしてキャラクターを選択"
        accessibilityActions={[{ name: 'increment', label: '次のキャラクター' }, { name: 'decrement', label: '前のキャラクター' }, { name: 'activate', label: 'キャラクターをタップ' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') onCharacterChange(nextCharacter(character, 1));
          if (nativeEvent.actionName === 'decrement') onCharacterChange(nextCharacter(character, -1));
          if (nativeEvent.actionName === 'activate') setTapSignal((value) => value + 1);
        }}
      >
        <Animated.View style={{ transform: [{ translateY: drag }] }}>
          <Character key={character} mood={home.mood} size={size} character={character} active={active} tapSignal={tapSignal} />
        </Animated.View>
      </View>
      <View style={styles.selection} pointerEvents="none" accessible={false}>
        <View style={styles.dots}>
          {characterKinds.map((kind) => <View key={kind} style={[styles.dot, { backgroundColor: kind === character ? scheme.primary : scheme.outlineVariant }]} />)}
        </View>
      </View>
      <Reading state={home.reading} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s16 },
  selection: { alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
