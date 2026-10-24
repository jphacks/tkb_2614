import type { OutdoorWeather, WeatherSource } from '../../domain/weather';

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface OpenMeteoOptions {
  /** 権限がない・取れないときはnull。 */
  readonly getLocation: () => Promise<Coordinates | null>;
  readonly storage: KeyValueStorage;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly cacheMs?: number;
  readonly timeoutMs?: number;
}

export const WEATHER_CACHE_MS = 30 * 60 * 1000;
export const WEATHER_TIMEOUT_MS = 10_000;
const CACHE_KEY = 'weather:v1';
const CURRENT = 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,is_day';

function abortError(): Error {
  const error = new Error('取得を中止しました。');
  error.name = 'AbortError';
  return error;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function weatherUrl({ latitude, longitude }: Coordinates): string {
  // 市区町村レベルで足りるので約1kmに丸め、細かい位置を送らない。
  const lat = latitude.toFixed(2);
  const lon = longitude.toFixed(2);
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${CURRENT}&wind_speed_unit=ms&timezone=auto`;
}

/** Open-Meteoの応答を検証して変換する。形が違えばnull。 */
export function parseOpenMeteo(body: unknown, fetchedAt: Date): OutdoorWeather | null {
  if (typeof body !== 'object' || body === null) return null;
  const { current, utc_offset_seconds: offset } = body as { current?: Record<string, unknown>; utc_offset_seconds?: unknown };
  if (typeof current !== 'object' || current === null || !isFiniteNumber(offset)) return null;
  const { time, temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m, is_day } = current;
  // timezone=autoのtimeは現地時刻（"2026-10-25T14:00"）なので、オフセットを引いてUTCにする。
  const local = typeof time === 'string' ? Date.parse(`${time}Z`) : NaN;
  if (!Number.isFinite(local) || ![temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m].every(isFiniteNumber) ||
    (is_day !== 0 && is_day !== 1)) return null;
  return {
    temperatureC: temperature_2m as number,
    relativeHumidityPercent: Math.min(100, Math.max(0, relative_humidity_2m as number)),
    precipitationMm: precipitation as number,
    windSpeedMps: wind_speed_10m as number,
    isDay: is_day === 1,
    observedAt: new Date(local - offset * 1000).toISOString(),
    fetchedAt: fetchedAt.toISOString(),
  };
}

/** 外の天気はそれほど速く変わらないので、取得から30分はキャッシュを返し、位置もAPIも使わない。 */
export function createOpenMeteoWeatherSource({
  getLocation, storage, fetch: fetchFn = fetch, now = Date.now, cacheMs = WEATHER_CACHE_MS, timeoutMs = WEATHER_TIMEOUT_MS,
}: OpenMeteoOptions): WeatherSource {
  async function readCache(): Promise<OutdoorWeather | null> {
    try {
      const value = await storage.getItem(CACHE_KEY);
      if (value === null) return null;
      const cached: unknown = JSON.parse(value);
      const fetchedAt = typeof (cached as OutdoorWeather)?.fetchedAt === 'string' ? Date.parse((cached as OutdoorWeather).fetchedAt) : NaN;
      // 時計が戻った場合も使わない。
      const age = now() - fetchedAt;
      if (!(age >= 0 && age < cacheMs)) return null;
      return parseCached(cached);
    } catch {
      return null;
    }
  }

  async function request(url: string, signal: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchFn(url, { signal: controller.signal });
      if (!response.ok) return null;
      return await response.json();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  return {
    label: 'Open-Meteo',
    async fetchCurrent(signal) {
      if (signal.aborted) throw abortError();
      const cached = await readCache();
      if (signal.aborted) throw abortError();
      if (cached) return cached;
      try {
        const location = await getLocation();
        if (signal.aborted) throw abortError();
        if (!location) return null;
        const weather = parseOpenMeteo(await request(weatherUrl(location), signal), new Date(now()));
        if (signal.aborted) throw abortError();
        // 失敗はキャッシュしない。次に開いたときに取り直す。
        if (weather) await storage.setItem(CACHE_KEY, JSON.stringify(weather)).catch(() => {});
        return weather;
      } catch {
        if (signal.aborted) throw abortError();
        return null;
      }
    },
  };
}

function parseCached(value: unknown): OutdoorWeather | null {
  if (typeof value !== 'object' || value === null) return null;
  const weather = value as Record<string, unknown>;
  if (![weather.temperatureC, weather.relativeHumidityPercent, weather.precipitationMm, weather.windSpeedMps].every(isFiniteNumber) ||
    typeof weather.isDay !== 'boolean' || typeof weather.observedAt !== 'string' || typeof weather.fetchedAt !== 'string') return null;
  return weather as unknown as OutdoorWeather;
}
