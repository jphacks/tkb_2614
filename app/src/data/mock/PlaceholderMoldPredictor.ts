import type { MoldPredictor } from '../../domain/prediction';

/** 配線確認用の固定値。カビの判定基準や予測モデルは実装していない。 */
export const placeholderMoldPredictor: MoldPredictor = {
  async predict(measurements, signal) {
    const latest = measurements[0];
    if (signal.aborted || !latest) return null;

    return {
      riskLevel: 'medium',
      horizonHours: 24,
      generatedAt: new Date().toISOString(),
      basedOnReceivedAt: latest.receivedAt,
      isPlaceholder: true,
    };
  },
};
