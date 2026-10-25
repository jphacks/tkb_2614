import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, type GestureTouchEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 3;

/**
 * 2本指のピンチで拡大し、2本指のドラッグで動かす。1本指の操作は受けないので、ページャーの横スワイプとぶつからない。
 * 2本指が触れている間は onTwoFingers(true) を呼ぶので、親はその間ページャーを止める。
 */
export function ZoomView({ children, onTwoFingers }: { children: ReactNode; onTwoFingers: (active: boolean) => void }) {
  const size = useSharedValue({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fingers = useSharedValue(false);

  // 拡大した絵の端が、表示範囲の内側に入り込まないようにする。
  const clamp = () => {
    'worklet';
    const maxX = (size.value.width * (scale.value - 1)) / 2;
    const maxY = (size.value.height * (scale.value - 1)) / 2;
    x.value = Math.min(maxX, Math.max(-maxX, x.value));
    y.value = Math.min(maxY, Math.max(-maxY, y.value));
  };
  const setFingers = (count: number) => {
    'worklet';
    const active = count >= 2;
    if (active === fingers.value) return;
    fingers.value = active;
    scheduleOnRN(onTwoFingers, active);
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
    onUpdate: (event) => {
      'worklet';
      x.value += event.changeX;
      y.value += event.changeY;
      clamp();
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={styles.fill} collapsable={false} onLayout={({ nativeEvent: { layout } }) => { size.value = { width: layout.width, height: layout.height }; }}>
        <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
