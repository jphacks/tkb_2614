import { useEffect, useRef } from 'react';

import { addWidgetSyncListener, updateWidgets } from '../widgets/updateWidgets';
import type { WidgetSource } from '../widgets/widgetProps';

/**
 * 履歴・同期状態・予測・選んでいるマスコットが変わるたびにウィジェットを更新する。
 * 保存済みの履歴を読み込む前（historyLoaded が false）は、前回の表示を「–」で上書きしない。
 */
export function useWidgetSync({ measurements, status, prediction, lastSyncedAt, character }: WidgetSource, historyLoaded: boolean) {
  useEffect(() => {
    if (!historyLoaded) return;
    updateWidgets({ measurements, status, prediction, lastSyncedAt, character }).catch((error: unknown) => {
      console.warn('ウィジェットを更新できませんでした。', error);
    });
  }, [historyLoaded, measurements, status, prediction, lastSyncedAt, character]);
}

/** ウィジェットの同期ボタンが押されたら onSync を呼ぶ。 */
export function useWidgetSyncRequests(onSync: () => void) {
  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);
  useEffect(() => addWidgetSyncListener(() => onSyncRef.current()), []);
}
