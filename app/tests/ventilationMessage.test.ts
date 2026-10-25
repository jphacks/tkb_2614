import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Measurement } from '../src/domain/measurement';
import { predictSpots } from '../src/domain/roomSpots';
import type { VentilationAdvice } from '../src/domain/ventilation';
import { ventilationMessage } from '../src/ui/ventilationMessage';

const at = new Date(2026, 0, 15, 12).toISOString();
const spotsOf = (temperatureC: number, relativeHumidityPercent: number, outdoorC: number | null) => {
  const records: Measurement[] = [{ deviceId: 'test', temperatureC, relativeHumidityPercent, measuredAt: at, receivedAt: at }];
  return predictSpots(records, outdoorC);
};
const open: VentilationAdvice = { kind: 'open', brief: false, predictedIndoorRh: 37.4 };

test('判定の種類ごとにひとことを出し、none と夜間なら吹き出しを出さない', () => {
  const text = (advice: VentilationAdvice) => ventilationMessage(advice, null, 'medium')?.text;
  assert.equal(text(open), '窓を開けよう！ 35% くらいまで下がりそう');
  assert.equal(text({ kind: 'open', brief: false, predictedIndoorRh: 37.6 }), '窓を開けよう！ 40% くらいまで下がりそう');
  // 丸めても 0% にはしない。
  assert.equal(text({ kind: 'open', brief: false, predictedIndoorRh: 1.2 }), '窓を開けよう！ 5% くらいまで下がりそう');
  assert.equal(text({ kind: 'open', brief: true }), '外が寒いから、5〜10分だけ窓を開けよう');
  assert.equal(text({ kind: 'close', reason: 'outdoorWetter' }), '外のほうがジメジメ。窓は閉めておこう');
  assert.equal(text({ kind: 'keep', reason: 'rain' }), '雨だから窓はそのままで');
  assert.equal(text({ kind: 'keep', reason: 'wind' }), '今日はエアコンや除湿機を使おう');
  assert.equal(text({ kind: 'keep', reason: 'hot' }), '今日はエアコンや除湿機を使おう');
  assert.equal(ventilationMessage({ kind: 'none' }, null, 'low'), null);
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'night' }, null, 'low'), null);
});

test('リスクが低いのに乾かすよう勧めるときだけ、原因のスポットを理由に出す', () => {
  // 20℃・60%・外気 0℃ は窓が結露する。
  const condensing = spotsOf(20, 60, 0);
  assert.equal(ventilationMessage(open, condensing, 'low')?.reason, '窓が結露しているよ');
  assert.equal(ventilationMessage(open, condensing, null)?.reason, '窓が結露しているよ');
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'wind' }, condensing, 'low')?.reason, '窓が結露しているよ');
  // 表情が心配・危険なら理由はいらない。閉める・雨は乾かすよう勧めていないので出さない。
  assert.equal(ventilationMessage(open, condensing, 'medium')?.reason, null);
  assert.equal(ventilationMessage({ kind: 'close', reason: 'outdoorWetter' }, condensing, 'low')?.reason, null);
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'rain' }, condensing, 'low')?.reason, null);
  // 外気 12℃ なら窓は結露しないが、窓のまわりの表面 RH（約 88%）が臨界湿度を超える。
  const damp = spotsOf(20, 60, 12);
  assert.equal(damp.window!.isCondensing, false);
  assert.equal(ventilationMessage(open, damp, 'low')?.reason, '窓のまわりが湿っているよ');
  // 外気 25℃ なら窓のまわりは湿らず、1月の表で家具の裏の表面 RH が臨界湿度を超える。
  assert.equal(ventilationMessage(open, spotsOf(20, 60, 25), 'low')?.reason, '家具の裏が湿っているよ');
});
