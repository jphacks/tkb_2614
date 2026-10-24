import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMeasurements } from '../hooks/useMeasurements';
import { useMoldPrediction } from '../hooks/useMoldPrediction';
import { useNow } from '../hooks/useNow';
import type { AppServices } from '../services/createAppServices';
import { SchemeContext, schemeFor, space } from '../theme/theme';
import { deriveHomeState } from '../ui/homeState';
import { PageIndicator } from '../ui/PageIndicator';
import { ARPage } from './ARPage';
import { GraphPage } from './GraphPage';
import { MainPage } from './MainPage';

const MAIN_PAGE = 1;
// インジケーター（高さ32）の上に空ける余白。
const INDICATOR_AREA = 32 + space.s24;

/** [グラフ] ← [メイン] → [AR] を横スワイプで行き来する。ボタンもナビゲーションバーも置かない。 */
export function HomeScreen({ services }: { services: AppServices }) {
  const { measurements, status, refresh } = useMeasurements(services);
  const { prediction } = useMoldPrediction(services.moldPredictor, measurements);
  const now = useNow(60_000);
  const home = deriveHomeState(measurements, status, prediction, now);
  const scheme = schemeFor(home.risk);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [scrollX] = useState(() => new Animated.Value(width * MAIN_PAGE));
  const [arVisible, setArVisible] = useState(false);
  const [arSettled, setArSettled] = useState(false);
  const page = useMemo(() => scrollX.interpolate({ inputRange: [0, width], outputRange: [0, 1] }), [scrollX, width]);
  const bottomInset = insets.bottom + space.s16 + INDICATOR_AREA;

  return (
    <SchemeContext.Provider value={scheme}>
      {/* dark は文字・アイコンの色を指定する。ライト背景で読めるよう暗色に固定する。 */}
      <StatusBar style="dark" />
      <View style={[styles.root, { backgroundColor: scheme.surface }]}>
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: width * MAIN_PAGE, y: 0 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: false,
              listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
                // ARが画面に入り始めたら起動し、メインに戻り切るまで維持する。
                const x = event.nativeEvent.contentOffset.x;
                const visible = x > width * MAIN_PAGE + 1;
                // 権限の要求はARページに着地してから行う。
                const settled = x >= width * (MAIN_PAGE + 1) - 1;
                setArVisible((previous) => previous === visible ? previous : visible);
                setArSettled((previous) => previous === settled ? previous : settled);
              },
            },
          )}
          scrollEventThrottle={16}
        >
          <View style={{ width }}>
            <GraphPage measurements={measurements} topInset={insets.top} bottomInset={bottomInset} />
          </View>
          <View style={{ width }}>
            <MainPage home={home} status={status} onRefresh={refresh} bottomInset={bottomInset} />
          </View>
          <View style={{ width }}>
            <ARPage risk={home.risk} mood={home.mood} isVisible={arVisible} isSettled={arSettled} bottomInset={bottomInset} />
          </View>
        </Animated.ScrollView>
        <View style={[styles.indicator, { bottom: insets.bottom + space.s16 }]} pointerEvents="none">
          <PageIndicator count={3} page={page} />
        </View>
      </View>
    </SchemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  indicator: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
