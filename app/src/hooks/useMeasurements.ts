import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Measurement, MeasurementSource } from '../domain/measurement';
import { DEFAULT_POLL_INTERVAL_MS, pollMeasurements } from '../services/pollMeasurements';

export const MEASUREMENT_HISTORY_LIMIT = 30;
type Status = 'loading' | 'ready' | 'error' | 'paused';

interface MeasurementState {
  readonly source: MeasurementSource;
  readonly measurements: readonly Measurement[];
  readonly status: Status;
  readonly error: string | null;
}

export function useMeasurements(
  source: MeasurementSource,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
) {
  const [state, setState] = useState<MeasurementState>({
    source, measurements: [], status: 'loading', error: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let stopPolling = () => {};

    function syncAppState(appState: string | null | undefined) {
      stopPolling();
      const active = appState === 'active' || appState == null;
      setState((previous) => ({
        source,
        measurements: previous.source === source ? previous.measurements : [],
        status: active ? 'loading' : 'paused',
        error: null,
      }));
      if (!active) return;

      stopPolling = pollMeasurements(source, {
        onMeasurement(measurement) {
          setState((previous) => ({
            source,
            measurements: [measurement, ...previous.measurements].slice(0, MEASUREMENT_HISTORY_LIMIT),
            status: 'ready',
            error: null,
          }));
        },
        onError(error) {
          setState((previous) => ({ ...previous, status: 'error', error: error.message }));
        },
      }, intervalMs);
    }

    const subscription = AppState.addEventListener('change', syncAppState);
    syncAppState(AppState.currentState);

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [source, intervalMs, refreshKey]);

  return { ...state, refresh };
}
