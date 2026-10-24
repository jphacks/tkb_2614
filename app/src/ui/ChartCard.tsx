import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Measurement } from '../domain/measurement';
import { corner, fonts, space, type, useScheme } from '../theme/theme';
import { buildChart, HUMIDITY_DANGER_PERCENT, type ChartKind } from './chartGeometry';

const PADDING = space.s24;

function format(kind: ChartKind, value: number) {
  return kind === 'humidity' ? `${Math.round(value)}%` : `${value.toFixed(1)}°`;
}

/**
 * 直近24hの推移。タイトル・凡例・軸ラベルは置かず、最新値の単位（%/°）と線の色（primary/tertiary）で区別する。
 * 縦の細線は6時間ごと。湿度は危険帯を error-container で塗り、境界の数字だけ出す。
 */
export function ChartCard({ kind, measurements }: { kind: ChartKind; measurements: readonly Measurement[] }) {
  const scheme = useScheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const chart = buildChart(measurements, kind, { ...size, padding: PADDING });
  const color = kind === 'humidity' ? scheme.primary : scheme.tertiary;
  const latest = chart.latest;
  const label = latest ? `${kind === 'humidity' ? '湿度' : '温度'}の直近24時間の推移。最新 ${format(kind, latest.value)}` : undefined;

  return (
    <View
      style={[styles.card, { backgroundColor: scheme.surfaceContainer }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessible
      accessibilityLabel={label}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          {chart.gridX.map((x) => (
            <Line key={x} x1={x} x2={x} y1={0} y2={size.height} stroke={scheme.outlineVariant} strokeWidth={1} />
          ))}
          {chart.dangerY !== null && (
            <>
              <Rect x={0} y={0} width={size.width} height={chart.dangerY} fill={scheme.errorContainer} opacity={0.4} />
              <SvgText x={PADDING} y={chart.dangerY - 8} fill={scheme.onErrorContainer} fontFamily={fonts.medium} fontSize={type.label.fontSize}>
                {`${HUMIDITY_DANGER_PERCENT}%`}
              </SvgText>
            </>
          )}
          {chart.paths.map((d) => (
            <Path key={d} d={d} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {chart.points.map((p, i) => (
            <Circle key={`${i}-${p.x}`} cx={p.x} cy={p.y} r={3} fill={color} />
          ))}
          {latest && (
            <>
              <Circle cx={latest.x} cy={latest.y} r={8} fill={color} stroke={scheme.surfaceContainer} strokeWidth={3} />
              <SvgText
                x={latest.x - 14}
                y={latest.y - 14}
                textAnchor="end"
                fill={scheme.onSurface}
                fontFamily={fonts.medium}
                fontSize={type.label.fontSize}
              >
                {format(kind, latest.value)}
              </SvgText>
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: corner.extraLargeIncreased, overflow: 'hidden' },
});
