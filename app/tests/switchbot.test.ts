import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSwitchBotMeter, findSwitchBotServiceData } from '../src/data/ble/switchbot';

const hex = (s: string) => Uint8Array.from(s.split(' '), (b) => parseInt(b, 16));
// 温湿度計（'T'）: 電池100%、22.5℃、45%。
const meter = hex('54 00 E4 05 96 2D');

test('サービスデータから温湿度を読み、符号ビットで氷点下を表す', () => {
  assert.deepEqual(decodeSwitchBotMeter(meter, null), { temperatureC: 22.5, relativeHumidityPercent: 45 });
  assert.deepEqual(decodeSwitchBotMeter(hex('54 00 E4 03 05 50'), null), { temperatureC: -5.3, relativeHumidityPercent: 80 });
});

test('Manufacturer Data に温湿度があればそちらを使う', () => {
  // 会社ID 0x0969、MAC 6バイト、続く2バイト、温湿度3バイト。防水温湿度計はサービスデータに温湿度がない。
  const manufacturer = hex('69 09 AA BB CC DD EE FF 01 00 07 99 3C');
  assert.deepEqual(decodeSwitchBotMeter(hex('77 00 E4'), manufacturer), { temperatureC: 25.7, relativeHumidityPercent: 60 });
  assert.deepEqual(decodeSwitchBotMeter(meter, manufacturer), { temperatureC: 25.7, relativeHumidityPercent: 60 });
  // 会社IDが違えばサービスデータに戻る。
  assert.deepEqual(decodeSwitchBotMeter(meter, hex('FF FF AA BB CC DD EE FF 01 00 07 99 3C')), { temperatureC: 22.5, relativeHumidityPercent: 45 });
});

test('温湿度計以外・短すぎるデータ・範囲外の湿度は読まない', () => {
  assert.equal(decodeSwitchBotMeter(hex('48 00 E4 05 96 2D'), null), null); // 'H' Bot
  assert.equal(decodeSwitchBotMeter(hex('77 00 E4'), null), null);
  assert.equal(decodeSwitchBotMeter(hex('54 00 E4 05 96 7F'), null), null);
  assert.equal(decodeSwitchBotMeter(null, null), null);
});

test('サービスデータの UUID は短い形でも128ビットの形でも見つける', () => {
  assert.equal(findSwitchBotServiceData({ '0000fd3d-0000-1000-8000-00805f9b34fb': 'x' }), 'x');
  assert.equal(findSwitchBotServiceData({ FD3D: 'y' }), 'y');
  assert.equal(findSwitchBotServiceData({ '0000180f-0000-1000-8000-00805f9b34fb': 'z' }), null);
  assert.equal(findSwitchBotServiceData(null), null);
});
