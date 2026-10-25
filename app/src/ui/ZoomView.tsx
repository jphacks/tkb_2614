import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture, type GestureTouchEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 3;
/** ダブルタップで拡大するときの倍率。 */
const TAP_SCALE = 2;

/**
 * 2本指のピンチで拡大し、2本指のドラッグで動かす。1本指の操作は受けないので、ページャーの横スワイプとぶつからない。
 * 2本指が触れたら onTwoFingers(true)、離れたら onTwoFingers(false) を UI スレッドで呼ぶ（worklet を渡す）。親はその間ページャーを止める。
 * ダブルタップで、等倍ならタップした所を拡大し、拡大中なら等倍に戻す。
 * ページを離れても拡大は戻さない。スワイプ中に戻すと、戻す動きとページ送りが重なって引っかかるため。
 */
export function ZoomView({ children, onTwoFingers }: { children: ReactNode; onTwoFingers: (active: boolean) => void }) {
  const size = useSharedValue({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fingers = useSharedValue(false);

  // 拡大した絵の端が、表示範囲の内側に入り込まないようにする。
  const limit = (value: number, length: number, zoom: number) => {
    'worklet';
    const max = (length * (zoom - 1)) / 2;
    return Math.min(max, Math.max(-max, value));
  };
  const clamp = () => {
    'worklet';
    x.value = limit(x.value, size.value.width, scale.value);
    y.value = limit(y.value, size.value.height, scale.value);
  };
  const zoomTo = (zoom: number, targetX: number, targetY: number) => {
    'worklet';
    scale.value = withTiming(zoom);
    x.value = withTiming(limit(targetX, size.value.width, zoom));
    y.value = withTiming(limit(targetY, size.value.height, zoom));
  };
  const setFingers = (count: number) => {
    'worklet';
    const active = count >= 2;
    if (active === fingers.value) return;
    fingers.value = active;
    onTwoFingers(active);
  };

  // 1本指ではページャーを止めないので、指が1本でも離れたら（2本指の操作の終わり）すぐ戻す。
  const touchesDown = (event: GestureTouchEvent) => {
    'worklet';
    setFingers(event.numberOfTouches);
  };
  const release = () => {
    'worklet';
    setFingers(0);
  };

  const pinch = usePinchGesture({
    onTouchesDown: touchesDown,
    onTouchesUp: release,
    onTouchesCancel: release,
    onFinalize: release,
    onUpdate: (event) => {
      'worklet';
      // 2本の指が同じ点から始まると、最初の倍率の変化が無限大や NaN になる。
      if (!Number.isFinite(event.scaleChange) || event.scaleChange <= 0) return;
      const next = Math.min(MAX_SCALE, Math.max(1, scale.value * event.scaleChange));
      const ratio = next / scale.value;
      // 指の間の点が動かないように、拡大の中心を指の位置に合わせる。
      const focalX = event.focalX - size.value.width / 2;
      const focalY = event.focalY - size.value.height / 2;
      x.value = focalX - (focalX - x.value) * ratio;
      y.value = focalY - (focalY - y.value) * ratio;
      scale.value = next;
      clamp();
    },
  });
  const pan = usePanGesture({
    onTouchesDown: touchesDown,
    onTouchesUp: release,
    onTouchesCancel: release,
    onFinalize: release,
    minPointers: 2,
    maxPointers: 2,
    // Android は既定で片方の指の動きを移動量にするので、ピンチと同じく2本の指の中心で測る（iOS は常に中心）。
    averageTouches: true,
    onUpdate: (event) => {
      'worklet';
      x.value += event.changeX;
      y.value += event.changeY;
      clamp();
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (event) => {
      'worklet';
      if (scale.value > 1) {
        zoomTo(1, 0, 0);
        return;
      }
      // タップした点が動かない位置へ拡大する（pinch と同じ式で、等倍・移動なしから求める）。
      const focalX = event.x - size.value.width / 2;
      const focalY = event.y - size.value.height / 2;
      zoomTo(TAP_SCALE, focalX - focalX * TAP_SCALE, focalY - focalY * TAP_SCALE);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={styles.fill} collapsable={false} onLayout={({ nativeEvent: { layout } }) => size.set({ width: layout.width, height: layout.height })}>
        <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
