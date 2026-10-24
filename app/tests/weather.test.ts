import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockWeatherSource } from '../src/data/mock/MockWeatherSource';
import { createOpenMeteoWeatherSource, parseOpenMeteo, weatherUrl, WEATHER_CACHE_MS } from '../src/data/weather/OpenMeteoWeatherSource';

const body = {
  utc_offset_seconds: 32400,
  current: { time: '2026-10-25T14:00', temperature_2m: 16.5, relative_humidity_2m: 68, precipitation: 0.2, wind_speed_10m: 3.1, is_day: 1 },
};
const tokyo = { latitude: 35.68123, longitude: 139.76712 };
const signal = () => new AbortController().signal;

function setup({ location = tokyo as typeof tokyo | null, response = body as unknown, ok = true, fail = false } = {}) {
  const items = new Map<string, string>();
  const calls = { location: 0, fetch: [] as string[] };
  let now = Date.UTC(2026, 9, 25, 5, 10);
  const source = createOpenMeteoWeatherSource({
    getLocation: async () => { calls.location += 1; return location; },
    storage: { async getItem(key) { return items.get(key) ?? null; }, async setItem(key, value) { items.set(key, value); } },
    fetch: (async (url: string) => {
      calls.fetch.push(url);
      if (fail) throw new TypeError('Network request failed');
      return { ok, json: async () => response };
    }) as unknown as typeof fetch,
    now: () => now,
  });
  return { source, calls, items, advance: (ms: number) => { now += ms; } };
}

test('Open-Meteoの応答を変換し、現地時刻をUTCに直す', () => {
  const weather = parseOpenMeteo(body, new Date('2026-10-25T05:10:00Z'));
  assert.deepEqual(weather, {
    temperatureC: 16.5, relativeHumidityPercent: 68, precipitationMm: 0.2, windSpeedMps: 3.1, isDay: true,
    observedAt: '2026-10-25T05:00:00.000Z', fetchedAt: '2026-10-25T05:10:00.000Z',
  });
  assert.equal(parseOpenMeteo({ ...body, current: { ...body.current, temperature_2m: null } }, new Date()), null);
  assert.equal(parseOpenMeteo({ error: true, reason: 'bad' }, new Date()), null);
  assert.match(weatherUrl(tokyo), /latitude=35\.68&longitude=139\.77&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,is_day&wind_speed_unit=ms&timezone=auto$/);
});

test('30分以内はキャッシュを返し、位置もAPIも使わない', async () => {
  const { source, calls, advance } = setup();
  const first = await source.fetchCurrent(signal());
  assert.equal(first?.temperatureC, 16.5);
  advance(WEATHER_CACHE_MS - 1);
  assert.deepEqual(await source.fetchCurrent(signal()), first);
  assert.deepEqual([calls.location, calls.fetch.length], [1, 1]);
  advance(1);
  await source.fetchCurrent(signal());
  assert.deepEqual([calls.location, calls.fetch.length], [2, 2]);
});

test('権限の拒否・通信の失敗・APIのエラーではnullを返し、キャッシュしない', async () => {
  const denied = setup({ location: null });
  assert.equal(await denied.source.fetchCurrent(signal()), null);
  assert.equal(denied.calls.fetch.length, 0);
  const offline = setup({ fail: true });
  assert.equal(await offline.source.fetchCurrent(signal()), null);
  assert.equal(offline.items.size, 0);
  assert.equal(await setup({ ok: false }).source.fetchCurrent(signal()), null);
  assert.equal(await setup({ response: 'oops' }).source.fetchCurrent(signal()), null);
});

test('壊れたキャッシュは無視して取り直し、abortはAbortErrorにする', async () => {
  const { source, items, calls } = setup();
  items.set('weather:v1', '{broken');
  assert.equal((await source.fetchCurrent(signal()))?.isDay, true);
  assert.equal(calls.fetch.length, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(source.fetchCurrent(controller.signal), { name: 'AbortError' });
});

test('モックは固定の天気か「外の天気なし」を返す', async () => {
  const now = Date.UTC(2026, 9, 25, 5, 10);
  const weather = await createMockWeatherSource({ delayMs: 0, now: () => now }).fetchCurrent(signal());
  assert.equal(weather?.observedAt, '2026-10-25T05:00:00.000Z');
  assert.equal(await createMockWeatherSource({ delayMs: 0, weather: null }).fetchCurrent(signal()), null);
  assert.throws(() => createMockWeatherSource({ delayMs: -1 }));
});
