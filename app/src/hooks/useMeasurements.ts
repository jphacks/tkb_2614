import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Measurement } from '../domain/measurement';
import type { AppServices } from '../services/createAppServices';
import { DEFAULT_SYNC_INTERVAL_MS, scheduleMeasurementSync } from '../services/syncMeasurements';

export type SyncStatus = 'loading' | 'ready' | 'error' | 'paused';

interface MeasurementState {
  readonly measurements: readonly Measurement[];
  readonly status: SyncStatus;
  readonly error: string | null;
}

export function useMeasurements(services: AppServices, intervalMs = DEFAULT_SYNC_INTERVAL_MS) {
  const [state, setState] = useState<MeasurementState>({ measurements: [], status: 'loading', error: null });
  const [refreshKey, setRefreshKey] = useState(0);
  // 手動同期用のAPI。ホームの更新UIは意図的に設けず、通信側の接続用に維持する。
  // effect の再実行を待たずに、呼び出した描画で loading にする。
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    function syncAppState(appState: string | null | undefined) {
      if (appState === 'background') {
        stopSync?.();
        stopSync = undefined;
        setState((previous) => ({ ...previous, status: 'paused' }));
        return;
      }
      // inactiveでは中断せず、activeへの復帰でも二重起動しない。
      if (stopSync) return;
      setState((previous) => ({ ...previous, status: 'loading', error: null }));
      stopSync = scheduleMeasurementSync(services.syncMeasurements, {
        onSaved(measurements) {
          setState((previous) => ({ ...previous, measurements }));
        },
        onReady() {
          setState((previous) => ({ ...previous, status: 'ready', error: null }));
        },
        onError(error) {
          setState((previous) => ({ ...previous, status: 'error', error: error.message }));
        },
      }, intervalMs);
    }
    const subscription = AppState.addEventListener('change', syncAppState);
    syncAppState(AppState.currentState);
    return () => { subscription.remove(); stopSync?.(); };
  }, [services, intervalMs, refreshKey]);

  return { ...state, refresh };
}
