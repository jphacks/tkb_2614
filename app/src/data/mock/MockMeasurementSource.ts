import type { Measurement, MeasurementSource } from '../../domain/measurement';
import { mockSamples, type MockSample } from './samples';

interface MockSourceOptions {
  readonly samples?: readonly MockSample[];
  readonly delayMs?: number;
  /** 0なら失敗なし。例: 4なら4回に1回失敗する。 */
  readonly failEvery?: number;
  readonly now?: () => number;
}

function abortError(): Error {
  const error = new Error('取得を中止しました。');
  error.name = 'AbortError';
  return error;
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(abortError());
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** 固定の起点から毎時1件生成。再起動・再取得でも同一seqは同一計測値。 */
export function createMockMeasurementSource(
  { samples = mockSamples, delayMs = 300, failEvery = 0, now = Date.now }: MockSourceOptions = {},
): MeasurementSource {
  if (samples.length === 0) throw new Error('モックデータを1件以上設定してください。');
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('delayMsは0以上にしてください。');
  if (!Number.isInteger(failEvery) || failEvery < 0) throw new Error('failEveryは0以上の整数にしてください。');
  const deviceId = 'mock-room-01';
  const epoch = Date.UTC(2026, 9, 1);
  const hour = 60 * 60 * 1000;
  let ackedSeq = 0;
  let attempts = 0;
  return {
    label: 'モックデータ',
    deviceId,
    async fetchSince(afterSeq, signal) {
      await wait(delayMs, signal);
      if (signal.aborted) throw abortError();
      attempts += 1;
      if (failEvery > 0 && attempts % failEvery === 0) throw new Error('モックの取得エラーです。次回の同期で再試行します。');
      const lastSeq = Math.max(0, Math.floor((now() - epoch) / hour) + 1);
      // 未ACKの履歴をまとめて返す。
      const records: Measurement[] = [];
      for (let seq = Math.max(afterSeq, ackedSeq) + 1; seq <= lastSeq; seq += 1) {
        records.push({
          ...samples[(seq - 1) % samples.length],
          seq, deviceId,
          measuredAt: new Date(epoch + (seq - 1) * hour).toISOString(),
          receivedAt: new Date(now()).toISOString(),
        });
      }
      return records;
    },
    async ack(seq, signal) {
      if (signal.aborted) throw abortError();
      ackedSeq = Math.max(ackedSeq, seq);
    },
  };
}