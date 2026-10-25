import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useScheme } from '../theme/theme';

// ウィジェットの同期アイコン（scripts/renderWidgetImages.ts）と同じ形。
const SYNC_PATH = 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z';

/** キャラの長押しで温湿度計を探し直している間に出す。文字は出さず、回る同期アイコンだけで伝える。 */
export function SyncIndicator({ size = 32 }: { size?: number }) {
  const scheme = useScheme();
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    let mounted = true;
    // 動きを減らす設定なら回さない。
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => { if (mounted && !reduced) loop.start(); }).catch(() => loop.start());
    return () => { mounted = false; loop.stop(); };
  }, [rotation]);
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="温湿度計を探し直しています"
      accessibilityLiveRegion="polite"
      style={{ width: size, height: size, transform: [{ rotate }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Path d={SYNC_PATH} fill={scheme.primary} />
      </Svg>
    </Animated.View>
  );
}
