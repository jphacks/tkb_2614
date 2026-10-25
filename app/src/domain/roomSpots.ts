import type { Measurement } from './measurement';
import { createVttMoldPredictor, SURFACE_DELTA_BY_MONTH_C, surfaceConditions, uncappedSurfaceRelativeHumidity } from './moldModel';
import type { MoldPrediction, MoldPredictor } from './prediction';

/** 窓の種類 → fRsi。今は単板ガラス・アルミサッシだけ。複層ガラスは将来追加する。 */
export const WINDOW_FRSI = { single: 0.25 } as const;

export const ROOM_SPOTS = [
  { id: 'window', fRsi: WINDOW_FRSI.single }, // 単板ガラス U≈6、Rsi=0.13 で 1−6×0.13≈0.22。サッシを含めて 0.25
  { id: 'shelf', fRsi: 0.6 }, // 家具の裏。空気が流れず、外壁が冷えたまま（仮の値）
  { id: 'bed', fRsi: 0.7 }, // 壁に寄せたベッド。今の月別の表と同じ前提
] as const;

export type SpotId = (typeof ROOM_SPOTS)[number]['id'];

/** SURFACE_DELTA_BY_MONTH_C を作ったときの fRsi。 */
const TABLE_FRSI = 0.7;

/** 月別の表（fRsi=0.7）を、そのスポットの fRsi に換算した ΔT [℃]（1月始まり）。ΔT は (1 − fRsi) に比例する。 */
export function surfaceDeltaByMonthFor(fRsi: number): number[] {
  return SURFACE_DELTA_BY_MONTH_C.map((deltaC) => (deltaC * (1 - fRsi)) / (1 - TABLE_FRSI));
}

export interface SpotPrediction extends MoldPrediction {
  /**
   * 最新の計測値から求めた今の表面の温湿度。#20 の開閉判定で臨界湿度と比べる。
   * 窓は結露判定と同じ ΔT、ほかのスポットは月別の表を換算した ΔT で求める。
   */
  readonly currentSurface: { readonly temperatureC: number; readonly relativeHumidityPercent: number };
}

export interface WindowSpotPrediction extends SpotPrediction {
  /** 最新の計測値で窓の表面が結露しているか。ガラスより、まわりのパッキン・サッシ・カーテンがカビる。 */
  readonly isCondensing: boolean;
}

export type SpotPredictions = { readonly [K in SpotId]: (K extends 'window' ? WindowSpotPrediction : SpotPrediction) | null };

/** 欠測でない計測のうち、計測時刻が一番新しいもの。 */
function latestValid(measurements: readonly Measurement[]) {
  let latest: (Measurement & { temperatureC: number; relativeHumidityPercent: number }) | null = null;
  for (const record of measurements) {
    if (record.temperatureC === null || record.relativeHumidityPercent === null) continue;
    if (latest === null || Date.parse(record.measuredAt) > Date.parse(latest.measuredAt)) {
      latest = { ...record, temperatureC: record.temperatureC, relativeHumidityPercent: record.relativeHumidityPercent };
    }
  }
  return latest;
}

const spotModels = ROOM_SPOTS.map((spot) => {
  const surfaceDeltaByMonthC = surfaceDeltaByMonthFor(spot.fRsi);
  const predictor: MoldPredictor = createVttMoldPredictor({ surfaceDeltaByMonthC });
  return { ...spot, surfaceDeltaByMonthC, predictor };
});

/**
 * スポットごとのカビの予測。M と M=1 までの日数は月別の表を fRsi で換算した ΔT で計算し、外気温は使わない。
 * 窓の結露と今の表面だけは、外気温があれば ΔT = max(0, (1 − fRsi)(室温 − 外気温)) で、なければ月別の表で判定する。
 * measurements は MoldPredictor.predict と同じく最新順。有効な計測がなければ各スポットとも null。
 */
export function predictSpots(measurements: readonly Measurement[], outdoorTemperatureC: number | null): SpotPredictions {
  const latest = latestValid(measurements);
  if (latest === null) return { window: null, shelf: null, bed: null };
  const { temperatureC, relativeHumidityPercent } = latest;
  const month = new Date(latest.measuredAt).getMonth();
  // ROOM_SPOTS の順。有効な計測があるので predict は null にならない。
  const [windowSpot, shelf, bed] = spotModels.map(({ surfaceDeltaByMonthC, predictor }): SpotPrediction => ({
    ...predictor.predict(measurements)!,
    currentSurface: surfaceConditions(temperatureC, relativeHumidityPercent, surfaceDeltaByMonthC[month], 0),
  }));
  const condensationDeltaC = outdoorTemperatureC === null
    ? spotModels[0].surfaceDeltaByMonthC[month]
    : Math.max(0, (1 - WINDOW_FRSI.single) * (temperatureC - outdoorTemperatureC));
  // 露点と比べず、カビモデルの頭打ちと同じ値で比べる。露点ちょうど付近で浮動小数点の誤差により判定が食い違わない。
  const isCondensing = uncappedSurfaceRelativeHumidity(temperatureC, relativeHumidityPercent, condensationDeltaC, 0) >= 100;
  // 窓の今の表面は結露判定と同じ ΔT で求め、表面 RH と isCondensing が食い違わないようにする。
  const currentSurface = surfaceConditions(temperatureC, relativeHumidityPercent, condensationDeltaC, 0);
  return { window: { ...windowSpot, currentSurface, isCondensing }, shelf, bed };
}
