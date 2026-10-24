import { useEffect, useState } from 'react';

import type { Measurement } from '../domain/measurement';
import type { MoldPrediction, MoldPredictor } from '../domain/prediction';

interface PredictionState {
  readonly input: readonly Measurement[];
  readonly predictor: MoldPredictor;
  readonly prediction: MoldPrediction | null;
  readonly status: 'ready' | 'error';
  readonly error: string | null;
}

export function useMoldPrediction(predictor: MoldPredictor, measurements: readonly Measurement[]) {
  const [state, setState] = useState<PredictionState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const base = { input: measurements, predictor, prediction: null, error: null };
    if (measurements.length === 0) return () => controller.abort();

    async function predict() {
      try {
        const prediction = await predictor.predict(measurements, controller.signal);
        if (!controller.signal.aborted) setState({ ...base, prediction, status: 'ready' });
      } catch {
        if (!controller.signal.aborted) {
          setState({ ...base, status: 'error', error: '予測の作成に失敗しました。次のデータ取得時に再試行します。' });
        }
      }
    }

    void predict();
    return () => controller.abort();
  }, [predictor, measurements]);

  // 新しい入力のeffectが実行される前にも、古い入力の予測を表示しない。
  if (measurements.length === 0) {
    return { prediction: null, status: 'idle', error: null } as const;
  }
  if (!state || state.input !== measurements || state.predictor !== predictor) {
    return { prediction: null, status: 'loading', error: null } as const;
  }
  return state;
}
