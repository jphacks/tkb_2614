import { StyleSheet, View } from 'react-native';

import type { Measurement } from '../domain/measurement';
import { space } from '../theme/theme';
import { ChartCard } from '../ui/ChartCard';

/** 湿度（メインの数字と同じ順で上）と温度の直近24h。2枚のカードは画面の高さに合わせて伸縮し、上下中央に置く。 */
export function GraphPage({ measurements, topInset, bottomInset }: {
  measurements: readonly Measurement[];
  topInset: number;
  bottomInset: number;
}) {
  return (
    <View style={[styles.page, { paddingTop: topInset + space.s16, paddingBottom: bottomInset }]}>
      <ChartCard kind="humidity" measurements={measurements} />
      <ChartCard kind="temperature" measurements={measurements} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: space.s16, gap: space.s16 },
});
