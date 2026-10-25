import type { Measurement } from '../domain/measurement';
import type { MoldPrediction, MoldRiskLevel } from '../domain/prediction';
import type { SyncStatus } from '../hooks/useMeasurements';

export type Mood = 'fine' | 'worried' | 'dizzy' | 'sleep';

export type ReadingState =
  | { readonly kind: 'live' | 'stale'; readonly humidity: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'searching' };

export interface HomeState {
  readonly risk: MoldRiskLevel | null;
  readonly mood: Mood;
  readonly reading: ReadingState;
}

/** これより古い計測値は薄く表示する。計測は1時間ごとなので、1回取りこぼしたら古いとみなす。 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** リスク → 表情。部屋ページのスポットのキャラも同じ対応を使う。 */
export const moods: Record<MoldRiskLevel, Mood> = { low: 'fine', medium: 'worried', high: 'dizzy' };

/** 画面に文言を出さない代わりに、配色・表情・数字の濃さへ状態を割り当てる。 */
export function deriveHomeState(
  measurements: readonly Measurement[],
  status: SyncStatus,
  prediction: MoldPrediction | null,
  now: number,
): HomeState {
  const latest = measurements.find((m) => m.relativeHumidityPercent !== null);
  if (!latest || latest.relativeHumidityPercent === null) {
    return { risk: null, mood: 'sleep', reading: { kind: status === 'loading' ? 'searching' : 'empty' } };
  }
  const stale = status === 'error' || now - Date.parse(latest.measuredAt) > STALE_AFTER_MS;
  const risk = prediction?.riskLevel ?? null;
  return {
    risk,
    mood: risk ? moods[risk] : 'fine',
    reading: { kind: stale ? 'stale' : 'live', humidity: latest.relativeHumidityPercent },
  };
}
