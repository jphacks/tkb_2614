import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';

import type { Measurement, MeasurementSource } from '../src/domain/measurement';
import { pollMeasurements } from '../src/services/pollMeasurements';

const measurement: Measurement = {
  deviceId: 'test-room', temperatureC: 25, relativeHumidityPercent: 60,
  measuredAt: null, receivedAt: '2026-10-24T03:00:00.000Z',
};

test('取得が遅くてもreadを重ねず、完了から指定間隔後に次を取得する', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let finish!: (value: Measurement) => void;
  const source: MeasurementSource = {
    label: 'slow',
    readLatest: () => {
      calls += 1;
      return new Promise((resolve) => { finish = resolve; });
    },
  };
  const received: Measurement[] = [];
  const stop = pollMeasurements(source, {
    onMeasurement: (value) => received.push(value), onError: assert.fail,
  }, 100);
  t.after(stop);

  assert.equal(calls, 1);
  t.mock.timers.tick(1_000);
  assert.equal(calls, 1);
  finish(measurement);
  await setImmediate();
  assert.deepEqual(received, [measurement]);
  t.mock.timers.tick(99);
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  assert.equal(calls, 2);
  stop();
  finish(measurement);
  await setImmediate();
  assert.equal(received.length, 1);
});

test('不正データと取得エラーを通知し、次の取得で自動復帰する', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const errors: Error[] = [];
  const received: Measurement[] = [];
  const stop = pollMeasurements({
    label: 'recovering',
    async readLatest() {
      calls += 1;
      if (calls === 1) return { ...measurement, relativeHumidityPercent: 101 };
      if (calls === 2) throw new Error('接続失敗');
      return measurement;
    },
  }, {
    onMeasurement: (value) => received.push(value), onError: (error) => errors.push(error),
  }, 100);
  t.after(stop);

  await setImmediate();
  assert.equal(received.length, 0);
  assert.match(errors[0].message, /相対湿度/);
  t.mock.timers.tick(100);
  await setImmediate();
  assert.equal(errors[1].message, '接続失敗');
  t.mock.timers.tick(100);
  await setImmediate();
  assert.deepEqual(received, [measurement]);
  assert.equal(errors.length, 2);
});

test('停止はsignalを中断し、遅れて返るデータも次回の取得も通知しない', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish!: (value: Measurement) => void;
  let signal!: AbortSignal;
  let calls = 0;
  const stop = pollMeasurements({
    label: 'pending',
    readLatest(abortSignal) {
      signal = abortSignal;
      calls += 1;
      return new Promise((resolve) => { finish = resolve; });
    },
  }, { onMeasurement: () => assert.fail('停止後のデータ通知'), onError: assert.fail }, 100);
  t.after(stop);

  stop();
  stop();
  assert.equal(signal.aborted, true);
  finish(measurement);
  await setImmediate();
  t.mock.timers.tick(1_000);
  assert.equal(calls, 1);
});

test('取得完了後に停止すると予約済みタイマーも解除する', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const stop = pollMeasurements({
    label: 'test', async readLatest() { calls += 1; return measurement; },
  }, { onMeasurement() {}, onError: assert.fail }, 100);
  t.after(stop);
  await setImmediate();
  stop();
  t.mock.timers.tick(1_000);
  assert.equal(calls, 1);
});

test('停止した取得の遅いrejectは通知しない', async (t) => {
  let fail!: (error: Error) => void;
  const stop = pollMeasurements({
    label: 'pending', readLatest: () => new Promise((_, reject) => { fail = reject; }),
  }, { onMeasurement: () => assert.fail('停止後のデータ通知'), onError: assert.fail });
  t.after(stop);
  stop();
  fail(new Error('遅れて失敗'));
  await setImmediate();
});
