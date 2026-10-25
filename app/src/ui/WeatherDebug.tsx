import { StyleSheet, Text } from 'react-native';

import type { OutdoorWeather } from '../domain/weather';
import { useScheme } from '../theme/theme';

// TODO: Open-Meteoの取得確認用の仮表示。外の天気の表示を作ったら消す。
export function WeatherDebug({ weather, loading, label }: { weather: OutdoorWeather | null; loading: boolean; label: string }) {
  const scheme = useScheme();
  const time = (iso: string) => new Date(iso).toLocaleString('ja-JP');
  const lines = loading ? ['取得中…'] : weather === null ? ['外の天気なし'] : [
    `気温 ${weather.temperatureC}℃ / 湿度 ${weather.relativeHumidityPercent}%`,
    `降水量 ${weather.precipitationMm}mm / 風速 ${weather.windSpeedMps}m/s / ${weather.isDay ? '昼' : '夜'}`,
    `観測 ${time(weather.observedAt)}`,
    `取得 ${time(weather.fetchedAt)}`,
  ];
  return <Text style={[styles.text, { color: scheme.onSurfaceVariant }]}>{[`[debug] ${label}`, ...lines].join('\n')}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
