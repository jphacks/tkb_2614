import type { MoldPredictor } from '../../domain/prediction';

/** 配線確認用の固定値。カビの判定基準や予測モデルは実装していない。 */
export const placeholderMoldPredictor: MoldPredictor = {
  predict(measurements) {
    const latest = measurements[0];
    if (!latest || latest.measuredAt === null || latest.temperatureC === null || latest.relativeHumidityPercent === null) return null;
    return {
      riskLevel: 'medium',
      horizonHours: 24,
      generatedAt: latest.receivedAt,
      basedOnReceivedAt: latest.receivedAt,
      isPlaceholder: true,
    };
  },
};