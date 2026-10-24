import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Measurement } from '../src/domain/measurement';
import { createVttMoldPredictor, criticalHumidity, surfaceConditions } from '../src/domain/moldModel';

const humid = { temperatureC: 25, relativeHumidityPercent: 90 };
const dry = { temperatureC: 20, relativeHumidityPercent: 40 };
/** 古い順の条件を、predictが受け取る最新順の履歴にする。 */
function history(conditions: readonly Pick<Measurement, 'temperatureC' | 'relativeHumidityPercent'>[]): Measurement[] {
  return conditions.map((c, i) => ({ seq: i + 1, deviceId: 'test', ...c, measuredAt: null, receivedAt: `r${i + 1}` })).reverse();
}
const hours = (condition: typeof humid, count: number) => Array.from({ length: count }, () => condition);
const predictor = createVttMoldPredictor();

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
  const prediction = predictor.predict(history(hours(dry, 100)));
  assert.deepEqual(prediction, { moldIndex: 0, riskLevel: 'low', daysToMoldIndex1: null, basedOnReceivedAt: 'r100' });
});

test('高湿が続くと予測した日数付近でM=1を超え、欠測は飛ばす', () => {
  const days = predictor.predict(history([humid]))?.daysToMoldIndex1;
  assert.ok(days !== null && days !== undefined && days > 0);
  const crossing = Math.round(days * 24);
  assert.ok(predictor.predict(history(hours(humid, crossing - 2)))!.moldIndex < 1);
  const after = predictor.predict(history([...hours(humid, crossing + 2), { temperatureC: null, relativeHumidityPercent: null }]))!;
  assert.ok(after.moldIndex >= 1);
  assert.equal(after.riskLevel, 'medium');
  assert.equal(after.daysToMoldIndex1, 0);
});

test('乾燥に変わると6時間は減り、24時間までは横ばい、その後また減る', () => {
  const m = (dryHours: number) => predictor.predict(history([...hours(humid, 200), ...hours(dry, dryHours)]))!.moldIndex;
  assert.ok(m(6) < m(0));
  assert.equal(m(24), m(6));
  assert.ok(m(30) < m(24));
});
