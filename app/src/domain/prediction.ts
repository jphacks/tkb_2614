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
  /** 最新順の履歴を受け取る同期的な純粋関数。データ不足ならnull。 */
  predict(measurements: readonly Measurement[]): MoldPrediction | null;
}