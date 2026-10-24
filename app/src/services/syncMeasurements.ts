import type { Measurement, MeasurementSource } from '../domain/measurement';

export const DEFAULT_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

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

/** 手動同期や再開も直列化し、保存前にはACKしない。 */
export function createMeasurementSync(source: MeasurementSource, store: MeasurementStore, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('タイムアウトは正数にしてください。');
  let tail: Promise<unknown> = Promise.resolve();
  return (signal: AbortSignal, onSaved: (records: readonly Measurement[]) => void): Promise<void> => {
    const pending = tail.then(async () => {
      checkAbort(signal);
      const saved = await store.load(source.deviceId);
      checkAbort(signal);
      onSaved([...saved].reverse());
      const lastSeq = saved.at(-1)?.seq ?? 0;
      const fetched = await request((requestSignal) => source.fetchSince(lastSeq, requestSignal), signal, timeoutMs);
      checkAbort(signal);
      const bySeq = new Map(saved.map((record) => [record.seq, record]));
      let previousSeq = 0;
      for (const record of fetched) {
        if (record.deviceId !== source.deviceId || !Number.isInteger(record.seq) || record.seq <= 0 || record.seq > 0xffffffff || record.seq < previousSeq) {
          throw new Error('履歴のデバイスまたはseqの順序が不正です。');
        }
        previousSeq = record.seq;
        if (!bySeq.has(record.seq)) bySeq.set(record.seq, record);
      }
      const merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
      await store.save(source.deviceId, merged);
      checkAbort(signal);
      onSaved([...merged].reverse());
      const seq = merged.at(-1)?.seq;
      // 前回ACKだけ失敗した場合、空バッチでも保存済みのseqを再ACKする。
      if (seq !== undefined) await request((requestSignal) => source.ack(seq, requestSignal), signal, timeoutMs);
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