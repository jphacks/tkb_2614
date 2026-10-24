import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Measurement } from '../src/domain/measurement';
import type { MoldPrediction } from '../src/domain/prediction';
import { schemes } from '../src/theme/schemes';
import { STALE_AFTER_MS } from '../src/ui/homeState';
import { characterKinds } from '../src/ui/mascot/types';
import {
  buildWidgetTimeline,
  deriveWidgetProps,
  formatSyncAgo,
  initialWidgetProps,
  WIDGET_TIMELINE_STEP_MS,
  type WidgetImages,
  type WidgetSource,
} from '../src/widgets/widgetProps';

const minute = 60000;
const hour = 60 * minute;
// 時刻の表示はローカル時刻なので、ローカルで組み立てる。
const now = new Date(2026, 9, 2, 14, 20).getTime();
function record(minutesAgo: number, humidity: number | null, temperature: number | null = 24.4): Measurement {
  const at = new Date(now - minutesAgo * minute).toISOString();
  return { deviceId: 'test', temperatureC: temperature, relativeHumidityPercent: humidity, measuredAt: at, receivedAt: at };
}
const prediction = (riskLevel: MoldPrediction['riskLevel']): MoldPrediction =>
  ({ moldIndex: 0, riskLevel, daysToMoldIndex1: null, isProvisional: false, basedOnReceivedAt: '' });
const images: WidgetImages = {
  characters: Object.fromEntries(characterKinds.map((kind) => [kind, {
    low: `file:///${kind}-low.png`, medium: `file:///${kind}-medium.png`, high: `file:///${kind}-high.png`,
  }])) as WidgetImages['characters'],
  icons: { humidity: 'file:///h.png', temperature: 'file:///t.png', sync: 'file:///s.png' },
};
const source = (overrides: Partial<WidgetSource> = {}): WidgetSource => ({
  measurements: [record(10, 65.6)], status: 'ready', prediction: prediction('medium'), lastSyncedAt: now - 15 * minute, character: 'mimi', ...overrides,
});

test('最新の値を整数にし、リスクの配色と表情の画像を選ぶ', () => {
  const props = deriveWidgetProps(source(), images, now);
  assert.equal(props.humidity, '66');
  assert.equal(props.temperature, '24');
  assert.equal(props.syncTime, '14:05');
  assert.equal(props.syncAgo, '15分前');
  assert.equal(props.stale, false);
  assert.equal(props.palette.surface, schemes['medium-light'].surface);
  assert.equal(props.palette.primary, schemes['medium-light'].primary);
  assert.equal(props.character, 'file:///mimi-medium.png');
  assert.equal(props.characterOpacity, 1);
  assert.deepEqual(props.icons, images.icons);
});

test('欠測は直前の値を使い、同期時刻がなければ最新の受信時刻を使う', () => {
  const props = deriveWidgetProps(source({ measurements: [record(5, null, null), record(65, 70, 22.6)], lastSyncedAt: null }), images, now);
  assert.equal(props.humidity, '70');
  assert.equal(props.temperature, '23');
  assert.equal(props.syncTime, '14:15');
});

test('選んでいるマスコットの絵を使い、計測値がなければ low の絵を薄く出す', () => {
  assert.equal(deriveWidgetProps(source({ character: 'fin', prediction: prediction('high') }), images, now).character, 'file:///fin-high.png');
  const sleeping = deriveWidgetProps(source({ measurements: [], character: 'mushroom' }), images, now);
  assert.equal(sleeping.character, 'file:///mushroom-low.png');
  assert.ok(sleeping.characterOpacity < 1);
});

test('データがなければ未接続の表示にする', () => {
  const props = deriveWidgetProps(source({ measurements: [], status: 'error', prediction: null, lastSyncedAt: null }), null, now);
  assert.deepEqual(props, { ...initialWidgetProps });
});

test('古い値と同期失敗は stale にする', () => {
  assert.equal(deriveWidgetProps(source({ status: 'error' }), images, now).stale, true);
  assert.equal(deriveWidgetProps(source({ measurements: [record(STALE_AFTER_MS / minute + 1, 60)] }), images, now).stale, true);
});

test('経過時間を分・時間・日で表す', () => {
  assert.equal(formatSyncAgo(now - 30_000, now), 'たった今');
  assert.equal(formatSyncAgo(now - 59 * minute, now), '59分前');
  assert.equal(formatSyncAgo(now - 3 * hour, now), '3時間前');
  assert.equal(formatSyncAgo(now - 50 * hour, now), '2日前');
});

test('iOS のタイムラインは15分ごとに経過時間と古さを先回りして更新する', () => {
  const timeline = buildWidgetTimeline(source(), images, now);
  assert.equal(timeline.length, 25);
  assert.equal(timeline[1].date.getTime() - timeline[0].date.getTime(), WIDGET_TIMELINE_STEP_MS);
  assert.equal(timeline[0].props.syncAgo, '15分前');
  assert.equal(timeline[4].props.syncAgo, '1時間前');
  // 計測から2時間を過ぎたエントリから古い値として表示する。
  const firstStale = timeline.findIndex((entry) => entry.props.stale);
  assert.ok(firstStale > 0);
  assert.ok(timeline[firstStale].date.getTime() - (now - 10 * minute) > STALE_AFTER_MS);
  assert.ok(timeline[firstStale - 1].date.getTime() - (now - 10 * minute) <= STALE_AFTER_MS);
});
