import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Measurement } from '../src/domain/measurement';
import type { MoldPrediction } from '../src/domain/prediction';
import { buildChart } from '../src/ui/chartGeometry';
import { deriveHomeState, STALE_AFTER_MS } from '../src/ui/homeState';

const hour = 3600000;
const end = Date.UTC(2026, 9, 2);
function record(hoursAgo: number, humidity: number | null, temperature: number | null = 24): Measurement {
  const at = new Date(end - hoursAgo * hour).toISOString();
  return { deviceId: 'test', temperatureC: temperature, relativeHumidityPercent: humidity, measuredAt: at, receivedAt: at };
}
const prediction = (riskLevel: MoldPrediction['riskLevel']): MoldPrediction =>
  ({ moldIndex: 0, riskLevel, daysToMoldIndex1: null, isProvisional: false, basedOnReceivedAt: '' });

test('データがなければ眠り、同期中は探索中、失敗後は空欄にする', () => {
  assert.deepEqual(deriveHomeState([], 'loading', null, end), { risk: null, mood: 'sleep', reading: { kind: 'searching' } });
  assert.deepEqual(deriveHomeState([], 'error', null, end).reading, { kind: 'empty' });
  assert.deepEqual(deriveHomeState([record(0, null)], 'ready', null, end).reading, { kind: 'empty' });
});

test('リスクを表情に割り当て、欠測は直前の湿度で表示する', () => {
  const state = deriveHomeState([record(0, null), record(1, 66)], 'ready', prediction('high'), end);
  assert.equal(state.risk, 'high');
  assert.equal(state.mood, 'dizzy');
  assert.deepEqual(state.reading, { kind: 'live', humidity: 66 });
  assert.equal(deriveHomeState([record(0, 50)], 'ready', null, end).mood, 'fine');
});

test('同期失敗中と、古い計測値は stale にする', () => {
  assert.equal(deriveHomeState([record(0, 60)], 'error', null, end).reading.kind, 'stale');
  assert.equal(deriveHomeState([record(0, 60)], 'ready', null, end + STALE_AFTER_MS + 1).reading.kind, 'stale');
  assert.equal(deriveHomeState([record(0, 60)], 'ready', null, end + STALE_AFTER_MS).reading.kind, 'live');
});

test('グラフは最新の計測を右端に直近24hだけ描き、欠測で線を切る', () => {
  const box = { left: 20, top: 10, width: 240, height: 120 };
  const history = [record(0, 70), record(1, 60), record(2, null), record(3, 50), record(4, 55), record(30, 90)];
  const chart = buildChart(history, 'humidity', box);
  assert.equal(chart.points.length, 4);
  assert.equal(chart.paths.length, 2);
  assert.equal(chart.latest?.value, 70);
  assert.equal(chart.latest?.x, box.left + box.width);
  assert.equal(chart.latest?.y, chart.dangerY);
  assert.equal(buildChart(history, 'temperature', box).dangerY, null);
});

test('グラフの縦線はローカル時刻の6時間おきの正時に引く', () => {
  const box = { left: 0, top: 0, width: 240, height: 120 };
  const { grid } = buildChart([record(0, 60)], 'humidity', box);
  assert.equal(grid.length, 4);
  for (const g of grid) {
    assert.equal(g.hour % 6, 0);
    const at = end - 24 * hour + (g.x / box.width) * 24 * hour;
    assert.equal(new Date(at).getHours(), g.hour);
    assert.ok(g.x > 0 && g.x <= box.width);
  }
});

test('履歴がなければグラフを描かない', () => {
  const chart = buildChart([], 'humidity', { left: 0, top: 0, width: 100, height: 100 });
  assert.equal(chart.latest, null);
  assert.deepEqual(chart.paths, []);
});
