import type { Measurement } from './measurement';
import type { MoldPredictor, MoldRiskLevel } from './prediction';

/**
 * 壁の隅などの表面が室温より何℃低いか（1月始まり）。ΔT=(1−fRsi)(室温−外気温)をfRsi=0.7・室温20℃・
 * 日本のその時期の外気で概算した。夏は壁が室温と同じか暖かいので0。地域・住宅ごとの差は見ていない。
 */
export const SURFACE_DELTA_BY_MONTH_C: readonly number[] = [4, 4, 3, 1.5, 0, 0, 0, 0, 0, 1.5, 3, 4];
/** これ以下の欠測は直前の条件が続いたとみなす。 */
const MAX_FILL_HOURS = 3;
/** 連続した観測がこれより短いと、M=0から始めた仮定の影響が大きいので参考値とする。 */
const PROVISIONAL_HOURS = 7 * 24;
const FORECAST_LIMIT_HOURS = 365 * 24;
const HOUR_MS = 60 * 60 * 1000;

/** Magnus式の飽和水蒸気圧 [hPa]。 */
export function saturationVaporPressureHpa(temperatureC: number) {
  return 6.112 * Math.exp((17.62 * temperatureC) / (243.12 + temperatureC));
}

/** surfaceConditionsの、100%で頭打ちにする前の表面の相対湿度。100以上なら表面で結露する。 */
export function uncappedSurfaceRelativeHumidity(temperatureC: number, relativeHumidityPercent: number, deltaC: number, humidityOffsetPercent: number) {
  const ratio = saturationVaporPressureHpa(temperatureC) / saturationVaporPressureHpa(temperatureC - deltaC);
  return (relativeHumidityPercent + humidityOffsetPercent) * ratio;
}

/** 部屋の水蒸気量のまま、表面が部屋よりdeltaC℃低いと仮定した表面の温湿度。 */
export function surfaceConditions(temperatureC: number, relativeHumidityPercent: number, deltaC: number, humidityOffsetPercent: number) {
  return {
    temperatureC: temperatureC - deltaC,
    relativeHumidityPercent: Math.min(uncappedSurfaceRelativeHumidity(temperatureC, relativeHumidityPercent, deltaC, humidityOffsetPercent), 100),
  };
}

export function criticalHumidity(temperatureC: number) {
  const t = temperatureC;
  return t > 20 ? 80 : -0.00267 * t ** 3 + 0.16 * t ** 2 - 3.13 * t + 100;
}

/** 成長できる条件なら、k1·k2=1でM=1増えるまでの日数とMmaxを返す。 */
function growthConditions(temperatureC: number, relativeHumidityPercent: number) {
  const critical = criticalHumidity(temperatureC);
  if (temperatureC <= 0 || relativeHumidityPercent < critical) return null;
  const x = (critical - relativeHumidityPercent) / (critical - 100);
  return {
    days: 7 * Math.exp(-0.68 * Math.log(temperatureC) - 13.9 * Math.log(relativeHumidityPercent) + 66.02),
    maxIndex: 0.3 + 6 * x - x ** 2,
  };
}

function riskLevel(moldIndex: number): MoldRiskLevel {
  return moldIndex < 1 ? 'low' : moldIndex < 3 ? 'medium' : 'high';
}

function mean(values: readonly (number | null)[]) {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0) / present.length;
}

/** 計測間隔が1時間より短くても1時間ずつ進めるよう、同じ時台の記録を平均して1件にする。最新順で返す。 */
function toHourly(measurements: readonly Measurement[]): Measurement[] {
  const byHour = new Map<number, Measurement[]>();
  for (const record of measurements) {
    const hour = Math.floor(Date.parse(record.measuredAt) / HOUR_MS);
    const bucket = byHour.get(hour);
    if (bucket) bucket.push(record);
    else byHour.set(hour, [record]);
  }
  return [...byHour].sort(([a], [b]) => b - a).map(([hour, records]) => ({
    deviceId: records[0].deviceId,
    temperatureC: mean(records.map((r) => r.temperatureC)),
    relativeHumidityPercent: mean(records.map((r) => r.relativeHumidityPercent)),
    measuredAt: new Date(hour * HOUR_MS).toISOString(),
    receivedAt: records.map((r) => r.receivedAt).sort().at(-1)!,
  }));
}

