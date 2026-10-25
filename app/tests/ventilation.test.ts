import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saturationVaporPressureHpa, vaporPressureHpa } from '../src/domain/humidity';
import { STALE_AFTER_MS, type Measurement } from '../src/domain/measurement';
import { predictSpots } from '../src/domain/roomSpots';
import { adviseVentilation, VAPOR_PRESSURE_THRESHOLD_HPA, WEATHER_STALE_AFTER_MS } from '../src/domain/ventilation';
import type { OutdoorWeather } from '../src/domain/weather';

const MINUTE_MS = 60000;
/** 端末のローカル時刻で、1月15日・7月15日の hour 時 minute 分。 */
const january = (hour = 12, minute = 0) => new Date(2026, 0, 15, hour, minute).getTime();
const july = (hour = 12, minute = 0) => new Date(2026, 6, 15, hour, minute).getTime();

/** 時刻を除いた外の天気。時刻は advise が判定する時刻から決める。 */
type WeatherValues = Omit<OutdoorWeather, 'observedAt' | 'fetchedAt'>;

function weather(overrides: Partial<WeatherValues> = {}): WeatherValues {
  return { temperatureC: 10, relativeHumidityPercent: 70, precipitationMm: 0, windSpeedMps: 2, isDay: true, ...overrides };
}

/** now の ageMs 前に1件だけ計測した室内と、now の weatherAgeMs 前に取得した天気で判定する。spots は外気温を使って実際に求める。 */
function advise(
  indoor: { temperatureC: number | null; relativeHumidityPercent: number | null },
  outdoor: WeatherValues | null,
  now: number,
  ageMs = 30 * MINUTE_MS,
  weatherAgeMs = 10 * MINUTE_MS,
) {
  const at = new Date(now - ageMs).toISOString();
  const measurements: Measurement[] = [{ deviceId: 'test', ...indoor, measuredAt: at, receivedAt: at }];
  const fetchedAt = new Date(now - weatherAgeMs).toISOString();
  const current = outdoor === null ? null : { ...outdoor, observedAt: fetchedAt, fetchedAt };
  return adviseVentilation(measurements, predictSpots(measurements, outdoor?.temperatureC ?? null), current, now);
}

/** その温度で、水蒸気圧が hPa になる相対湿度 [%]。 */
const rhFor = (temperatureC: number, hPa: number) => (hPa / saturationVaporPressureHpa(temperatureC)) * 100;

const winterRoom = { temperatureC: 20, relativeHumidityPercent: 60 };
const summerRoom = { temperatureC: 30, relativeHumidityPercent: 80 };

test('室内の計測値が古い、または外の天気がなければ何も言わない', () => {
  assert.equal(advise(winterRoom, weather(), january(), STALE_AFTER_MS).kind, 'open');
  assert.deepEqual(advise(winterRoom, weather(), january(), STALE_AFTER_MS + 1), { kind: 'none' });
  assert.deepEqual(advise(winterRoom, null, january()), { kind: 'none' });
  assert.deepEqual(advise({ temperatureC: null, relativeHumidityPercent: null }, weather(), january()), { kind: 'none' });
  const fetchedAt = new Date(january()).toISOString();
  assert.deepEqual(adviseVentilation([], predictSpots([], 10), { ...weather(), observedAt: fetchedAt, fetchedAt }, january()), { kind: 'none' });
});

test('取得から1時間を超えた外の天気は、天気がないときと同じに扱う', () => {
  assert.equal(advise(winterRoom, weather(), january(), undefined, WEATHER_STALE_AFTER_MS).kind, 'open');
  assert.deepEqual(advise(winterRoom, weather(), january(), undefined, WEATHER_STALE_AFTER_MS + 1), { kind: 'none' });
  // 古い天気では、外のほうが湿っていても「閉めよう」と言わない。
  assert.deepEqual(advise(winterRoom, weather({ temperatureC: 25, relativeHumidityPercent: 80 }), january(), undefined, 3 * 60 * MINUTE_MS), { kind: 'none' });
  // 取得時刻が読めない天気も古いとみなす。
  const measurements: Measurement[] = [{ deviceId: 'test', ...winterRoom, measuredAt: new Date(january()).toISOString(), receivedAt: '' }];
  assert.deepEqual(adviseVentilation(measurements, predictSpots(measurements, 10), { ...weather(), observedAt: '', fetchedAt: '' }, january()), { kind: 'none' });
});

