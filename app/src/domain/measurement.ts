/** アプリ内の正規化済み計測値。通信上のpayloadとは別の契約。 */
export interface Measurement {
  readonly deviceId: string;
  readonly temperatureC: number;
  readonly relativeHumidityPercent: number;
  readonly measuredAt: string | null;
  readonly receivedAt: string;
}

export interface MeasurementSource {
  readonly label: string;
  readLatest(signal: AbortSignal): Promise<Measurement>;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

/** TypeScriptの型では防げない、取得元からの不正な値を表示前に弾く。 */
export function parseMeasurement(value: unknown): Measurement {
  if (typeof value !== 'object' || value === null) {
    throw new Error('計測データがオブジェクトではありません。');
  }

  const data = value as Record<string, unknown>;
  if (typeof data.deviceId !== 'string' || !data.deviceId.trim()) {
    throw new Error('計測データのdeviceIdが不正です。');
  }
  if (typeof data.temperatureC !== 'number' || !Number.isFinite(data.temperatureC)) {
    throw new Error('温度には有限の数値が必要です。');
  }
  if (
    typeof data.relativeHumidityPercent !== 'number' ||
    !Number.isFinite(data.relativeHumidityPercent) ||
    data.relativeHumidityPercent < 0 ||
    data.relativeHumidityPercent > 100
  ) {
    throw new Error('相対湿度は0〜100の数値である必要があります。');
  }
  if (data.measuredAt !== null && !isUtcTimestamp(data.measuredAt)) {
    throw new Error('計測時刻はUTCのISO 8601形式、またはnullである必要があります。');
  }
  if (!isUtcTimestamp(data.receivedAt)) {
    throw new Error('受信時刻はUTCのISO 8601形式である必要があります。');
  }

  return {
    deviceId: data.deviceId,
    temperatureC: data.temperatureC,
    relativeHumidityPercent: data.relativeHumidityPercent,
    measuredAt: data.measuredAt,
    receivedAt: data.receivedAt,
  };
}
