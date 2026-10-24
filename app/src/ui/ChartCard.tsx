import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { Measurement } from '../domain/measurement';
import { corner, space, type, useScheme } from '../theme/theme';
import { buildChart, HUMIDITY_DANGER_PERCENT, type ChartKind } from './chartGeometry';

const PLOT_HEIGHT = 140;
/** 右端の余白。危険帯の境界の数字を、線や最新の点と重ならない位置に置く。 */
const GUTTER = 48;
/** 端の点が切れないよう、Svg をカードの余白側へはみ出させる幅。最新の点の半径と同じ。 */
const INSET = 6;
const AXIS_GAP = space.s8;
const BAND_RADIUS = 8;
const AXIS_Y = INSET + PLOT_HEIGHT + AXIS_GAP + type.label.fontSize;
const SVG_HEIGHT = AXIS_Y + INSET;

const ICONS: Record<ChartKind, string> = {
  humidity: 'M12 2.6c-.3 0-.5.1-.7.3C9.4 5 5 10.3 5 14.6 5 18.7 8.1 22 12 22s7-3.3 7-7.4c0-4.3-4.4-9.6-6.3-11.7-.2-.2-.4-.3-.7-.3z',
  temperature: 'M12 2a3 3 0 0 0-3 3v8.4a5 5 0 1 0 6 0V5a3 3 0 0 0-3-3z',
};

function format(kind: ChartKind, value: number) {
  return kind === 'humidity' ? `${Math.round(value)}%` : `${value.toFixed(1)}°`;
}

/** 上の角だけ丸めた矩形。危険帯の下端は境界そのものなので角を付けない。 */
function topRoundedRect(x: number, y: number, width: number, height: number, r: number) {
  return `M${x} ${y + height} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + width - r} Q${x + width} ${y} ${x + width} ${y + r} V${y + height} Z`;
}

/**
 * 直近24hの推移。湿度か温度かは、最新値の横のアイコン（しずく/温度計）と線の色（primary/tertiary）で区別する。
 * 最新値は線から離してヘッダーに置く。縦の細線はローカル時刻の6時間おきで、下に時刻を出す。
 * 湿度は危険帯を error-container で塗り、境界の数字は右の余白に出す。
 */
export function ChartCard({ kind, measurements }: { kind: ChartKind; measurements: readonly Measurement[] }) {
  const scheme = useScheme();
  const [width, setWidth] = useState(0);
  const plot = { left: INSET, top: INSET, width: width - GUTTER, height: PLOT_HEIGHT };
  const chart = buildChart(measurements, kind, plot);
  const color = kind === 'humidity' ? scheme.primary : scheme.tertiary;
  const latest = chart.latest;
  const label = latest ? `${kind === 'humidity' ? '湿度' : '温度'}の直近24時間の推移。最新 ${format(kind, latest.value)}` : undefined;
  const svgWidth = width + 2 * INSET;

  return (
    <View style={[styles.card, { backgroundColor: scheme.surfaceContainer }]} accessible accessibilityLabel={label}>
      <View style={styles.header}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d={ICONS[kind]} fill={color} />
        </Svg>
        <Text style={[type.headline, { color: scheme.onSurface }]}>{latest ? format(kind, latest.value) : ' '}</Text>
      </View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2 * INSET)}>
        {width > 0 && (
          <Svg width={svgWidth} height={SVG_HEIGHT}>
            {chart.dangerY !== null && (
              <>
                <Path d={topRoundedRect(plot.left, plot.top, plot.width, chart.dangerY - plot.top, BAND_RADIUS)} fill={scheme.errorContainer} />
                <SvgText
                  x={plot.left + plot.width + 14}
                  y={chart.dangerY + 5}
                  fill={scheme.onSurfaceVariant}
                  fontFamily={type.label.fontFamily}
                  fontSize={type.label.fontSize}
                >
                  {`${HUMIDITY_DANGER_PERCENT}%`}
                </SvgText>
              </>
            )}
            {chart.grid.map((g) => (
              <Line key={g.x} x1={g.x} x2={g.x} y1={plot.top} y2={plot.top + PLOT_HEIGHT} stroke={scheme.outlineVariant} strokeWidth={1} />
            ))}
            {chart.grid.map((g) => (
              <SvgText
                key={g.x}
                x={g.x}
                y={AXIS_Y}
                textAnchor="middle"
                fill={scheme.onSurfaceVariant}
                fontFamily={type.label.fontFamily}
                fontSize={type.label.fontSize}
              >
                {`${g.hour}時`}
              </SvgText>
            ))}
            {chart.paths.map((d) => (
              <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
            ))}
            {chart.points.map((p, i) => (
              <Circle key={`${i}-${p.x}`} cx={p.x} cy={p.y} r={3} fill={color} />
            ))}
            {latest && <Circle cx={latest.x} cy={latest.y} r={INSET} fill={color} />}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: corner.extraLargeIncreased, padding: space.s24, gap: space.s16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  chart: { height: SVG_HEIGHT, marginHorizontal: -INSET, marginVertical: -INSET },
});
