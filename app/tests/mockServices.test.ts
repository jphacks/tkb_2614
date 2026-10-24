import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockMeasurementSource } from '../src/data/mock/MockMeasurementSource';
import { placeholderMoldPredictor } from '../src/data/mock/PlaceholderMoldPredictor';

const samples = [{ temperatureC: 20, relativeHumidityPercent: 40 }, { temperatureC: 25, relativeHumidityPercent: 80 }];
test('モックは毎時の履歴をバッチで返し、ACKまで再送し、同じ時刻の再取得で増えない', async () => {
  let now = Date.UTC(2026, 9, 1, 1);
  const source = createMockMeasurementSource({ samples, delayMs: 0, now: () => now });
  const signal = new AbortController().signal;
  const records = await source.fetchSince(0, signal);
  assert.deepEqual(records.map((r) => r.seq), [1, 2]);
  assert.equal(records[1].temperatureC, 25);
  assert.equal((await source.fetchSince(0, signal)).length, 2);
  await source.ack(2, signal);
  assert.deepEqual(await source.fetchSince(0, signal), []);
  now += 3600000;
  assert.deepEqual((await source.fetchSince(2, signal)).map((r) => r.seq), [3]);
  const restarted = createMockMeasurementSource({ samples, delayMs: 0, now: () => now });
  assert.deepEqual((await restarted.fetchSince(2, signal)).map((r) => r.seq), [3]);
});
test('モックはキャンセル・不正設定・失敗を扱う', async () => {
  const source = createMockMeasurementSource({ delayMs: 0, failEvery: 2 });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(source.fetchSince(0, controller.signal), { name: 'AbortError' });
  const signal = new AbortController().signal;
  await source.fetchSince(0, signal);
  await assert.rejects(source.fetchSince(0, signal), /取得エラー/);
  assert.throws(() => createMockMeasurementSource({ samples: [] }));
  assert.throws(() => createMockMeasurementSource({ delayMs: -1 }));
  assert.throws(() => createMockMeasurementSource({ failEvery: 0.5 }));
});
test('仮予測は同期的で、欠測・時刻未同期を予測しない', () => {
  const latest = { seq: 1, deviceId: 'test', ...samples[0], measuredAt: '2026-10-01T00:00:00.000Z', receivedAt: '2026-10-01T00:00:00.300Z' };
  assert.equal(placeholderMoldPredictor.predict([]), null);
  assert.equal(placeholderMoldPredictor.predict([{ ...latest, temperatureC: null }]), null);
  assert.equal(placeholderMoldPredictor.predict([{ ...latest, measuredAt: null }]), null);
  const prediction = placeholderMoldPredictor.predict([latest]);
  assert.equal(prediction?.isPlaceholder, true);
  assert.equal(prediction?.basedOnReceivedAt, latest.receivedAt);
  assert.deepEqual(placeholderMoldPredictor.predict([latest]), prediction);
});