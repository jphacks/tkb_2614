import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { buildWidgetTimeline, deriveWidgetProps, type WidgetImages, type WidgetSource } from './widgetProps';

// Expo Go には expo-widgets のネイティブモジュールがなく、import した時点で落ちる。
// モックを Expo Go で確認できるよう、development build のときだけ読み込む。
const widgetsAvailable = requireOptionalNativeModule('ExpoWidgets') !== null;

/** ホーム画面のウィジェットを最新の履歴で描き直す。BLE はアプリだけが使うので、表示はアプリが最後に同期した値になる。 */
export async function updateWidgets(source: WidgetSource, now = Date.now()): Promise<void> {
  if (!widgetsAvailable) return;
  const [{ moldWidgets }, { prepareWidgetImages }] = await Promise.all([import('./registry'), import('./widgetImages')]);
  if (moldWidgets.length === 0) return;
  // 画像を用意できなくても、数値だけは更新する。
  const images: WidgetImages | null = await prepareWidgetImages().catch((error: unknown) => {
    console.warn('ウィジェット用の画像を用意できませんでした。', error);
    return null;
  });
  if (Platform.OS === 'ios') {
    const timeline = buildWidgetTimeline(source, images, now);
    for (const widget of moldWidgets) widget.updateTimeline(timeline);
  } else {
    const props = deriveWidgetProps(source, images, now);
    for (const widget of moldWidgets) widget.updateSnapshot(props);
  }
}
