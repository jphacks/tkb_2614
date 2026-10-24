import { useMemo } from 'react';
import type { Measurement } from '../domain/measurement';
import type { MoldPredictor } from '../domain/prediction';

export function useMoldPrediction(predictor: MoldPredictor, measurements: readonly Measurement[]) {
  return useMemo(() => {
    try {
      return { prediction: predictor.predict(measurements), error: null };
    } catch {
      return { prediction: null, error: '予測の作成に失敗しました。次の同期時に再試行します。' };
    }
  }, [predictor, measurements]);
}