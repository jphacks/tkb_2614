import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

const characters = [
  { source: require('../../assets/character/kabiSmall.png'), size: 72 },
  { source: require('../../assets/character/kabiNormal.png'), size: 104 },
  { source: require('../../assets/character/kabiBig.png'), size: 136 },
];

function MovingCharacter({ source, size, width, height }: {
  source: ImageSourcePropType;
  size: number;
  width: number;
  height: number;
}) {
  const [position] = useState(() => new Animated.ValueXY());
  const fittedSize = Math.min(size, width, height);

  useEffect(() => {
    let stopped = false;
    let animation: Animated.CompositeAnimation | undefined;
    const randomPoint = () => ({
      x: Math.random() * Math.max(0, width - fittedSize),
      y: Math.random() * Math.max(0, height - fittedSize),
    });
    position.setValue(randomPoint());

    function move() {
      animation = Animated.timing(position, {
        toValue: randomPoint(),
        duration: 2200 + Math.random() * 2400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.start(({ finished }) => {
        if (finished && !stopped) move();
      });
    }
    move();
    return () => {
      stopped = true;
      animation?.stop();
    };
  }, [position, width, height, fittedSize]);

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      accessible={false}
      style={{
        position: 'absolute',
        width: fittedSize,
        height: fittedSize,
        transform: position.getTranslateTransform(),
      }}
    />
  );
}

/** CameraView の子にせず、独立したレイヤーに重ねる。 */
export function MovingCharacters() {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      style={styles.container}
      onLayout={({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}
    >
      {bounds.width > 0 && bounds.height > 0 && characters.map((character, index) => (
        <MovingCharacter key={index} {...character} {...bounds} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
