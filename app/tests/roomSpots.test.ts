import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockMeasurementSource } from '../src/data/mock/MockMeasurementSource';
import type { Measurement } from '../src/domain/measurement';
import { createVttMoldPredictor } from '../src/domain/moldModel';
import { predictSpots, ROOM_SPOTS, surfaceDeltaByMonthFor } from '../src/domain/roomSpots';

const HOUR_MS = 3600000;
const JANUARY = Date.UTC(2026, 0, 15);

/** 古い順の条件を、predictSpotsが受け取る最新順の毎時履歴にする。 */
function history(conditions: readonly Pick<Measurement, 'temperatureC' | 'relativeHumidityPercent'>[], start = JANUARY): Measurement[] {
  return conditions.map((c, i) => {
    const at = new Date(start + i * HOUR_MS).toISOString();
    return { deviceId: 'test', ...c, measuredAt: at, receivedAt: at };
  }).reverse();
}

/** モックを1月1日から days 日分取り、最新順にする。 */
async function winterMock(days: number) {
  const epoch = Date.UTC(2026, 0, 1);
  const source = createMockMeasurementSource({ delayMs: 0, epoch, now: () => epoch + (days * 24 - 1) * HOUR_MS });
  return [...await source.fetchSince(null, new AbortController().signal)].reverse();
}

const assertClose = (actual: number, expected: number, epsilon = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} と ${expected} の差が ${epsilon} を超える`);

test('ΔT は fRsi で換算し、窓の1月は10℃になる', () => {
  assertClose(surfaceDeltaByMonthFor(0.25)[0], 10);
  surfaceDeltaByMonthFor(0.7).forEach((deltaC, month) => assertClose(deltaC, [4, 4, 3, 1.5, 0, 0, 0, 0, 0, 1.5, 3, 4][month]));
  assert.deepEqual(ROOM_SPOTS.map((s) => s.id), ['window', 'shelf', 'bed']);
});

test('fRsi=0.7 のベッドは、今のカビモデルと同じ結果になる', async () => {
  const humid = history(Array.from({ length: 200 }, () => ({ temperatureC: 22, relativeHumidityPercent: 75 })));
  for (const records of [await winterMock(30), humid]) {
    const bed = predictSpots(records, null).bed!;
    const main = createVttMoldPredictor().predict(records)!;
    // (1 − 0.7) / 0.3 が 1.0000000000000002 になるので、近さで比べる。
    assertClose(bed.moldIndex, main.moldIndex);
    assert.equal(bed.riskLevel, main.riskLevel);
    assert.equal(bed.isProvisional, main.isProvisional);
    assert.equal(bed.basedOnReceivedAt, main.basedOnReceivedAt);
    if (main.daysToMoldIndex1 === null) assert.equal(bed.daysToMoldIndex1, null);
    else assertClose(bed.daysToMoldIndex1!, main.daysToMoldIndex1, 1e-9);
  }
  assert.ok(createVttMoldPredictor().predict(humid)!.daysToMoldIndex1! > 0);
});

test('冬のモックを30日分入れると、M は 窓 ≥ 棚 ≥ ベッド の順になる', async () => {
  const { window, shelf, bed } = predictSpots(await winterMock(30), null);
  assert.ok(window!.moldIndex >= shelf!.moldIndex && shelf!.moldIndex >= bed!.moldIndex);
  // 今のモックでの値（窓 約1.56・棚 約0.48・ベッド 約0.03）。
  assert.equal(window!.moldIndex.toFixed(2), '1.56');
  assert.equal(shelf!.moldIndex.toFixed(2), '0.48');
  assert.equal(bed!.moldIndex.toFixed(2), '0.03');
  assert.equal(window!.currentSurface.relativeHumidityPercent, 100);
});

test('窓の結露は外気温があればそれで、なければ月別の表で判定する', () => {
  const humid = history([{ temperatureC: 20, relativeHumidityPercent: 60 }]);
  const dry = history([{ temperatureC: 20, relativeHumidityPercent: 40 }]);
  assert.equal(predictSpots(humid, 0).window!.isCondensing, true);
  assert.equal(predictSpots(dry, 10).window!.isCondensing, false);
  // 外が室温より暖かいときは表面が冷えないので、ΔT=0 で結露しない。
  assert.equal(predictSpots(humid, 25).window!.isCondensing, false);
  // 外気温がないときは1月の表（窓は ΔT=10℃）。20℃・60% は表面 RH が 100% を超える。
  assert.equal(predictSpots(humid, null).window!.isCondensing, true);
  assert.equal(predictSpots(history([{ temperatureC: 20, relativeHumidityPercent: 60 }], Date.UTC(2026, 6, 15)), null).window!.isCondensing, false);
});

test('窓の今の表面 RH は、結露判定と同じ ΔT で求める', () => {
  // 1月・20℃・60%・外気 15℃ は ΔT = 0.75 × 5 = 3.75℃ で結露しない。月別の表（10℃）なら表面 RH は 100% になる。
  const { window } = predictSpots(history([{ temperatureC: 20, relativeHumidityPercent: 60 }]), 15);
  assert.equal(window!.isCondensing, false);
  assertClose(window!.currentSurface.temperatureC, 16.25);
  assert.ok(window!.currentSurface.relativeHumidityPercent < 100);
  assert.equal(predictSpots(history([{ temperatureC: 20, relativeHumidityPercent: 60 }]), 0).window!.currentSurface.relativeHumidityPercent, 100);
});

test('最新の計測が欠測なら、その前の有効な計測で結露を判定する', () => {
  const records = history([{ temperatureC: 20, relativeHumidityPercent: 60 }, { temperatureC: null, relativeHumidityPercent: null }]);
  assert.equal(predictSpots(records, 0).window!.isCondensing, true);
});

test('有効な計測がなければ、外気温が null でも各スポットとも null を返す', () => {
  assert.deepEqual(predictSpots([], null), { window: null, shelf: null, bed: null });
  assert.deepEqual(predictSpots(history([{ temperatureC: null, relativeHumidityPercent: 50 }]), null), { window: null, shelf: null, bed: null });
  assert.equal(typeof predictSpots(history([{ temperatureC: 20, relativeHumidityPercent: 50 }]), null).shelf?.moldIndex, 'number');
});
