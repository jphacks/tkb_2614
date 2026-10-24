import type { Measurement } from './measurement';

export type MoldRiskLevel = 'low' | 'medium' | 'high';

export interface MoldPrediction {
  readonly riskLevel: MoldRiskLevel;
  readonly horizonHours: number;
  readonly generatedAt: string;
  readonly basedOnReceivedAt: string;
  readonly isPlaceholder: boolean;
}

export interface MoldPredictor {
  /** 最新順の履歴を受け取る。データ不足ならnull、失敗時はrejectする。 */
  predict(
    measurements: readonly Measurement[],
    signal: AbortSignal,
  ): Promise<MoldPrediction | null>;
}