test('窓が結露せず、どのスポットも臨界湿度未満なら何も言わない', () => {
  // 7月は ΔT=0 なので、20℃・40% の部屋はどのスポットも乾いている。外はもっと乾いていても言わない。
  assert.deepEqual(advise({ temperatureC: 20, relativeHumidityPercent: 40 }, weather({ temperatureC: 15, relativeHumidityPercent: 30 }), july()), { kind: 'none' });
  // 1月の 20℃・60% は、窓が結露していなくても棚の裏（ΔT≈5.3℃）が臨界湿度を超えるので言う。
  const spots = predictSpots([{ deviceId: 't', ...winterRoom, measuredAt: new Date(january()).toISOString(), receivedAt: '' }], 10);
  assert.equal(spots.window!.isCondensing, false);
  assert.equal(advise(winterRoom, weather(), january()).kind, 'open');
});

test('外のほうが水蒸気圧が高ければ閉める', () => {
  assert.deepEqual(advise(winterRoom, weather({ temperatureC: 25, relativeHumidityPercent: 80 }), january()), { kind: 'close', reason: 'outdoorWetter' });
});

test('室内のほうが高くても、差がしきい値未満なら何も言わない', () => {
  const indoorHpa = vaporPressureHpa(winterRoom.temperatureC, winterRoom.relativeHumidityPercent)!;
  const outdoor = (diffHpa: number) => weather({ temperatureC: 15, relativeHumidityPercent: rhFor(15, indoorHpa - diffHpa) });
  assert.deepEqual(advise(winterRoom, outdoor(0), january()), { kind: 'none' });
  assert.deepEqual(advise(winterRoom, outdoor(VAPOR_PRESSURE_THRESHOLD_HPA - 0.01), january()), { kind: 'none' });
  assert.equal(advise(winterRoom, outdoor(VAPOR_PRESSURE_THRESHOLD_HPA + 0.01), january()).kind, 'open');
});

test('開けると乾くときは、外の空気に入れ替わったときの室内の相対湿度を返す', () => {
  const advice = advise(winterRoom, weather({ temperatureC: 10, relativeHumidityPercent: 70 }), january());
  assert.equal(advice.kind, 'open');
  assert.ok(advice.kind === 'open' && !advice.brief);
  assert.equal(Math.round(advice.predictedIndoorRh), 37);
});

test('雨・強風・夜間・暑すぎるときは、乾くとしても窓はそのまま', () => {
  assert.deepEqual(advise(winterRoom, weather({ precipitationMm: 0.1 }), january()), { kind: 'keep', reason: 'rain' });
  assert.equal(advise(winterRoom, weather({ windSpeedMps: 9.9 }), january()).kind, 'open');
  assert.deepEqual(advise(winterRoom, weather({ windSpeedMps: 10 }), january()), { kind: 'keep', reason: 'wind' });
  const hot = (temperatureC: number) => weather({ temperatureC, relativeHumidityPercent: 40 });
  assert.deepEqual(advise(summerRoom, hot(33.1), july()), { kind: 'keep', reason: 'hot' });
  assert.equal(advise(summerRoom, hot(33), july()).kind, 'open');
  // 当てはまるものが複数あれば、雨・強風・夜間・暑さの順で理由を選ぶ。
  assert.deepEqual(advise(winterRoom, weather({ precipitationMm: 1, windSpeedMps: 12 }), january(23)), { kind: 'keep', reason: 'rain' });
});

test('夜間は時計の22時から6時まで', () => {
  assert.equal(advise(winterRoom, weather(), january(21, 59)).kind, 'open');
  assert.deepEqual(advise(winterRoom, weather(), january(22, 0)), { kind: 'keep', reason: 'night' });
  assert.deepEqual(advise(winterRoom, weather(), january(5, 59)), { kind: 'keep', reason: 'night' });
  assert.equal(advise(winterRoom, weather(), january(6, 0)).kind, 'open');
  // is_day は見ない。冬の夕方（17時台）に is_day=false でも開ける。
  assert.equal(advise(winterRoom, weather({ isDay: false }), january(17, 30)).kind, 'open');
});

test('外気温が5℃未満なら短時間だけ開け、雨や夜間ならそのまま', () => {
  const cold = (temperatureC: number, overrides: Partial<WeatherValues> = {}) => weather({ temperatureC, relativeHumidityPercent: 60, ...overrides });
  assert.deepEqual(advise(winterRoom, cold(4.9), january()), { kind: 'open', brief: true });
  assert.equal(advise(winterRoom, cold(5), january()).kind, 'open');
  assert.ok(!(advise(winterRoom, cold(5), january()) as { brief: boolean }).brief);
  assert.deepEqual(advise(winterRoom, cold(0, { precipitationMm: 0.5 }), january()), { kind: 'keep', reason: 'rain' });
  assert.deepEqual(advise(winterRoom, cold(0), january(23)), { kind: 'keep', reason: 'night' });
});
