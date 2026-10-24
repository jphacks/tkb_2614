import type { MoldPredictor, MoldRiskLevel } from './prediction';

/** Magnus式の飽和水蒸気圧 [hPa]。 */
export function saturationVaporPressureHpa(temperatureC: number) {
  return 6.112 * Math.exp((17.62 * temperatureC) / (243.12 + temperatureC));
}

/** 部屋の水蒸気量のまま、表面が部屋よりdeltaC℃低いと仮定した表面の温湿度。 */
export function surfaceConditions(temperatureC: number, relativeHumidityPercent: number, deltaC: number, humidityOffsetPercent: number) {
  const surfaceTemperatureC = temperatureC - deltaC;
  const ratio = saturationVaporPressureHpa(temperatureC) / saturationVaporPressureHpa(surfaceTemperatureC);
  return { temperatureC: surfaceTemperatureC, relativeHumidityPercent: Math.min((relativeHumidityPercent + humidityOffsetPercent) * ratio, 100) };
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

/** VTTモデル（Ojanenら2010、敏感クラス）。docs/mold-model.mdを参照。 */
export function createVttMoldPredictor({ surfaceDeltaC = 3, humidityOffsetPercent = 0, cmat = 0.5 } = {}): MoldPredictor {
  return {
    predict(measurements) {
      let moldIndex = 0;
      let unfavorableHours = 0;
      let current: ReturnType<typeof surfaceConditions> | null = null;
      // ponytail: 1レコード=1時間とみなし欠測は飛ばす。長い欠測を扱うならmeasuredAtの差分でdtを取る
      for (let i = measurements.length - 1; i >= 0; i--) {
        const { temperatureC, relativeHumidityPercent } = measurements[i];
        if (temperatureC === null || relativeHumidityPercent === null) continue;
        current = surfaceConditions(temperatureC, relativeHumidityPercent, surfaceDeltaC, humidityOffsetPercent);
        const growth = growthConditions(current.temperatureC, current.relativeHumidityPercent);
        let ratePerDay: number;
        if (growth) {
          unfavorableHours = 0;
          const k1 = moldIndex < 1 ? 0.578 : 0.386;
          const k2 = Math.max(1 - Math.exp(2.3 * (moldIndex - growth.maxIndex)), 0);
          ratePerDay = (k1 * k2) / growth.days;
        } else {
          unfavorableHours++;
          ratePerDay = unfavorableHours <= 6 ? -0.032 * cmat : unfavorableHours <= 24 ? 0 : -0.016 * cmat;
        }
        moldIndex = Math.max(moldIndex + ratePerDay / 24, 0);
      }
      if (current === null) return null;

      const growth = growthConditions(current.temperatureC, current.relativeHumidityPercent);
      // M<1の間はk2≈1とみなし、残り(1−M)を一定速度で成長する。
      const daysToMoldIndex1 = moldIndex >= 1 ? 0 : growth && growth.maxIndex > 1 ? ((1 - moldIndex) * growth.days) / 0.578 : null;
      return { moldIndex, riskLevel: riskLevel(moldIndex), daysToMoldIndex1, basedOnReceivedAt: measurements[0].receivedAt };
    },
  };
}
