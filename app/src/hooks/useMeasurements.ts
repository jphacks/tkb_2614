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
  /** 最後に同期が成功した時刻。このプロセスでまだなら null。 */
  readonly lastSyncedAt: number | null;
  /** 保存済みの履歴を読み込んだか。読み込む前の measurements は空でも「記録がない」ことを表さない。 */
  readonly historyLoaded: boolean;
}

export function useMeasurements(services: AppServices, intervalMs = DEFAULT_SYNC_INTERVAL_MS) {
  const [state, setState] = useState<MeasurementState>({ measurements: [], status: 'loading', error: null, lastSyncedAt: null, historyLoaded: false });
  const [refreshKey, setRefreshKey] = useState(0);
  // 手動同期用のAPI。ホームの更新UIは意図的に設けず、通信側の接続用に維持する。
  // effect の再実行を待たずに、呼び出した描画で loading にする。
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    setRefreshKey((key) => key + 1);
  }, []);

  // ウィジェットの同期ボタン用。バックグラウンドでは定期同期を止めているので、1回だけ同期する。
  const syncNow = useCallback(() => {
    if (AppState.currentState !== 'background') {
      refresh();
      return;
    }
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    // 同期は直列化されているので、途中でフォアグラウンドに戻って定期同期が始まっても重ならない。
    // そのときの状態は定期同期が決めるので、ここではバックグラウンドのままのときだけ書き換える。
    const inBackground = () => AppState.currentState === 'background';
    services.syncMeasurements(new AbortController().signal, (measurements) => {
      setState((previous) => ({ ...previous, measurements, historyLoaded: true }));
    }).then(() => {
      setState((previous) => ({ ...previous, lastSyncedAt: Date.now(), ...(inBackground() ? { status: 'paused' } : {}) }));
    }, (cause: unknown) => {
      const error = cause instanceof Error ? cause.message : '同期に失敗しました。';
      if (inBackground()) setState((previous) => ({ ...previous, status: 'error', error }));
    });
  }, [services, refresh]);

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
          setState((previous) => ({ ...previous, measurements, historyLoaded: true }));
        },
        onReady() {
          setState((previous) => ({ ...previous, status: 'ready', error: null, lastSyncedAt: Date.now() }));
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

  return { ...state, refresh, syncNow };
}
