import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBleMeasurementSource } from '../data/ble/BleMeasurementSource';
import { createMeasurementStore } from '../data/measurementStore';
import { createMockMeasurementSource } from '../data/mock/MockMeasurementSource';
import { createMockWeatherSource } from '../data/mock/MockWeatherSource';
import { getCoarseLocation } from '../data/weather/deviceLocation';
import { createOpenMeteoWeatherSource } from '../data/weather/OpenMeteoWeatherSource';
import type { MeasurementSource } from '../domain/measurement';
import { createVttMoldPredictor } from '../domain/moldModel';
import type { MoldPredictor } from '../domain/prediction';
import type { WeatherSource } from '../domain/weather';
import { createMeasurementSync } from './syncMeasurements';

export interface AppServices {
  readonly measurementSource: MeasurementSource;
  readonly weatherSource: WeatherSource;
  readonly moldPredictor: MoldPredictor;
  readonly syncMeasurements: ReturnType<typeof createMeasurementSync>;
}

/** スキャンから受信完了までにかける時間。1年分（約8,800件）でも収まる長さにする。 */
const BLE_TIMEOUT_MS = 60_000;

/** 取得元・永続化・予測処理の差し替え場所。EXPO_PUBLIC_MEASUREMENT_SOURCE=mock ならモック（Expo Go用）。 */
export function createAppServices(): AppServices {
  const useMock = process.env.EXPO_PUBLIC_MEASUREMENT_SOURCE === 'mock';
  const measurementSource = useMock ? createMockMeasurementSource({ delayMs: 300, failEvery: 0 }) : createBleMeasurementSource();
  return {
    measurementSource,
    weatherSource: useMock
      ? createMockWeatherSource({ delayMs: 300 })
      : createOpenMeteoWeatherSource({ getLocation: getCoarseLocation, storage: AsyncStorage }),
    moldPredictor: createVttMoldPredictor(),
    syncMeasurements: createMeasurementSync(measurementSource, createMeasurementStore(AsyncStorage), useMock ? undefined : BLE_TIMEOUT_MS),
  };
}
