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

/** 固定の起点から毎時1件生成。再起動・再取得でも同じ時刻は同じ計測値。 */
export function createMockMeasurementSource(
  { samples = mockSamples, delayMs = 300, failEvery = 0, now = Date.now }: MockSourceOptions = {},
): MeasurementSource {
  if (samples.length === 0) throw new Error('モックデータを1件以上設定してください。');
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('delayMsは0以上にしてください。');
  if (!Number.isInteger(failEvery) || failEvery < 0) throw new Error('failEveryは0以上の整数にしてください。');
  const deviceId = 'mock-room-01';
  const epoch = Date.UTC(2026, 9, 1);
  const hour = 60 * 60 * 1000;
  let attempts = 0;
  return {
    label: 'モックデータ',
    deviceId,
    async fetchSince(since, signal) {
      await wait(delayMs, signal);
      if (signal.aborted) throw abortError();
      attempts += 1;
      if (failEvery > 0 && attempts % failEvery === 0) throw new Error('モックの取得エラーです。次回の同期で再試行します。');
      // デバイスと同じく、since以上の時刻の記録を古い順に返す。
      const first = since === null ? 0 : Math.max(0, Math.ceil((since.getTime() - epoch) / hour));
      const last = Math.floor((now() - epoch) / hour);
      const records: Measurement[] = [];
      for (let i = first; i <= last; i += 1) {
        records.push({
          ...samples[i % samples.length],
          deviceId,
          measuredAt: new Date(epoch + i * hour).toISOString(),
          receivedAt: new Date(now()).toISOString(),
        });
      }
      return records;
    },
  };
}