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
const open: VentilationAdvice = { kind: 'open', brief: false, predictedIndoorRh: 47.4 };

test('判定の種類ごとにひとことと絵を出し、none と夜間なら吹き出しを出さない', () => {
  const shown = (advice: VentilationAdvice) => {
    const message = ventilationMessage(advice, null, 'medium');
    return message && [message.text, message.animation];
  };
  assert.deepEqual(shown(open), ['窓を開けよう！ 45% くらいまで下がりそう', 'window-open']);
  assert.equal(shown({ kind: 'open', brief: false, predictedIndoorRh: 52.6 })?.[0], '窓を開けよう！ 55% くらいまで下がりそう');
  // とても乾いた外気でも、40% より下は出さない。
  assert.equal(shown({ kind: 'open', brief: false, predictedIndoorRh: 22.4 })?.[0], '窓を開けよう！ 40% くらいまで下がりそう');
  assert.deepEqual(shown({ kind: 'open', brief: true }), ['外が寒いから、5〜10分だけ窓を開けよう', 'window-open-brief']);
  assert.deepEqual(shown({ kind: 'close', reason: 'outdoorWetter' }), ['外のほうがジメジメ。窓は閉めておこう', 'aircon-dry']);
  assert.deepEqual(shown({ kind: 'keep', reason: 'rain' }), ['雨だから窓を閉めよう', 'window-close-rain']);
  assert.deepEqual(shown({ kind: 'keep', reason: 'wind' }), ['風が強いから窓を閉めよう', 'window-close-wind']);
  assert.deepEqual(shown({ kind: 'keep', reason: 'hot' }), ['今日はエアコンや除湿機を使おう', 'aircon-dry']);
  assert.equal(ventilationMessage({ kind: 'none' }, null, 'low'), null);
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'night' }, null, 'low'), null);
});

test('リスクが低いのに乾かすよう勧めるときだけ、原因のスポットを理由に出す', () => {
  // 20℃・60%・外気 0℃ は窓が結露する。
  const condensing = spotsOf(20, 60, 0);
  assert.equal(ventilationMessage(open, condensing, 'low')?.reason, '窓が結露しているよ');
  assert.equal(ventilationMessage(open, condensing, null)?.reason, '窓が結露しているよ');
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'hot' }, condensing, 'low')?.reason, '窓が結露しているよ');
  // 表情が心配・危険なら理由はいらない。閉める・雨・強風は乾かすよう勧めていないので出さない。
  assert.equal(ventilationMessage(open, condensing, 'medium')?.reason, null);
  assert.equal(ventilationMessage({ kind: 'close', reason: 'outdoorWetter' }, condensing, 'low')?.reason, null);
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'rain' }, condensing, 'low')?.reason, null);
  assert.equal(ventilationMessage({ kind: 'keep', reason: 'wind' }, condensing, 'low')?.reason, null);
  // 外気 12℃ なら窓は結露しないが、窓のまわりの表面 RH（約 88%）が臨界湿度を超える。
  const damp = spotsOf(20, 60, 12);
  assert.equal(damp.window!.isCondensing, false);
  assert.equal(ventilationMessage(open, damp, 'low')?.reason, '窓のまわりが湿っているよ');
  // 外気 25℃ なら窓のまわりは湿らず、1月の表で家具の裏の表面 RH が臨界湿度を超える。
  assert.equal(ventilationMessage(open, spotsOf(20, 60, 25), 'low')?.reason, '家具の裏が湿っているよ');
});
