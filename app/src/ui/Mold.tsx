import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

const small = require('../../assets/character/kabiSmall.png');
const normal = require('../../assets/character/kabiNormal.png');
const big = require('../../assets/character/kabiBig.png');

/** 仮の配置の周りだけをゆっくり漂う。非表示・バックグラウンドでは停止する。 */
export function Mold({ x, y, size, variant, moving }: {
  x: number; y: number; size: number; variant: 'small' | 'normal' | 'big'; moving: boolean;
}) {
  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!moving) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, moving]);

  return (
    <Animated.Image
      source={variant === 'big' ? big : variant === 'normal' ? normal : small}
      accessible={false}
      resizeMode="contain"
      style={{
        position: 'absolute', left: x, top: y, width: size, height: size,
        transform: [
          { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
          { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
        ],
      }}
    />
  );
}
