import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockMeasurementSource } from '../src/data/mock/MockMeasurementSource';
import { placeholderMoldPredictor } from '../src/data/mock/PlaceholderMoldPredictor';
import { parseMeasurement } from '../src/domain/measurement';

const samples = [
  { temperatureC: 20, relativeHumidityPercent: 40 },
  { temperatureC: 25, relativeHumidityPercent: 80 },
];

test('注入したモック値を順に返して繰り返し、失敗後も再取得できる', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const source = createMockMeasurementSource({ samples, delayMs: 10, failEvery: 3 });
  async function read() {
    const pending = source.readLatest(new AbortController().signal);
    t.mock.timers.tick(10);
    return parseMeasurement(await pending);
  }

  const first = await read();
  assert.equal(first.temperatureC, 20);
  assert.equal(first.relativeHumidityPercent, 40);
  assert.ok(first.measuredAt);
  assert.equal((await read()).temperatureC, 25);
  await assert.rejects(read(), /モックの取得エラー/);
  assert.equal((await read()).temperatureC, 20);
});

test('待機中・開始前のキャンセルで値を消費しない', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const source = createMockMeasurementSource({ samples, delayMs: 10 });
  const controller = new AbortController();
  const pending = source.readLatest(controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await rejected;
  await assert.rejects(source.readLatest(controller.signal), { name: 'AbortError' });

  const lateController = new AbortController();
  const afterWait = source.readLatest(lateController.signal);
  t.mock.timers.tick(10);
  const lateRejected = assert.rejects(afterWait, { name: 'AbortError' });
  lateController.abort();
  await lateRejected;

  const next = source.readLatest(new AbortController().signal);
  t.mock.timers.tick(10);
  assert.equal((await next).temperatureC, 20);
});

test('空のモック配列など不正な設定は開始時に拒否する', () => {
  assert.throws(() => createMockMeasurementSource({ samples: [] }));
  assert.throws(() => createMockMeasurementSource({ delayMs: -1 }));
  assert.throws(() => createMockMeasurementSource({ failEvery: 0.5 }));
});

test('予測はデータなしではnull、データありでは入力にひもづく仮の固定値を返す', async () => {
  const signal = new AbortController().signal;
  assert.equal(await placeholderMoldPredictor.predict([], signal), null);

  const latest = {
    deviceId: 'test', ...samples[0], measuredAt: null, receivedAt: '2026-10-24T03:00:00.000Z',
  };
  const prediction = await placeholderMoldPredictor.predict([latest], signal);
  assert.equal(prediction?.riskLevel, 'medium');
  assert.equal(prediction?.horizonHours, 24);
  assert.equal(prediction?.isPlaceholder, true);
  assert.equal(prediction?.basedOnReceivedAt, latest.receivedAt);

  const controller = new AbortController();
  controller.abort();
  assert.equal(await placeholderMoldPredictor.predict([latest], controller.signal), null);
});
