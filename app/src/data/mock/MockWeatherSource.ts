import type { OutdoorWeather, WeatherSource } from '../../domain/weather';

interface MockWeatherOptions {
  /** nullなら「外の天気なし」（権限拒否・通信失敗）を再現する。 */
  readonly weather?: Omit<OutdoorWeather, 'observedAt' | 'fetchedAt'> | null;
  readonly delayMs?: number;
  readonly now?: () => number;
}

export const mockWeather = {
  temperatureC: 14.2,
  relativeHumidityPercent: 72,
  precipitationMm: 0,
  windSpeedMps: 2.4,
  isDay: true,
} as const;

function abortError(): Error {
  const error = new Error('取得を中止しました。');
  error.name = 'AbortError';
  return error;
}

/** 固定の天気を返す。観測時刻は直前の正時、取得時刻は今。 */
export function createMockWeatherSource({ weather = mockWeather, delayMs = 300, now = Date.now }: MockWeatherOptions = {}): WeatherSource {
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('delayMsは0以上にしてください。');
  const hour = 60 * 60 * 1000;
  return {
    label: 'モックの天気',
    async fetchCurrent(signal) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (signal.aborted) throw abortError();
      if (weather === null) return null;
      const time = now();
      return {
        ...weather,
        observedAt: new Date(Math.floor(time / hour) * hour).toISOString(),
        fetchedAt: new Date(time).toISOString(),
      };
    },
  };
}
