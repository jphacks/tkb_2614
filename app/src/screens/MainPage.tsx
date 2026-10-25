import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { VentilationAdvice } from '../domain/ventilation';
import { space, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { HomeState } from '../ui/homeState';
import { characterNames, nextCharacter, type CharacterKind } from '../ui/mascot/types';
import { MoldBackground } from '../ui/MoldBackground';
import { SPEECH_BUBBLE_HEIGHT, SpeechBubble } from '../ui/SpeechBubble';
import { ventilationMessage, type BubbleMessage } from '../ui/ventilationMessage';

const previewStages = [null, 'fine', 'worried', 'worried', 'dizzy'] as const;
const previewIndices = [null, 0, 1, 2, 3] as const;
const previewLabels = ['自動', '低', '中 · VTT 1', '中 · VTT 2', '高'] as const;
const bubblePreviews: readonly (readonly [label: string, advice: VentilationAdvice])[] = [
  ['開ける', { kind: 'open', brief: false, predictedIndoorRh: 42 }],
  ['少し開ける', { kind: 'open', brief: true }],
  ['閉める', { kind: 'close', reason: 'outdoorWetter' }],
  ['雨', { kind: 'keep', reason: 'rain' }],
  ['強風', { kind: 'keep', reason: 'wind' }],
  ['暑い', { kind: 'keep', reason: 'hot' }],
  ['なし', { kind: 'none' }],
];

/** The top-right button cycles mascots; horizontal gestures navigate pages. */
export function MainPage({ home, moldIndex, bubble, bottomInset, topInset, character, onCharacterChange, active }: {
  home: HomeState;
  moldIndex: number | null;
  /** 窓の開閉判定。null なら吹き出しを出さない（場所は空けたまま）。 */
  bubble: BubbleMessage | null;
  bottomInset: number;
  topInset: number;
  character: CharacterKind;
  onCharacterChange: (character: CharacterKind) => void;
  active: boolean;
}) {
  const scheme = useScheme();
  // Preview the mascot and background together without changing the actual prediction.
  const [previewStage, setPreviewStage] = useState(0);
  const previewMood = __DEV__ ? previewStages[previewStage] : null;
  // 0 は自動。1 以降は bubblePreviews を順に見せる（開発用）。
  const [bubblePreview, setBubblePreview] = useState(0);
  const previewAdvice = __DEV__ && bubblePreview > 0 ? bubblePreviews[bubblePreview - 1] : null;
  const shownBubble = previewAdvice ? ventilationMessage(previewAdvice[1], null, null) : bubble;
  const backgroundIndex = previewMood ? previewIndices[previewStage] : home.risk === null ? null : moldIndex;
  const stale = home.reading.kind === 'stale';
  const { width, height } = useWindowDimensions();
  // Give the mascot nearly the full screen width, reserving room for the
  // top button and movement during a tap reaction.
  const contentTop = topInset + 56;
  const reservedHeight = 32 + SPEECH_BUBBLE_HEIGHT + space.s16;
  const size = Math.max(120, Math.min(440, width - space.s24, height - bottomInset - contentTop - reservedHeight));

  return (
    <View style={[styles.content, { paddingBottom: bottomInset, paddingTop: contentTop }]}>
      <MoldBackground moldIndex={backgroundIndex} character={character} stale={stale} />
      {__DEV__ && (
        <Pressable
          onPress={() => setPreviewStage((stage) => (stage + 1) % previewStages.length)}
          accessibilityRole="button"
          accessibilityLabel={`開発用マスコット段階：${previewLabels[previewStage]}`}
          accessibilityHint="自動、低、中のVTT 1、中のVTT 2、高の順にキャラクターと背景を切り替えます。実際の危険度には影響しません"
          style={({ pressed }) => [styles.cornerButton, styles.previewButton, {
            top: topInset + space.s8,
            backgroundColor: pressed ? scheme.primaryContainer : scheme.surfaceContainerHigh,
          }]}
        >
          <Text style={[styles.previewLabel, { color: scheme.onSurfaceVariant }]}>DEV · {previewLabels[previewStage]}</Text>
        </Pressable>
      )}
      {__DEV__ && (
        // 段階のボタンの下に置く。
        <Pressable
          onPress={() => setBubblePreview((index) => (index + 1) % (bubblePreviews.length + 1))}
          accessibilityRole="button"
          accessibilityLabel={`開発用吹き出し：${previewAdvice?.[0] ?? '自動'}`}
          accessibilityHint="窓の開閉判定の種類ごとに吹き出しを切り替えます。実際の判定には影響しません"
          style={({ pressed }) => [styles.cornerButton, styles.previewButton, {
            top: topInset + space.s8 + 48 + space.s8,
            backgroundColor: pressed ? scheme.primaryContainer : scheme.surfaceContainerHigh,
          }]}
        >
          <Text style={[styles.previewLabel, { color: scheme.onSurfaceVariant }]}>DEV · {previewAdvice?.[0] ?? '自動'}</Text>
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
      <SpeechBubble message={shownBubble} live={active} />
      <Character mood={previewMood ?? home.mood} size={size} character={character} active={active} stale={stale} />
      {home.reading.kind === 'searching' && <ActivityIndicator color={scheme.primary} accessibilityLabel="デバイスを探しています" />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s16, overflow: 'hidden' },
  cornerButton: { position: 'absolute', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  switchButton: { right: space.s16, width: 48 },
  previewButton: { left: space.s16, paddingHorizontal: space.s16 },
  previewLabel: { fontSize: 12, fontWeight: '600' },
});
