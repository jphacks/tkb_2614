import { createMockMeasurementSource } from '../data/mock/MockMeasurementSource';
import { placeholderMoldPredictor } from '../data/mock/PlaceholderMoldPredictor';
import type { MeasurementSource } from '../domain/measurement';
import type { MoldPredictor } from '../domain/prediction';

export interface AppServices {
  readonly measurementSource: MeasurementSource;
  readonly moldPredictor: MoldPredictor;
}

/** 取得元と予測処理の差し替え場所。画面には具体的な実装を持たせない。 */
export function createAppServices(): AppServices {
  return {
    measurementSource: createMockMeasurementSource({
      delayMs: 300,
      failEvery: 0,
    }),
    moldPredictor: placeholderMoldPredictor,
  };
}
