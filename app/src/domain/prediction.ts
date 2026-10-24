import type { Measurement } from './measurement';

export type MoldRiskLevel = 'low' | 'medium' | 'high';

export interface MoldPrediction {
  /** VTTのカビ指数M（0〜6）。 */
  readonly moldIndex: number;
  readonly riskLevel: MoldRiskLevel;
  /** 今の条件が続いた場合にM=1へ達するまでの日数。生えない条件ならnull、到達済みなら0。 */
  readonly daysToMoldIndex1: number | null;
  /** 連続した観測が7日未満、または長い欠測の直後。M=0から始めた仮定の影響が大きいので参考値。 */
  readonly isProvisional: boolean;
  readonly basedOnReceivedAt: string;
}

export interface MoldPredictor {
  /** 最新順の履歴を受け取る同期的な純粋関数。データ不足ならnull。 */
  predict(measurements: readonly Measurement[]): MoldPrediction | null;
}
