import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMeasurement } from '../src/domain/measurement';

const validMeasurement = {
  deviceId: 'test-room-01',
  temperatureC: 24.2,
  relativeHumidityPercent: 55,
  measuredAt: '2026-10-24T03:00:00.000Z',
  receivedAt: '2026-10-24T03:00:00.300Z',
};

test('有効な計測値をコピーし、計測時刻不明と湿度の境界値も受け入れる', () => {
  const parsed = parseMeasurement(validMeasurement);
  assert.deepEqual(parsed, validMeasurement);
  assert.notEqual(parsed, validMeasurement);
  for (const relativeHumidityPercent of [0, 100]) {
    assert.equal(parseMeasurement({ ...validMeasurement, measuredAt: null, relativeHumidityPercent }).measuredAt, null);
  }
});

test('不正な入力は画面・履歴へ入る前に拒否する', () => {
  const invalidInputs: unknown[] = [
    null,
    '24.2,55',
    {},
    { ...validMeasurement, deviceId: ' ' },
    { ...validMeasurement, temperatureC: '24.2' },
    { ...validMeasurement, temperatureC: NaN },
    { ...validMeasurement, temperatureC: Infinity },
    { ...validMeasurement, relativeHumidityPercent: -1 },
    { ...validMeasurement, relativeHumidityPercent: 101 },
    { ...validMeasurement, relativeHumidityPercent: NaN },
    { ...validMeasurement, relativeHumidityPercent: '55' },
    { ...validMeasurement, measuredAt: undefined },
    { ...validMeasurement, measuredAt: '2026-10-24' },
    { ...validMeasurement, receivedAt: null },
    { ...validMeasurement, receivedAt: 'invalid' },
    { ...validMeasurement, receivedAt: '2026-10-24T12:00:00.300+09:00' },
    { ...validMeasurement, receivedAt: '2026-02-30T00:00:00.000Z' },
  ];

  for (const input of invalidInputs) assert.throws(() => parseMeasurement(input));
});
