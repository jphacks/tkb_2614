import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeDataNotification, encodeSendRequest, fromBase64, isChiikabiAdvertisement, toBase64 } from '../src/data/ble/protocol';

const hex = (s: string) => Uint8Array.from(s.split(' '), (b) => parseInt(b, 16));
const record = '40 2D DC 6A F2 09 EE 14'; // docs/ble-protocol.md の例: 1792814400, 25.46℃, 53.58%
const end = '00 00 00 00 00 00 00 00';

test('docsの例どおりにアドバタイズを見分け、送信要求をエンコードする', () => {
  assert.equal(isChiikabiAdvertisement(hex('FF FF 02 01 40 2D DC 6A')), true);
  assert.equal(isChiikabiAdvertisement(hex('FF FF 01 01 40 2D DC 6A')), false);
  assert.equal(isChiikabiAdvertisement(hex('4C 00 02 01 40 2D DC 6A')), false);
  assert.equal(isChiikabiAdvertisement(hex('FF FF 02')), false);
  assert.deepEqual(encodeSendRequest(new Date(1790229600_000), new Date(1792821600_999)), hex('01 60 BC B4 6A 60 49 DC 6A'));
  assert.deepEqual([...encodeSendRequest(null, new Date(0))], [1, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('記録をデコードし、終了の印は同じ通知でも単独でも検出する', () => {
  const first = decodeDataNotification(hex(`${record} ${record}`));
  assert.equal(first.done, false);
  assert.deepEqual(first.records[0], { measuredAt: new Date(1792814400_000), temperatureC: 25.46, relativeHumidityPercent: 53.58 });
  assert.deepEqual(decodeDataNotification(hex(`${record} ${end}`)).records.length, 1);
  assert.equal(decodeDataNotification(hex(`${record} ${end}`)).done, true);
  assert.deepEqual(decodeDataNotification(hex(end)), { records: [], done: true });
});

test('欠測をnullにし、不正な長さ・湿度を拒否する', () => {
  const [missing] = decodeDataNotification(hex('40 2D DC 6A 00 80 FF FF')).records;
  assert.equal(missing.temperatureC, null);
  assert.equal(missing.relativeHumidityPercent, null);
  assert.throws(() => decodeDataNotification(hex('40 2D DC 6A F2 09 EE')), /8の倍数/);
  assert.throws(() => decodeDataNotification(hex('40 2D DC 6A F2 09 11 27')), /範囲外/); // 10001
});

test('base64を往復できる', () => {
  const bytes = hex(`${record} FF 00`);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});
