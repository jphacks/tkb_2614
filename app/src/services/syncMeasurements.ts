import type { Measurement, MeasurementSource } from '../domain/measurement';

export const DEFAULT_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
/** デバイスと同じく1年分だけ残す（AsyncStorageの1件あたりの上限対策も兼ねる）。 */
export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export interface MeasurementStore {
  load(deviceId: string): Promise<readonly Measurement[]>;
  save(deviceId: string, measurements: readonly Measurement[]): Promise<void>;
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new Error('同期を中止しました。');
}

/** アダプターがabortを無視しても待機を解除し、遅れて返る結果を使わない。 */
async function request<T>(operation: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  checkAbort(signal);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => {
      controller.abort();
      reject(new Error('同期を中止しました。'));
    };
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('同期がタイムアウトしました。次回再試行します。'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), cancelled]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

/** 手動同期や再開も直列化し、計測時刻をキーに保存済み履歴へ上書きする。 */
export function createMeasurementSync(source: MeasurementSource, store: MeasurementStore, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('タイムアウトは正数にしてください。');
  let tail: Promise<unknown> = Promise.resolve();
  return (signal: AbortSignal, onSaved: (records: readonly Measurement[]) => void): Promise<void> => {
    const pending = tail.then(async () => {
      checkAbort(signal);
      if (source.prepare) await request((requestSignal) => source.prepare!(requestSignal), signal, timeoutMs);
      checkAbort(signal);
      const deviceId = source.deviceId;
      const saved = await store.load(deviceId);
      checkAbort(signal);
      onSaved([...saved].reverse());
      // デバイスは前より新しい時刻の記録しか作らないので、保存済みの最新以降を取れば抜けない。
      const latest = saved.at(-1);
      const since = latest ? new Date(latest.measuredAt) : null;
      const fetched = await request((requestSignal) => source.fetchSince(since, requestSignal), signal, timeoutMs);
      checkAbort(signal);
      const byTime = new Map(saved.map((record) => [Date.parse(record.measuredAt), record]));
      let previous = -Infinity;
      for (const record of fetched) {
        const time = Date.parse(record.measuredAt);
        if (record.deviceId !== deviceId || !(time > previous)) throw new Error('履歴のデバイスまたは時刻の順序が不正です。');
        previous = time;
        byTime.set(time, record);
      }
      const newest = Math.max(...byTime.keys());
      const merged = [...byTime].filter(([time]) => time > newest - RETENTION_MS).sort(([a], [b]) => a - b).map(([, record]) => record);
      await store.save(deviceId, merged);
      checkAbort(signal);
      onSaved([...merged].reverse());
    });
    tail = pending.catch(() => {});
    return pending;
  };
}

export function scheduleMeasurementSync(
  sync: ReturnType<typeof createMeasurementSync>,
  callbacks: { onSaved(records: readonly Measurement[]): void; onReady(): void; onError(error: Error): void },
  intervalMs = DEFAULT_SYNC_INTERVAL_MS,
): () => void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('同期間隔は正数にしてください。');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function run() {
    try {
      await sync(controller.signal, callbacks.onSaved);
      if (!controller.signal.aborted) callbacks.onReady();
    } catch (cause) {
      if (!controller.signal.aborted) callbacks.onError(cause instanceof Error ? cause : new Error('同期に失敗しました。'));
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => void run(), intervalMs);
    }
  }
  void run();
  return () => { controller.abort(); clearTimeout(timer); };
}