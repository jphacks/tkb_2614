import { parseMeasurement, type Measurement, type MeasurementSource } from '../domain/measurement';

export const DEFAULT_POLL_INTERVAL_MS = 5_000;

interface PollCallbacks {
  onMeasurement(measurement: Measurement): void;
  onError(error: Error): void;
}

/** 直ちに1回取得し、完了からintervalMs後に次を取得する。並列にreadしない。 */
export function pollMeasurements(
  source: MeasurementSource,
  callbacks: PollCallbacks,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
): () => void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error('取得間隔は0より大きい数値にしてください。');
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    try {
      const value = await source.readLatest(controller.signal);
      if (!controller.signal.aborted) {
        callbacks.onMeasurement(parseMeasurement(value));
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        callbacks.onError(cause instanceof Error ? cause : new Error('データの取得に失敗しました。'));
      }
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), intervalMs);
    }
  }

  void poll();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
