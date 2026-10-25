import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { corner, space, type, useScheme } from '../theme/theme';
import { ActionAnimation } from './ActionAnimation';
import type { BubbleMessage } from './ventilationMessage';

const TAIL_WIDTH = 20;
const TAIL_HEIGHT = 10;
const BODY_LINES = 2;
/** 吹き出しの左に出すアニメーションの大きさ。文字を大きくしても変えない（絵が主役で、文は補う）。 */
const ANIMATION_SIZE = 88;

/**
 * 吹き出しのために空けておく高さ。吹き出しが出ても消えてもキャラの位置が動かないよう、出していないときも同じ高さを空ける。
 * アニメーションと、理由1行（label）＋本文2行（body）の高いほうに、上下の余白としっぽを足した高さ。
 */
export function speechBubbleHeight(fontScale: number) {
  return Math.max(ANIMATION_SIZE, (type.label.lineHeight + type.body.lineHeight * BODY_LINES) * fontScale) + space.s12 * 2 + TAIL_HEIGHT;
}

/**
 * キャラの頭の上に出す、しっぽが下を向いた吹き出し。左にすることのアニメーション、右にひとことを出す。message が null なら場所だけ空ける。
 * live のときだけ、アニメーションを動かし、文が変わったら読み上げる（Android のみ）。メインページを見ていないときは止める。
 */
export function SpeechBubble({ message, height, maxWidth, live }: { message: BubbleMessage | null; height: number; maxWidth: number; live: boolean }) {
  const scheme = useScheme();
  return (
    <View style={[styles.area, { height, maxWidth }]} pointerEvents="none">
      {message && (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={[message.reason, message.text].filter(Boolean).join('。')}
          accessibilityLiveRegion={live ? 'polite' : 'none'}
          style={styles.bubble}
        >
          <View style={[styles.body, { backgroundColor: scheme.surfaceContainerHigh }]}>
            <ActionAnimation name={message.animation} size={ANIMATION_SIZE} active={live} />
            <View style={styles.texts}>
              {message.reason && (
                <Text style={[type.label, { color: scheme.onSurfaceVariant }]} numberOfLines={1} adjustsFontSizeToFit>{message.reason}</Text>
              )}
              <Text style={[type.body, { color: scheme.onSurface }]} numberOfLines={BODY_LINES} adjustsFontSizeToFit>{message.text}</Text>
            </View>
          </View>
          <Svg width={TAIL_WIDTH} height={TAIL_HEIGHT} viewBox={`0 0 ${TAIL_WIDTH} ${TAIL_HEIGHT}`} accessible={false}>
            <Path d={`M0 0H${TAIL_WIDTH}L${TAIL_WIDTH / 2} ${TAIL_HEIGHT}Z`} fill={scheme.surfaceContainerHigh} />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bubble: { alignItems: 'center', maxWidth: '100%' },
  body: {
    flexDirection: 'row', alignItems: 'center', gap: space.s12, maxWidth: '100%',
    borderRadius: corner.extraLargeIncreased, paddingLeft: space.s12, paddingRight: space.s16, paddingVertical: space.s12,
  },
  texts: { flexShrink: 1 },
});
