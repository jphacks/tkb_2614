import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMeasurementStore } from '../data/measurementStore';
import { createMockMeasurementSource } from '../data/mock/MockMeasurementSource';
import type { MeasurementSource } from '../domain/measurement';
import { createVttMoldPredictor } from '../domain/moldModel';
import type { MoldPredictor } from '../domain/prediction';
import { createMeasurementSync } from './syncMeasurements';

export interface AppServices {
  readonly measurementSource: MeasurementSource;
  readonly moldPredictor: MoldPredictor;
  readonly syncMeasurements: ReturnType<typeof createMeasurementSync>;
}

/** 取得元・永続化・予測処理の差し替え場所。 */
export function createAppServices(): AppServices {
  const measurementSource = createMockMeasurementSource({ delayMs: 300, failEvery: 0 });
  return {
    measurementSource,
    moldPredictor: createVttMoldPredictor(),
    syncMeasurements: createMeasurementSync(measurementSource, createMeasurementStore(AsyncStorage)),
  };
}