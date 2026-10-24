import { useEffect } from 'react';

import { updateWidgets } from '../widgets/updateWidgets';
import type { WidgetSource } from '../widgets/widgetProps';

/** 履歴・同期状態・予測・選んでいるマスコットが変わるたびにウィジェットを更新する。 */
export function useWidgetSync({ measurements, status, prediction, lastSyncedAt, character }: WidgetSource) {
  useEffect(() => {
    // 起動直後は保存済みの履歴を読み込む前なので、前回の表示を「–」で上書きしない。
    if (status === 'loading' && measurements.length === 0) return;
    updateWidgets({ measurements, status, prediction, lastSyncedAt, character }).catch((error: unknown) => {
      console.warn('ウィジェットを更新できませんでした。', error);
    });
  }, [measurements, status, prediction, lastSyncedAt, character]);
}
