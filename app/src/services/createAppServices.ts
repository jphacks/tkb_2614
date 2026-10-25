import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAutoMeasurementSource } from '../data/ble/AutoMeasurementSource';
import { createMeasurementStore } from '../data/measurementStore';
import { createMockMeasurementSource } from '../data/mock/MockMeasurementSource';
import { createMockWeatherSource } from '../data/mock/MockWeatherSource';
import { mockScenarios, type MockScenario } from '../data/mock/samples';
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
  /** 選んだ温湿度計を忘れ、次の同期で近くの温湿度計を探し直す。モックでは undefined。 */
  readonly forgetDevice?: () => Promise<void>;
}

/** スキャンから受信完了までにかける時間。1年分（約8,800件）でも収まる長さにする。 */
const BLE_TIMEOUT_MS = 60_000;

/**
 * EXPO_PUBLIC_MOCK_SCENARIO（low / medium / high）のデータで、historyDays 日前のローカル時刻の0時を起点に作る。
 * samples の添字がそのまま時刻になり、グラフで昼に暖かく夜に湿る形になる。
 */
function createScenarioSource(scenario: MockScenario) {
  const { samples, historyDays } = mockScenarios[scenario];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - historyDays);
  const epoch = start.getTime();
  return createMockMeasurementSource({ samples, delayMs: 300, failEvery: 0, epoch, deviceId: `mock-room-${scenario}` });
}

/**
 * 取得元・永続化・予測処理の差し替え場所。EXPO_PUBLIC_MEASUREMENT_SOURCE=mock ならモック（Expo Go用）。
 * 天気は EXPO_PUBLIC_WEATHER_SOURCE（mock / open-meteo）で個別に選べる。未指定なら計測と同じにする。
 * expo-location は Expo Go に含まれるので、計測はモックのまま Open-Meteo を試せる。
 * モックのときは EXPO_PUBLIC_MOCK_SCENARIO（low / medium / high）でカビリスクの段階ごとのデータに切り替えられる。
 */
export function createAppServices(): AppServices {
  const useMock = process.env.EXPO_PUBLIC_MEASUREMENT_SOURCE === 'mock';
  const weatherSource = process.env.EXPO_PUBLIC_WEATHER_SOURCE;
  const useMockWeather = weatherSource === 'mock' || (weatherSource !== 'open-meteo' && useMock);
  const scenario = process.env.EXPO_PUBLIC_MOCK_SCENARIO;
  const autoSource = useMock ? undefined : createAutoMeasurementSource(AsyncStorage);
  const measurementSource = autoSource
    ?? (scenario && scenario in mockScenarios
      ? createScenarioSource(scenario as MockScenario)
      : createMockMeasurementSource({ delayMs: 300, failEvery: 0 }));
  return {
    forgetDevice: autoSource?.forget,
    measurementSource,
    weatherSource: useMockWeather
      ? createMockWeatherSource({ delayMs: 300 })
      : createOpenMeteoWeatherSource({ getLocation: getCoarseLocation, storage: AsyncStorage }),
    moldPredictor: createVttMoldPredictor(),
    syncMeasurements: createMeasurementSync(measurementSource, createMeasurementStore(AsyncStorage), useMock ? undefined : BLE_TIMEOUT_MS),
  };
}

let shared: AppServices | undefined;
/** 画面とバックグラウンドのタスクで同じものを使い、同期を直列にする（BLE のスキャンを重ねない）。 */
export const getAppServices = () => (shared ??= createAppServices());
