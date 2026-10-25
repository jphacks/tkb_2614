import { relativeHumidityAt, vaporPressureHpa } from './humidity';
import { type Measurement, STALE_AFTER_MS } from './measurement';
import { criticalHumidity } from './moldModel';
import { ROOM_SPOTS, type SpotId, type SpotPredictions } from './roomSpots';
import type { OutdoorWeather } from './weather';

export type VentilationAdvice =
  /**
   * 開けると乾く。predictedIndoorRh は、室内の空気が外の空気に全部入れ替わり、室温まで温まった（冷えた）ときの相対湿度 [%]。
   * 実際は壁や家具が水分を吸ったり吐いたりするので、そこまでは下がらない。
   */
  | { readonly kind: 'open'; readonly brief: false; readonly predictedIndoorRh: number }
  /** 外が寒いので、5〜10分だけ開ける。全部入れ替わったときの値は 20% 台になり、短時間の換気の結果として誤解を招くので持たない。 */
  | { readonly kind: 'open'; readonly brief: true }
  /** 外のほうが湿っている。 */
  | { readonly kind: 'close'; readonly reason: 'outdoorWetter' }
  /** 開けると乾くとしても、今は勧めない。 */
  | { readonly kind: 'keep'; readonly reason: 'rain' | 'wind' | 'night' | 'hot' }
  /** 何も言わない。 */
  | { readonly kind: 'none' };

/**
 * 室内のほうがこれ以上水蒸気圧が高いときだけ、開けると乾くとみなす [hPa]。
 * 前の判定の「絶対湿度 1 g/m³」を水蒸気圧に直した値。e[hPa] = AH[g/m³] × (T + 273.15) / 216.7 なので、
 * 1 g/m³ は 10℃ で 1.31 hPa、20℃ で 1.35 hPa になる。
 */
export const VAPOR_PRESSURE_THRESHOLD_HPA = 1.3;
/** 雨とみなす直前15分間の降水量 [mm]。これを超えたら雨。 */
export const RAIN_THRESHOLD_MM = 0;
/** 強風とみなす風速 [m/s]。物が飛ばされ、窓を開けていられない強さ。 */
export const STRONG_WIND_MPS = 10;
/**
 * 夜間とみなす時計の時刻（端末のローカル時刻、NIGHT_START_HOUR 時 〜 NIGHT_END_HOUR 時）。
 * Open-Meteo の is_day は使わない。冬は17時前から夜になり、夕方の換気を止めてしまうため。
 */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
/** これを超える外気は、乾くとしても入れると暑すぎる [℃]。 */
export const HOT_OUTDOOR_C = 33;
/**
 * 取得からこれより経った外の天気は使わず、天気がないときと同じに扱う。雨・気温・湿度は1時間もあれば変わる。
 * 取得元のキャッシュは30分で、useOutdoorWeather は起動時とフォアグラウンド復帰時にしか取り直さないので、
 * アプリを開いたままにすると、何時間も前の天気で「開けよう」と言ってしまう。
 * 観測時刻（observedAt）は Open-Meteo では15分ごと、モックでは正時に切り下げられるので、取得時刻（fetchedAt）で測る。
 */
export const WEATHER_STALE_AFTER_MS = 60 * 60 * 1000;
/** これ未満の外気なら短時間だけ開ける [℃]。冬の冷たい外気は水蒸気が少なく、短時間でも入れ替えれば結露を減らすのに一番効く。 */
export const BRIEF_BELOW_OUTDOOR_C = 5;

/** 欠測でない計測のうち、計測時刻が一番新しいもの。 */
function latestValid(measurements: readonly Measurement[]) {
  let latest: { temperatureC: number; relativeHumidityPercent: number; measuredAt: string } | null = null;
  for (const { temperatureC, relativeHumidityPercent, measuredAt } of measurements) {
    if (temperatureC === null || relativeHumidityPercent === null) continue;
    if (latest === null || Date.parse(measuredAt) > Date.parse(latest.measuredAt)) latest = { temperatureC, relativeHumidityPercent, measuredAt };
  }
  return latest;
}

/** 窓が結露しているか、今の表面 RH が臨界湿度以上のスポット。ROOM_SPOTS の順に返す。 */
export function riskySpots(spots: SpotPredictions): SpotId[] {
  return ROOM_SPOTS.map(({ id }) => id).filter((id) => {
    const spot = spots[id];
    if (spot === null) return false;
    if (id === 'window' && spots.window?.isCondensing) return true;
    return spot.currentSurface.relativeHumidityPercent >= criticalHumidity(spot.currentSurface.temperatureC);
  });
}

function isNight(now: number) {
  const hour = new Date(now).getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function keepReason(weather: OutdoorWeather, now: number) {
  if (weather.precipitationMm > RAIN_THRESHOLD_MM) return 'rain';
  if (weather.windSpeedMps >= STRONG_WIND_MPS) return 'wind';
  if (isNight(now)) return 'night';
  if (weather.temperatureC > HOT_OUTDOOR_C) return 'hot';
  return null;
}

/**
 * 窓をどうすべきか。上のルールから順に当てはめ、最初に当てはまったもので決める。
 * measurements は最新順の室内の履歴、spots は predictSpots(measurements, 外気温) の結果、now は判定する時刻（ミリ秒）。
 */
export function adviseVentilation(
  measurements: readonly Measurement[],
  spots: SpotPredictions,
  weather: OutdoorWeather | null,
  now: number,
): VentilationAdvice {
  // 1. 室内の計測値が古い、または外の天気がない（古い）。取得時刻が読めない天気も古いとみなす。
  const indoor = latestValid(measurements);
  if (indoor === null || weather === null || now - Date.parse(indoor.measuredAt) > STALE_AFTER_MS) return { kind: 'none' };
  if (!(now - Date.parse(weather.fetchedAt) <= WEATHER_STALE_AFTER_MS)) return { kind: 'none' };
  // 2. 窓が結露しておらず、どのスポットでもカビが育たない。
  if (riskySpots(spots).length === 0) return { kind: 'none' };
  // 3. 外と室内を水蒸気圧で比べる。温度の違う空気の絶対湿度は、温めると体積が増えて下がるので、そのままは比べられない。
  const indoorHpa = vaporPressureHpa(indoor.temperatureC, indoor.relativeHumidityPercent);
  const outdoorHpa = vaporPressureHpa(weather.temperatureC, weather.relativeHumidityPercent);
  if (indoorHpa === null || outdoorHpa === null) return { kind: 'none' };
  if (outdoorHpa > indoorHpa) return { kind: 'close', reason: 'outdoorWetter' };
  if (indoorHpa - outdoorHpa < VAPOR_PRESSURE_THRESHOLD_HPA) return { kind: 'none' };
  // 4. 乾くとしても今は勧めない。
  const reason = keepReason(weather, now);
  if (reason !== null) return { kind: 'keep', reason };
  // 5. 外が寒いので短時間だけ。
  if (weather.temperatureC < BRIEF_BELOW_OUTDOOR_C) return { kind: 'open', brief: true };
  // 6. 開けると乾く。
  const predictedIndoorRh = relativeHumidityAt(indoor.temperatureC, weather.temperatureC, weather.relativeHumidityPercent);
  if (predictedIndoorRh === null) return { kind: 'none' };
  return { kind: 'open', brief: false, predictedIndoorRh };
}
