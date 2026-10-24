import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockMeasurementSource } from '../src/data/mock/MockMeasurementSource';

const samples = [{ temperatureC: 20, relativeHumidityPercent: 40 }, { temperatureC: 25, relativeHumidityPercent: 80 }];
test('モックはsince以上の毎時の履歴を古い順に返し、再起動しても同じ時刻は同じ値', async () => {
  let now = Date.UTC(2026, 9, 1, 1, 30);
  const source = createMockMeasurementSource({ samples, delayMs: 0, now: () => now });
  const signal = new AbortController().signal;
  const records = await source.fetchSince(null, signal);
  assert.deepEqual(records.map((r) => r.measuredAt), ['2026-10-01T00:00:00.000Z', '2026-10-01T01:00:00.000Z']);
  assert.equal(records[1].temperatureC, 25);
  now += 3600000;
  const since = new Date(records[1].measuredAt);
  assert.deepEqual((await source.fetchSince(since, signal)).map((r) => r.measuredAt), ['2026-10-01T01:00:00.000Z', '2026-10-01T02:00:00.000Z']);
  const restarted = createMockMeasurementSource({ samples, delayMs: 0, now: () => now });
  assert.deepEqual((await restarted.fetchSince(since, signal)).map((r) => r.temperatureC), [25, 20]);
});
test('モックはキャンセル・不正設定・失敗を扱う', async () => {
  const source = createMockMeasurementSource({ delayMs: 0, failEvery: 2 });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(source.fetchSince(null, controller.signal), { name: 'AbortError' });
  const signal = new AbortController().signal;
  await source.fetchSince(null, signal);
  await assert.rejects(source.fetchSince(null, signal), /取得エラー/);
  assert.throws(() => createMockMeasurementSource({ samples: [] }));
  assert.throws(() => createMockMeasurementSource({ delayMs: -1 }));
  assert.throws(() => createMockMeasurementSource({ failEvery: 0.5 }));
});
