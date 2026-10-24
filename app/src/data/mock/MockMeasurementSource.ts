import type { MeasurementSource } from '../../domain/measurement';
import { mockSamples, type MockSample } from './samples';

interface MockSourceOptions {
  readonly samples?: readonly MockSample[];
  readonly delayMs?: number;
  /** 0なら失敗なし。例: 4なら4回に1回失敗する。 */
  readonly failEvery?: number;
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

export function createMockMeasurementSource(
  { samples = mockSamples, delayMs = 300, failEvery = 0 }: MockSourceOptions = {},
): MeasurementSource {
  if (samples.length === 0) throw new Error('モックデータを1件以上設定してください。');
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('delayMsは0以上にしてください。');
  if (!Number.isInteger(failEvery) || failEvery < 0) throw new Error('failEveryは0以上の整数にしてください。');

  let cursor = 0;
  let attempts = 0;

  return {
    label: 'モックデータ',
    async readLatest(signal) {
      const measuredAt = new Date().toISOString();
      await wait(delayMs, signal);
      if (signal.aborted) throw abortError();
      attempts += 1;
      if (failEvery > 0 && attempts % failEvery === 0) {
        throw new Error('モックの取得エラーです。次回の取得で再試行します。');
      }

      const sample = samples[cursor % samples.length];
      cursor += 1;
      return {
        deviceId: 'mock-room-01',
        temperatureC: sample.temperatureC,
        relativeHumidityPercent: sample.relativeHumidityPercent,
        measuredAt,
        receivedAt: new Date().toISOString(),
      };
    },
  };
}
