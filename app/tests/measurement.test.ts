import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeLogRecord } from '../src/domain/measurement';

function bytes(seq = 1, timestamp = 0, temperature = 2420, humidity = 5500) {
  const buffer = new Uint8Array(12);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, seq, true);
  view.setUint32(4, timestamp, true);
  view.setInt16(8, temperature, true);
  view.setUint16(10, humidity, true);
  return buffer;
}
test('12バイトのLE履歴をデコードし、計測時刻未同期と欠測を個別に保持する', () => {
  const record = decodeLogRecord(bytes(42, 0, -32768, 0xffff), 'room', 'received');
  assert.deepEqual(record, { seq: 42, deviceId: 'room', measuredAt: null, receivedAt: 'received', temperatureC: null, relativeHumidityPercent: null });
  assert.equal(decodeLogRecord(bytes(43, 1, -125, 10000), 'room', 'received').temperatureC, -1.25);
  assert.equal(decodeLogRecord(bytes(43, 1), 'room', 'received').measuredAt, '1970-01-01T00:00:01.000Z');
  assert.equal(decodeLogRecord(bytes(44, 1, -32768, 0), 'room', 'received').relativeHumidityPercent, 0);
});
test('不正な長さ・湿度・seqを拒否し、subarrayのオフセットも尊重する', () => {
  for (const length of [0, 11, 13]) assert.throws(() => decodeLogRecord(new Uint8Array(length), 'room', 'received'));
  assert.throws(() => decodeLogRecord(bytes(0), 'room', 'received'));
  assert.throws(() => decodeLogRecord(bytes(1, 0, 2000, 10001), 'room', 'received'));
  const padded = new Uint8Array(16);
  padded.set(bytes(), 2);
  assert.equal(decodeLogRecord(padded.subarray(2, 14), 'room', 'received').temperatureC, 24.2);
});