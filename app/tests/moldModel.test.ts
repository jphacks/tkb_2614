import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Measurement } from '../src/domain/measurement';
import { createVttMoldPredictor, criticalHumidity, surfaceConditions } from '../src/domain/moldModel';

type Condition = Pick<Measurement, 'temperatureC' | 'relativeHumidityPercent'>;
const HOUR_MS = 3600000;
const JANUARY = new Date(2026, 0, 1).getTime();
const JULY = new Date(2026, 6, 1).getTime();
const humid = { temperatureC: 25, relativeHumidityPercent: 90 };
const dry = { temperatureC: 20, relativeHumidityPercent: 40 };

/** 古い順の条件を、predictが受け取る最新順の毎時履歴にする。hourOfで計測の間隔を空けられる。 */
function history(conditions: readonly Condition[], { start = JANUARY, hourOf = (i: number) => i } = {}): Measurement[] {
  return conditions.map((c, i) => {
    const at = new Date(start + hourOf(i) * HOUR_MS).toISOString();
    return { deviceId: 'test', ...c, measuredAt: at, receivedAt: at };
  }).reverse();
}
const hours = (condition: Condition, count: number) => Array.from({ length: count }, () => condition);
const predictor = createVttMoldPredictor();
const noDelta = createVttMoldPredictor({ surfaceDeltaByMonthC: Array(12).fill(0) });

test('表面の湿度と臨界湿度は文書の例と一致する', () => {
  assert.equal(Math.round(surfaceConditions(25, 60, 3, 0).relativeHumidityPercent), 72);
  assert.equal(Math.round(surfaceConditions(25, 60, 5, 0).relativeHumidityPercent), 81);
  assert.equal(surfaceConditions(25, 95, 3, 0).relativeHumidityPercent, 100);
  assert.equal(Math.round(criticalHumidity(20)), 80);
  assert.equal(criticalHumidity(25), 80);
});

test('有効な計測がなければ予測せず、乾燥条件では生えない', () => {
  assert.equal(predictor.predict([]), null);
  assert.equal(predictor.predict(history([{ temperatureC: null, relativeHumidityPercent: 50 }])), null);
  const records = history(hours(dry, 200));
  assert.deepEqual(predictor.predict(records), {
    moldIndex: 0, riskLevel: 'low', daysToMoldIndex1: null, isProvisional: false, basedOnReceivedAt: records[0].receivedAt,
  });
});

test('予測の元時刻は実際に使った最後の計測のもの', () => {
  const records = history([...hours(dry, 3), { temperatureC: null, relativeHumidityPercent: 50 }]);
  assert.equal(predictor.predict(records)?.basedOnReceivedAt, records[1].receivedAt);
});

test('壁が冷える冬だけ、同じ部屋の条件で成長する', () => {
  const room = { temperatureC: 28, relativeHumidityPercent: 70 };
  assert.ok(predictor.predict(history([room], { start: JANUARY }))?.daysToMoldIndex1);
  assert.equal(predictor.predict(history([room], { start: JULY }))?.daysToMoldIndex1, null);
});

/** 1時間分の履歴から求めた日数どおりに、その時間だけ履歴を進めるとM=1を超える。 */
function assertCrossesAtPredictedDay(model: typeof predictor, condition: Condition) {
  const days = model.predict(history([condition]))?.daysToMoldIndex1;
  assert.ok(typeof days === 'number' && days > 0);
  const crossing = 1 + Math.round(days * 24);
  assert.ok(model.predict(history(hours(condition, crossing - 1)))!.moldIndex < 1);
  const after = model.predict(history(hours(condition, crossing)))!;
  assert.ok(after.moldIndex >= 1);
  assert.equal(after.daysToMoldIndex1, 0);
  return days;
}

test('高湿が続くと、予測した日数でM=1を超える', () => {
  assertCrossesAtPredictedDay(predictor, humid);
  assert.equal(predictor.predict(history(hours(humid, 300)))!.riskLevel, 'medium');
});

test('Mmaxが1に近いとk2で成長が遅くなり、1以下なら生えない', () => {
  assert.equal(noDelta.predict(history([{ temperatureC: 25, relativeHumidityPercent: 82 }]))?.daysToMoldIndex1, null);
  const days = assertCrossesAtPredictedDay(noDelta, { temperatureC: 25, relativeHumidityPercent: 83 });
  const constantRateDays = (7 * Math.exp(-0.68 * Math.log(25) - 13.9 * Math.log(83) + 66.02)) / 0.578;
  assert.ok(days > constantRateDays * 1.2);
});

test('乾燥に変わると6時間は減り、24時間までは横ばい、その後また減る', () => {
  const m = (dryHours: number) => predictor.predict(history([...hours(humid, 200), ...hours(dry, dryHours)]))!.moldIndex;
  assert.ok(m(6) < m(0));
  assert.equal(m(24), m(6));
  assert.ok(m(30) < m(24));
});

test('短い欠測は直前の条件で埋め、長い欠測ではMを保持して参考値に戻す', () => {
  const continuous = (count: number) => predictor.predict(history(hours(humid, count)))!;
  const withGap = (missing: number) =>
    predictor.predict(history(hours(humid, 200), { hourOf: (i) => (i < 100 ? i : i + missing) }))!;
  assert.equal(withGap(2).moldIndex, continuous(202).moldIndex);
  assert.equal(withGap(2).isProvisional, false);
  assert.equal(withGap(96).moldIndex, continuous(200).moldIndex);
  assert.equal(withGap(96).isProvisional, true);
});

test('計測間隔が1時間より短くても、同じ期間・条件なら毎時と同じ予測になる', () => {
  assert.deepEqual(noDelta.predict(history(hours(humid, 289), { hourOf: (i) => i / 12 })), noDelta.predict(history(hours(humid, 25))));
  // 同じ時台の記録は平均する。30分ごとに100%と80%なら毎時90%と同じ。
  const alternating = Array.from({ length: 48 }, (_, i) => ({ temperatureC: 25, relativeHumidityPercent: i % 2 ? 80 : 100 }));
  assert.deepEqual(noDelta.predict(history(alternating, { hourOf: (i) => i / 2 }))?.moldIndex, noDelta.predict(history(hours(humid, 24)))?.moldIndex);
});

test('連続した観測が7日未満なら参考値', () => {
  assert.equal(predictor.predict(history(hours(dry, 167)))!.isProvisional, true);
  assert.equal(predictor.predict(history(hours(dry, 168)))!.isProvisional, false);
});
