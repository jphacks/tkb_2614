import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { corner, space, type, useScheme } from '../theme/theme';
import type { BubbleMessage } from './ventilationMessage';

const TAIL_WIDTH = 20;
const TAIL_HEIGHT = 10;
const BODY_LINES = 2;

/**
 * 吹き出しのために空けておく高さ。吹き出しが出ても消えてもキャラの位置が動かないよう、出していないときも同じ高さを空ける。
 * 理由1行（label）と本文2行（body）に、上下の余白としっぽを足した高さ。
 */
export function speechBubbleHeight(fontScale: number) {
  return (type.label.lineHeight + type.body.lineHeight * BODY_LINES) * fontScale + space.s12 * 2 + TAIL_HEIGHT;
}

/** キャラの頭の上に出す、しっぽが下を向いた吹き出し。message が null なら場所だけ空ける。 */
export function SpeechBubble({ message, height, maxWidth }: { message: BubbleMessage | null; height: number; maxWidth: number }) {
  const scheme = useScheme();
  return (
    <View style={[styles.area, { height, maxWidth }]} pointerEvents="none">
      {message && (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={[message.reason, message.text].filter(Boolean).join('。')}
          accessibilityLiveRegion="polite"
          style={styles.bubble}
        >
          <View style={[styles.body, { backgroundColor: scheme.surfaceContainerHigh }]}>
            {message.reason && (
              <Text style={[type.label, styles.text, { color: scheme.onSurfaceVariant }]} numberOfLines={1} adjustsFontSizeToFit>{message.reason}</Text>
            )}
            <Text style={[type.body, styles.text, { color: scheme.onSurface }]} numberOfLines={BODY_LINES} adjustsFontSizeToFit>{message.text}</Text>
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
  bubble: { alignItems: 'center' },
  body: { borderRadius: corner.extraLargeIncreased, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  text: { textAlign: 'center' },
});
