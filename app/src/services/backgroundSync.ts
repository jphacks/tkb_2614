import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getAppServices } from './createAppServices';

const TASK_NAME = 'background-measurement-sync';
/** WorkManager の最短間隔（分）。SwitchBot は今の値しか送らないので、1時間に1件を逃さないよう最短にする。 */
const INTERVAL_MINUTES = 15;

// アプリが閉じているときは JS だけが起動してこのタスクを呼ぶので、App より前（index.ts）で定義する。
// 画面と同じ AppServices を使い、アプリを開いているときの同期とは syncMeasurements の中で直列になる。
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await getAppServices().syncMeasurements(new AbortController().signal, () => {});
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('バックグラウンドの同期に失敗しました。', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * アプリを閉じている間も温湿度を取りにいくよう登録する。Android だけ。
 * iOS の BGTaskScheduler は実行の時期を OS が決めて間隔が守られず、フィルタなしの BLE スキャンもバックグラウンドでは結果が来ない。
 * モックはアプリを開いている間に全件を返せるので登録しない。
 */
export async function registerBackgroundSync() {
  if (Platform.OS !== 'android' || process.env.EXPO_PUBLIC_MEASUREMENT_SOURCE === 'mock') return;
  if (await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) return;
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
}
