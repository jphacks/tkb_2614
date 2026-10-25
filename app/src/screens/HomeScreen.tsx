import { StatusBar } from 'expo-status-bar';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { predictSpots } from '../domain/roomSpots';
import { useMeasurements } from '../hooks/useMeasurements';
import { useMoldPrediction } from '../hooks/useMoldPrediction';
import { useNow } from '../hooks/useNow';
import { useWidgetSync } from '../hooks/useWidgetSync';
import type { AppServices } from '../services/createAppServices';
import { SchemeContext, schemeFor, space } from '../theme/theme';
import { deriveHomeState } from '../ui/homeState';
import { PageIndicator } from '../ui/PageIndicator';
import type { CharacterKind } from '../ui/mascot/types';
import { GraphPage } from './GraphPage';
import { MainPage } from './MainPage';
import { RoomPage } from './RoomPage';

const MAIN_PAGE = 1;
const ROOM_PAGE = 2;
const PAGE_COUNT = 3;
// インジケーター（高さ32）の上に空ける余白。
const INDICATOR_AREA = 32 + space.s24;

/** [グラフ] ← [メイン] → [部屋] を横スワイプで行き来する。ボタンもナビゲーションバーも置かない。 */
export function HomeScreen({ services }: { services: AppServices }) {
  const { measurements, status, lastSyncedAt } = useMeasurements(services);
  const { prediction } = useMoldPrediction(services.moldPredictor, measurements);
  const now = useNow(60_000);
  const home = deriveHomeState(measurements, status, prediction, now);
  // 外気温（#19）はまだ取らないので、窓の結露も月別の表で判定する。
  const spots = useMemo(() => predictSpots(measurements, null), [measurements]);
  const scheme = schemeFor(home.risk);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [scrollX] = useState(() => new Animated.Value(width * MAIN_PAGE));
  const [character, setCharacter] = useState<CharacterKind>('mimi');
  useWidgetSync({ measurements, status, prediction, lastSyncedAt, character });
  const [activePage, setActivePage] = useState(MAIN_PAGE);
  // スワイプ中は全ページのキャラの動きを止め、JS の負荷を下げてページ送りを滑らかにする。
  const [paging, setPaging] = useState(false);
  const activePageRef = useRef(MAIN_PAGE);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [initialOffset] = useState(() => ({ x: width * MAIN_PAGE, y: 0 }));
  useLayoutEffect(() => {
    const x = width * activePageRef.current;
    pager.current?.scrollTo({ x, animated: false });
    scrollX.setValue(x);
  }, [width, scrollX]);
  const settle = useCallback(() => {
    setActivePage(activePageRef.current);
    setPaging(false);
  }, []);
  const updateScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false }), [scrollX]);
  const page = useMemo(() => scrollX.interpolate({ inputRange: [0, width], outputRange: [0, 1] }), [scrollX, width]);
  const bottomInset = insets.bottom + space.s16 + INDICATOR_AREA;
  // 部屋ページで2本指が触れている間はページャーを止め、動きかけていたら今のページに戻す。
  const [pagerLocked, setPagerLocked] = useState(false);
  const lockPager = useCallback((locked: boolean) => {
    setPagerLocked(locked);
    if (locked) pager.current?.scrollTo({ x: width * activePageRef.current, animated: true });
  }, [width]);

  return (
    <SchemeContext.Provider value={scheme}>
      {/* dark は文字・アイコンの色を指定する。ライト背景で読めるよう暗色に固定する。 */}
      <StatusBar style="dark" />
      <View style={[styles.root, { backgroundColor: scheme.surface }]}>
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          scrollEnabled={!pagerLocked}
          showsHorizontalScrollIndicator={false}
          contentOffset={initialOffset}
          onLayout={() => {
            pager.current?.scrollTo({ x: width * activePageRef.current, animated: false });
          }}
          onScroll={(event) => {
            updateScroll(event);
            activePageRef.current = Math.max(0, Math.min(PAGE_COUNT - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
          }}
          onScrollBeginDrag={() => setPaging(true)}
          // 離した位置がちょうどページの境目なら慣性のスクロールが起きず、onMomentumScrollEnd が来ない。
          onScrollEndDrag={(event) => {
            if (event.nativeEvent.contentOffset.x % width === 0) settle();
          }}
          onMomentumScrollEnd={settle}
          scrollEventThrottle={16}
        >
          <View style={{ width }}>
            <GraphPage measurements={measurements} topInset={insets.top} bottomInset={bottomInset} />
          </View>
          <View style={{ width }}>
            <MainPage home={home} bottomInset={bottomInset} topInset={insets.top} character={character} onCharacterChange={setCharacter} active={!paging && activePage === MAIN_PAGE} />
          </View>
          <View style={{ width }}>
            <RoomPage spots={spots} onTwoFingers={lockPager} current={activePage === ROOM_PAGE} active={!paging && activePage === ROOM_PAGE} topInset={insets.top} bottomInset={bottomInset} />
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
