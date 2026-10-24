import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { type, useScheme } from '../theme/theme';
import type { ReadingState } from './homeState';

/** 見出しは付けず、単位の % で湿度とわかるようにする。古い値は色を落とすだけで、時刻は出さない。 */
export function Reading({ state }: { state: ReadingState }) {
  const scheme = useScheme();
  if (state.kind === 'searching') {
    return (
      <View style={styles.searching}>
        <ActivityIndicator size="large" color={scheme.primary} accessibilityLabel="デバイスを探しています" />
      </View>
    );
  }
  const value = state.kind === 'empty' ? '–' : Math.round(state.humidity).toString();
  const color = state.kind === 'live' ? scheme.onSurface : scheme.outline;
  const label = state.kind === 'empty' ? '湿度 不明' : `湿度 ${value}%${state.kind === 'stale' ? '（前回の値）' : ''}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Text style={[type.reading, { color }]}>{value}</Text>
      <Text style={[type.readingUnit, styles.unit, { color: state.kind === 'live' ? scheme.onSurfaceVariant : scheme.outline }]}>%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  unit: { marginBottom: 8 },
  searching: { height: type.reading.lineHeight, justifyContent: 'center' },
});
