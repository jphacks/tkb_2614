/**
 * 温度と相対湿度から求める湿度の値。カビモデルと窓の開閉判定で同じ式（Magnus 式、係数 6.112 / 17.62 / 243.12）を使い、
 * 同じ温湿度で水蒸気の量が食い違わないようにする。
 *
 * `Measurement` は欠測を null で持つので、saturationVaporPressureHpa 以外は null を受け取り、null を返す。
 * 入力が null・非有限・範囲外（温度が MIN_TEMPERATURE_C〜MAX_TEMPERATURE_C の外、相対湿度が 0〜100% の外）のときも
 * null を返す。範囲外の値はセンサーや API の異常とみなし、丸めて計算を続けない。
 */

const MAGNUS_A_HPA = 6.112;
const MAGNUS_B = 17.62;
const MAGNUS_C = 243.12;
/** Magnus 式のこの係数が合わせてある範囲（おおよそ −45〜60℃）に収まる、計算を受け付ける温度 [℃]。 */
export const MIN_TEMPERATURE_C = -40;
export const MAX_TEMPERATURE_C = 60;
/** 水蒸気の気体定数 461.5 J/(kg·K) から、e[hPa] を g/m³ に直す係数（100 / 461.5 × 1000）。 */
const ABSOLUTE_HUMIDITY_FACTOR = 216.7;

function isTemperature(tempC: number | null): tempC is number {
  return tempC !== null && Number.isFinite(tempC) && tempC >= MIN_TEMPERATURE_C && tempC <= MAX_TEMPERATURE_C;
}

function isRelativeHumidity(rh: number | null): rh is number {
  return rh !== null && Number.isFinite(rh) && rh >= 0 && rh <= 100;
}

/** 飽和水蒸気圧 [hPa]。tempC は ℃。カビモデルの表面計算が使うので、ここだけ null や範囲を確かめない。 */
export function saturationVaporPressureHpa(tempC: number) {
  return MAGNUS_A_HPA * Math.exp((MAGNUS_B * tempC) / (MAGNUS_C + tempC));
}

/** 水蒸気圧 [hPa]。tempC は ℃、rh は相対湿度 [%]。空気を温めても冷やしても（結露しない限り）変わらない。 */
export function vaporPressureHpa(tempC: number | null, rh: number | null) {
  if (!isTemperature(tempC) || !isRelativeHumidity(rh)) return null;
  return saturationVaporPressureHpa(tempC) * (rh / 100);
}

/** 露点 [℃]。tempC は ℃、rh は相対湿度 [%]。Magnus 式の逆関数。rh=0 では露点がないので null。 */
export function dewPoint(tempC: number | null, rh: number | null) {
  const e = vaporPressureHpa(tempC, rh);
  if (e === null || e <= 0) return null;
  const gamma = Math.log(e / MAGNUS_A_HPA);
  return (MAGNUS_C * gamma) / (MAGNUS_B - gamma);
}

/**
 * sourceTempC ℃・sourceRh % の空気を、水蒸気圧を変えずに targetTempC ℃ まで温めた（冷やした）ときの相対湿度 [%]。
 * 冷やして 100% を超える分は結露して空気から抜けるので、100 で頭打ちにする。
 */
export function relativeHumidityAt(targetTempC: number | null, sourceTempC: number | null, sourceRh: number | null) {
  const e = vaporPressureHpa(sourceTempC, sourceRh);
  if (e === null || !isTemperature(targetTempC)) return null;
  return Math.min((e / saturationVaporPressureHpa(targetTempC)) * 100, 100);
}

/**
 * 絶対湿度 [g/m³]。tempC は ℃、rh は相対湿度 [%]。表示や説明用で、判定には使わない。
 * 空気を温めると体積が増えて g/m³ が下がるので、温度の違う空気の比較には vaporPressureHpa を使う。
 */
export function absoluteHumidity(tempC: number | null, rh: number | null) {
  const e = vaporPressureHpa(tempC, rh);
  if (e === null || !isTemperature(tempC)) return null;
  return (ABSOLUTE_HUMIDITY_FACTOR * e) / (tempC + 273.15);
}
