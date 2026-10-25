import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { corner, space, useScheme } from '../theme/theme';
import { ActionAnimation } from './ActionAnimation';
import type { BubbleMessage } from './ventilationMessage';

const TAIL_WIDTH = 20;
const TAIL_HEIGHT = 10;
/** 吹き出しに出すアニメーションの大きさ。 */
const ANIMATION_SIZE = 112;

/**
 * 吹き出しのために空けておく高さ。吹き出しが出ても消えてもキャラの位置が動かないよう、出していないときも同じ高さを空ける。
 * アニメーションに、上下の余白としっぽを足した高さ。
 */
export const SPEECH_BUBBLE_HEIGHT = ANIMATION_SIZE + space.s12 * 2 + TAIL_HEIGHT;

/**
 * キャラの頭の上に出す、しっぽが下を向いた吹き出し。中には、することのアニメーションだけを出す（画面に文言は出さない）。
 * ひとことはスクリーンリーダーの読み上げにだけ使う。message が null なら場所だけ空ける。
 * live のときだけ、アニメーションを動かし、ひとことが変わったら読み上げる（Android のみ）。メインページを見ていないときは止める。
 */
export function SpeechBubble({ message, live }: { message: BubbleMessage | null; live: boolean }) {
  const scheme = useScheme();
  return (
    <View style={styles.area} pointerEvents="none">
      {message && (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={[message.reason, message.text].filter(Boolean).join('。')}
          accessibilityLiveRegion={live ? 'polite' : 'none'}
          style={styles.bubble}
        >
          <View style={[styles.body, { backgroundColor: scheme.surfaceContainerHigh }]}>
            <ActionAnimation name={message.animation} size={ANIMATION_SIZE} active={live} />
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
  area: { height: SPEECH_BUBBLE_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  bubble: { alignItems: 'center' },
  body: { borderRadius: corner.extraLargeIncreased, padding: space.s12 },
});
