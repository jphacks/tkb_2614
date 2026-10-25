import { registerRootComponent, requireOptionalNativeModule } from 'expo';

import App from './App';

// アプリが閉じているときは JS だけが起動してバックグラウンドのタスクを呼ぶので、App より前でタスクを定義・登録する。
// Expo Go には expo-background-task のネイティブモジュールがなく、import した時点で落ちる。development build のときだけ読み込む。
if (requireOptionalNativeModule('ExpoBackgroundTask') !== null) {
  const { registerBackgroundSync } = require('./src/services/backgroundSync') as typeof import('./src/services/backgroundSync');
  registerBackgroundSync().catch((error: unknown) => console.warn('バックグラウンドの同期を登録できませんでした。', error));
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
