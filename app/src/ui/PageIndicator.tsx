import { Animated, StyleSheet, View } from 'react-native';

import { corner, space, useScheme } from '../theme/theme';

const DOT = 8;
const ACTIVE = 24;

/**
 * ページ位置を示す唯一のナビゲーション要素。画面下に固定し、page（スクロール量 / 画面幅）に合わせて
 * pill が隣の点へ伸び縮みする。
 */
export function PageIndicator({ count, page }: { count: number; page: Animated.AnimatedInterpolation<number> }) {
  const scheme = useScheme();
  return (
    <View
      style={[styles.container, { backgroundColor: scheme.surfaceContainerHigh }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {Array.from({ length: count }, (_, i) => {
        const inputRange = [i - 1, i, i + 1];
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: page.interpolate({ inputRange, outputRange: [DOT, ACTIVE, DOT], extrapolate: 'clamp' }),
                backgroundColor: page.interpolate({
                  inputRange,
                  outputRange: [scheme.onSurfaceVariant, scheme.primary, scheme.onSurfaceVariant],
                  extrapolate: 'clamp',
                }),
                opacity: page.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s8,
    paddingHorizontal: space.s16,
    paddingVertical: space.s12,
    borderRadius: corner.full,
  },
  dot: { height: DOT, borderRadius: corner.full },
});
