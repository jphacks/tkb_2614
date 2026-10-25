/** 正規化済みの履歴。計測時刻が主キー。欠測はnullで保持する。 */
export interface Measurement {
  readonly deviceId: string;
  readonly temperatureC: number | null;
  readonly relativeHumidityPercent: number | null;
  readonly measuredAt: string;
  readonly receivedAt: string;
}

export interface MeasurementSource {
  readonly label: string;
  readonly deviceId: string;
  /** since以上（nullなら全件）の履歴を古い順に返す。同じ記録を何度返してもよい。 */
  fetchSince(since: Date | null, signal: AbortSignal): Promise<readonly Measurement[]>;
}

/** これより古い計測値は古いとみなす。計測は1時間ごとなので、1回取りこぼしたら古い。 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** 欠測でない計測のうち、計測時刻が一番新しいもの。 */
export function latestValid(measurements: readonly Measurement[]) {
  let latest: (Measurement & { temperatureC: number; relativeHumidityPercent: number }) | null = null;
  for (const record of measurements) {
    if (record.temperatureC === null || record.relativeHumidityPercent === null) continue;
    if (latest === null || Date.parse(record.measuredAt) > Date.parse(latest.measuredAt)) {
      latest = { ...record, temperatureC: record.temperatureC, relativeHumidityPercent: record.relativeHumidityPercent };
    }
  }
  return latest;
}
