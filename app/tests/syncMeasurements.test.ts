import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createMeasurementStore } from '../src/data/measurementStore';
import type { Measurement, MeasurementSource } from '../src/domain/measurement';
import { createMeasurementSync, RETENTION_MS, scheduleMeasurementSync, type MeasurementStore } from '../src/services/syncMeasurements';

const base = Date.UTC(2026, 9, 24);
const hour = 3600000;
const record = (hours: number, temperatureC: number | null = 25): Measurement => ({
  deviceId: 'room', temperatureC, relativeHumidityPercent: 60,
  measuredAt: new Date(base + hours * hour).toISOString(), receivedAt: '2026-10-24T03:00:00.000Z',
});
const hours = (records: readonly Measurement[]) => records.map((r) => (Date.parse(r.measuredAt) - base) / hour);
function setup() {
  let saved: readonly Measurement[] = [];
  const events: string[] = [];
  const store: MeasurementStore = {
    async load() { return saved; },
    async save(_, records) { events.push('save'); saved = [...records]; },
  };
  const source: MeasurementSource = {
    label: 'test', deviceId: 'room',
    async fetchSince(since) { events.push('fetch:' + (since?.toISOString() ?? 'all')); return [record(1), record(2)]; },
  };
  return { source, store, events, saved: () => saved };
}
const signal = () => new AbortController().signal;

test('初回は全件、以降は保存済みの最新時刻から取得し、同じ時刻の記録は重複させない', async () => {
  const f = setup();
  const sync = createMeasurementSync(f.source, f.store);
  let displayed: readonly Measurement[] = [];
  await sync(signal(), (records) => { displayed = records; });
  const fetchSince = f.source.fetchSince;
  f.source.fetchSince = async (since, s) => { await fetchSince(since, s); return [record(2, 30), record(3)]; };
  await sync(signal(), (records) => { displayed = records; });
  assert.deepEqual(f.events, ['fetch:all', 'save', 'fetch:' + record(2).measuredAt, 'save']);
  assert.deepEqual(hours(f.saved()), [1, 2, 3]);
  assert.equal(f.saved()[1].temperatureC, 30); // 同じ時刻は新しく届いた方で上書き
  assert.deepEqual(hours(displayed), [3, 2, 1]);
});

test('保存が失敗したら同期を失敗させ、欠測レコードは成功した履歴と一緒に保存する', async () => {
  const f = setup();
  f.store.save = async () => { throw new Error('disk full'); };
  await assert.rejects(createMeasurementSync(f.source, f.store)(signal(), () => {}), /disk full/);
  const g = setup();
  g.source.fetchSince = async () => [record(1, null), record(2)];
  await createMeasurementSync(g.source, g.store)(signal(), () => {});
  assert.equal(g.saved()[0].temperatureC, null);
});

test('1年より古い記録は保存しない', async () => {
  const f = setup();
  const old = { ...record(0), measuredAt: new Date(base + 2 * hour - RETENTION_MS).toISOString() };
  f.source.fetchSince = async () => [old, record(1), record(2)];
  await createMeasurementSync(f.source, f.store)(signal(), () => {});
  assert.deepEqual(hours(f.saved()), [1, 2]);
});

test('保存途中で停止しても保存を完了し、停止後の通知をしない', async () => {
  const f = setup();
  const controller = new AbortController();
  let finish!: () => void;
  const save = f.store.save;
  f.store.save = async (id, records) => { await new Promise<void>((resolve) => { finish = resolve; }); await save(id, records); };
  let notifications = 0;
  const pending = createMeasurementSync(f.source, f.store)(controller.signal, () => { notifications += 1; });
  await setImmediate();
  controller.abort();
  finish();
  await assert.rejects(pending, /中止/);
  assert.equal(notifications, 1); // 開始時の保存済み履歴のみ
  assert.equal(f.saved().length, 2);
});

test('応答しないfetchをタイムアウトさせ、次回同期を実行し、遅着結果を捨てる', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup();
  let finish!: (records: readonly Measurement[]) => void;
  let timedSignal!: AbortSignal;
  f.source.fetchSince = async (_, requestSignal) => {
    timedSignal = requestSignal;
    return new Promise((resolve) => { finish = resolve; });
  };
  const sync = createMeasurementSync(f.source, f.store, 10);
  const pending = sync(signal(), () => {});
  const rejected = assert.rejects(pending, /タイムアウト/);
  await setImmediate();
  t.mock.timers.tick(10);
  await rejected;
  assert.equal(timedSignal.aborted, true);
  f.source.fetchSince = async () => [record(1)];
  await sync(signal(), () => {});
  finish([record(2)]);
  await setImmediate();
  assert.deepEqual(hours(f.saved()), [1]);
});