function hoursBetween(previous: Measurement, next: Measurement) {
  return Math.round((Date.parse(next.measuredAt) - Date.parse(previous.measuredAt)) / HOUR_MS);
}

type Surface = ReturnType<typeof surfaceConditions>;
interface GrowthState { moldIndex: number; unfavorableHours: number }

/** VTTモデル（Ojanenら2010、敏感クラス）。docs/mold-model.mdを参照。 */
export function createVttMoldPredictor({
  surfaceDeltaByMonthC = SURFACE_DELTA_BY_MONTH_C,
  humidityOffsetPercent = 0,
  cmat = 0.5,
}: { surfaceDeltaByMonthC?: readonly number[]; humidityOffsetPercent?: number; cmat?: number } = {}): MoldPredictor {
  function surfaceOf({ temperatureC, relativeHumidityPercent, measuredAt }: Measurement): Surface | null {
    if (temperatureC === null || relativeHumidityPercent === null) return null;
    const deltaC = surfaceDeltaByMonthC[new Date(measuredAt).getMonth()];
    return surfaceConditions(temperatureC, relativeHumidityPercent, deltaC, humidityOffsetPercent);
  }

  /** Mを1時間分進める。 */
  function step(state: GrowthState, surface: Surface) {
    const growth = growthConditions(surface.temperatureC, surface.relativeHumidityPercent);
    let ratePerDay: number;
    if (growth) {
      state.unfavorableHours = 0;
      const k1 = state.moldIndex < 1 ? 0.578 : 0.386;
      const k2 = Math.max(1 - Math.exp(2.3 * (state.moldIndex - growth.maxIndex)), 0);
      ratePerDay = (k1 * k2) / growth.days;
    } else {
      state.unfavorableHours++;
      ratePerDay = state.unfavorableHours <= 6 ? -0.032 * cmat : state.unfavorableHours <= 24 ? 0 : -0.016 * cmat;
    }
    state.moldIndex = Math.max(state.moldIndex + ratePerDay / 24, 0);
  }

  /** 今の条件が続くとして1時間ずつ進め、M=1に達するまでの日数を求める。 */
  function daysToMoldIndex1(state: GrowthState, surface: Surface) {
    if (state.moldIndex >= 1) return 0;
    const growth = growthConditions(surface.temperatureC, surface.relativeHumidityPercent);
    if (!growth || growth.maxIndex <= 1) return null;
    const future = { ...state };
    for (let hours = 1; hours <= FORECAST_LIMIT_HOURS; hours++) {
      step(future, surface);
      if (future.moldIndex >= 1) return hours / 24;
    }
    return null;
  }

  return {
    predict(records) {
      const measurements = toHourly(records);
      const state: GrowthState = { moldIndex: 0, unfavorableHours: 0 };
      let observedHours = 0;
      let last: { record: Measurement; surface: Surface } | null = null;
      for (let i = measurements.length - 1; i >= 0; i--) {
        const surface = surfaceOf(measurements[i]);
        if (surface === null) continue;
        if (last) {
          const missingHours = Math.max(hoursBetween(last.record, measurements[i]) - 1, 0);
          // 長い欠測の間の温湿度は不明なので、Mは増やしも減らしもしない。
          if (missingHours > MAX_FILL_HOURS) observedHours = 0;
          else for (let h = 0; h < missingHours; h++, observedHours++) step(state, last.surface);
        }
        step(state, surface);
        observedHours++;
        last = { record: measurements[i], surface };
      }
      if (last === null) return null;
      return {
        moldIndex: state.moldIndex,
        riskLevel: riskLevel(state.moldIndex),
        daysToMoldIndex1: daysToMoldIndex1(state, last.surface),
        isProvisional: observedHours < PROVISIONAL_HOURS,
        basedOnReceivedAt: last.record.receivedAt,
      };
    },
  };
}
