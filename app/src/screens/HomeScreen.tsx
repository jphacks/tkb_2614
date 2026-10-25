import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMeasurements } from '../hooks/useMeasurements';
import { useMoldPrediction } from '../hooks/useMoldPrediction';
import { useNow } from '../hooks/useNow';
import { useWidgetSync } from '../hooks/useWidgetSync';
import type { AppServices } from '../services/createAppServices';
import { SchemeContext, schemeFor, space } from '../theme/theme';
import { deriveHomeState } from '../ui/homeState';
import { PageIndicator } from '../ui/PageIndicator';
import type { CharacterKind } from '../ui/mascot/types';
import { ARPage } from './ARPage';
import { GraphPage } from './GraphPage';
import { MainPage } from './MainPage';

const MAIN_PAGE = 1;
const AR_PAGE = 2;
const PAGE_COUNT = 3;
// インジケーター（高さ32）の上に空ける余白。
const INDICATOR_AREA = 32 + space.s24;

/** [グラフ] ← [メイン] → [AR] を横スワイプで行き来する。ボタンもナビゲーションバーも置かない。 */
export function HomeScreen({ services }: { services: AppServices }) {
  const { measurements, status, lastSyncedAt } = useMeasurements(services);
  const { prediction } = useMoldPrediction(services.moldPredictor, measurements);
  const now = useNow(60_000);
  const home = deriveHomeState(measurements, status, prediction, now);
  const scheme = schemeFor(home.risk);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [scrollX] = useState(() => new Animated.Value(width * MAIN_PAGE));
  const [character, setCharacter] = useState<CharacterKind>('mimi');
  useWidgetSync({ measurements, status, prediction, lastSyncedAt, character });
  const [activePage, setActivePage] = useState(MAIN_PAGE);
  const activePageRef = useRef(MAIN_PAGE);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [initialOffset] = useState(() => ({ x: width * MAIN_PAGE, y: 0 }));
  useLayoutEffect(() => {
    const x = width * activePageRef.current;
    pager.current?.scrollTo({ x, animated: false });
    scrollX.setValue(x);
  }, [width, scrollX]);
  const updateScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false }), [scrollX]);
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
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={initialOffset}
          onLayout={() => {
            pager.current?.scrollTo({ x: width * activePageRef.current, animated: false });
            setArVisible(activePageRef.current === AR_PAGE);
            setArSettled(activePageRef.current === AR_PAGE);
          }}
          onScroll={(event) => {
            updateScroll(event);
            const next = Math.max(0, Math.min(PAGE_COUNT - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
            activePageRef.current = next;
            setActivePage(next);
            // Preserve AR startup while entering the page, and request camera
            // permission only once it is fully in view.
            const x = event.nativeEvent.contentOffset.x;
            setArVisible(x > width * MAIN_PAGE + 1);
            setArSettled(x >= width * AR_PAGE - 1);
          }}
          scrollEventThrottle={16}
        >
          <View style={{ width }}>
            <GraphPage measurements={measurements} topInset={insets.top} bottomInset={bottomInset} />
          </View>
          <View style={{ width }}>
            <MainPage home={home} moldIndex={prediction?.moldIndex ?? null} bottomInset={bottomInset} topInset={insets.top} character={character} onCharacterChange={setCharacter} active={activePage === MAIN_PAGE} />
          </View>
          <View style={{ width }}>
            <ARPage risk={home.risk} mood={home.mood} character={character} isVisible={arVisible} isSettled={arSettled} bottomInset={bottomInset} />
          </View>
        </Animated.ScrollView>
        <View style={[styles.indicator, { bottom: insets.bottom + space.s16 }]} pointerEvents="none">
          <PageIndicator count={PAGE_COUNT} page={page} />
        </View>
      </View>
    </SchemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  indicator: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
