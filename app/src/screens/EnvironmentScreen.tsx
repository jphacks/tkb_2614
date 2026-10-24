import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MoldRiskLevel } from '../domain/prediction';
import { useMeasurements } from '../hooks/useMeasurements';
import { useMoldPrediction } from '../hooks/useMoldPrediction';
import type { AppServices } from '../services/createAppServices';

const statusLabels = {
  loading: 'データを取得中…',
  ready: '取得済み・自動更新中',
  error: '取得に失敗・自動再試行待ち',
  paused: 'バックグラウンドのため同期を停止中',
};
const riskLabels: Record<MoldRiskLevel, string> = { low: '低', medium: '中', high: '高' };

function formatTime(timestamp: string | null) {
  return timestamp === null ? '不明' : new Date(timestamp).toLocaleString('ja-JP');
}

export function EnvironmentScreen({ services }: { services: AppServices }) {
  const { measurements, status, error, refresh } = useMeasurements(services);
  const predictionState = useMoldPrediction(services.moldPredictor, measurements);
  const latest = measurements[0];
  const prediction = predictionState.prediction;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>室内環境</Text>
        <Text>取得元: {services.measurementSource.label}</Text>
        <Text>状態: {statusLabels[status]}</Text>
        {status === 'loading' && <ActivityIndicator accessibilityLabel="データを取得中" />}
        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <Button title="今すぐ同期" onPress={refresh} disabled={status === 'loading' || status === 'paused'} />

        <View style={styles.section}>
          <Text style={styles.heading}>最新の取得値{latest && status !== 'ready' ? '（前回取得値）' : ''}</Text>
          {latest ? (
            <>
              <Text>デバイス: {latest.deviceId}</Text>
              <Text>温度: {(latest.temperatureC === null ? '欠測' : latest.temperatureC.toFixed(1))} °C</Text>
              <Text>相対湿度: {(latest.relativeHumidityPercent === null ? '欠測' : latest.relativeHumidityPercent.toFixed(1))} %</Text>
              <Text>計測時刻: {formatTime(latest.measuredAt)}</Text>
              <Text>受信時刻: {formatTime(latest.receivedAt)}</Text>
            </>
          ) : <Text>まだ計測データがありません。</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>カビリスク予測</Text>
          {predictionState.error && <Text style={styles.error}>{predictionState.error}</Text>}
          {prediction ? (
            <>
              <Text>{prediction.horizonHours}時間後のリスク: {riskLabels[prediction.riskLevel]}</Text>
              {prediction.isPlaceholder && <Text>仮の固定値です。実際の判定・予測は未実装です。</Text>}
              <Text>元データ受信時刻: {formatTime(prediction.basedOnReceivedAt)}</Text>
            </>
          ) : !predictionState.error && <Text>予測データがありません。</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>計測履歴（{measurements.length}件）</Text>
          <Text>端末に保存済み・最新順（画面は最新30件）</Text>
          {measurements.slice(0, 30).map((measurement) => (
            <Text key={`${measurement.deviceId}-${measurement.seq}`} style={styles.historyItem}>
              {formatTime(measurement.measuredAt)}{'\n'}
              {(measurement.temperatureC === null ? '欠測' : measurement.temperatureC.toFixed(1))} °C / {(measurement.relativeHumidityPercent === null ? '欠測' : measurement.relativeHumidityPercent.toFixed(1))} %
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  section: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 16, gap: 4 },
  error: { color: '#a00000' },
  historyItem: { marginTop: 8 },
});