test('手動同期・再開を直列化し、開始前に中断された同期は取得しない', async () => {
  const f = setup();
  let finish!: (records: readonly Measurement[]) => void;
  f.source.fetchSince = () => new Promise((resolve) => { finish = resolve; });
  const sync = createMeasurementSync(f.source, f.store);
  const first = sync(signal(), () => {});
  const controller = new AbortController();
  const second = sync(controller.signal, () => {});
  const rejected = assert.rejects(second, /中止/);
  controller.abort();
  await setImmediate();
  finish([]);
  await first;
  await rejected;
  assert.deepEqual(f.events, ['save']);
});

test('スケジューラーは失敗後も再試行し、停止すると遅着を通知しない', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup();
  let calls = 0;
  f.source.fetchSince = async () => { calls += 1; if (calls === 1) throw new Error('offline'); return [record(1)]; };
  let ready = 0;
  let errors = 0;
  const stop = scheduleMeasurementSync(createMeasurementSync(f.source, f.store), {
    onSaved() {}, onReady() { ready += 1; }, onError() { errors += 1; },
  }, 100);
  await setImmediate();
  assert.equal(errors, 1);
  t.mock.timers.tick(100);
  await setImmediate();
  assert.equal(ready, 1);
  stop();
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.equal(calls, 2);
});

test('停止後のfetch結果を保存しない', async () => {
  const f = setup();
  let finish!: (records: readonly Measurement[]) => void;
  f.source.fetchSince = () => new Promise((resolve) => { finish = resolve; });
  let notifications = 0;
  const stop = scheduleMeasurementSync(createMeasurementSync(f.source, f.store), {
    onSaved() { notifications += 1; }, onReady() { assert.fail('stopped'); }, onError() { assert.fail('stopped'); },
  });
  await setImmediate();
  stop();
  finish([record(1)]);
  await setImmediate();
  assert.deepEqual(f.saved(), []);
  assert.equal(notifications, 1);
});

test('時刻の順序違反・重複・異なるデバイスの履歴を保存しない', async () => {
  for (const records of [[record(2), record(1)], [record(1), record(1)], [{ ...record(1), deviceId: 'other' }], [{ ...record(1), measuredAt: 'x' }]]) {
    const f = setup();
    f.source.fetchSince = async () => records;
    await assert.rejects(createMeasurementSync(f.source, f.store)(signal(), () => {}), /不正/);
    assert.equal(f.saved().length, 0);
  }
});

test('ストアの新規インスタンスでも履歴・欠測を復元し、破損を空履歴に置換しない', async () => {
  const data = new Map<string, string>();
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
  };
  const store = createMeasurementStore(storage);
  assert.deepEqual(await store.load('room'), []);
  const records = [record(1, null), record(2)];
  await store.save('room', records);
  assert.deepEqual(await createMeasurementStore(storage).load('room'), records);
  for (const broken of ['[{}]', JSON.stringify([record(2), record(1)])]) {
    data.set('measurements:v2:room', broken);
    await assert.rejects(store.load('room'), /壊れています/);
    assert.equal(data.get('measurements:v2:room'), broken);
  }
});

test('prepare で取得元の端末が決まってから、その端末の履歴を読み書きする', async () => {
  const loaded: string[] = [];
  const savedIds: string[] = [];
  const store: MeasurementStore = {
    async load(deviceId) { loaded.push(deviceId); return []; },
    async save(deviceId) { savedIds.push(deviceId); },
  };
  let deviceId = 'unresolved';
  const source: MeasurementSource = {
    label: 'auto',
    get deviceId() { return deviceId; },
    async prepare() { deviceId = 'room'; },
    async fetchSince() { return [record(1)]; },
  };
  await createMeasurementSync(source, store)(signal(), () => {});
  assert.deepEqual(loaded, ['room']);
  assert.deepEqual(savedIds, ['room']);
});
