// expo-widgets が作らない Android のウィジェット用リソースを足す。
// - ウィジェットの追加画面に出すプレビュー画像（ないとアプリのアイコンとグリッドだけになる）
// - 同期中に回す同期アイコン（Glance は回転を表せないので、RemoteViews の ProgressBar で回す）
const fs = require('fs');
const path = require('path');
const { withBaseMod } = require('expo/config-plugins');

// expo-widgets の resourceNames と同じ規則（MoldCharacter → mold_character）。
function toResourceName(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

// scripts/renderWidgetImages.ts の icons.sync と同じ Material Symbols。
const SYNC_PATH =
  'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z';

const syncIconXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path android:fillColor="#FF000000" android:pathData="${SYNC_PATH}" />
</vector>
`;

// ProgressBar は indeterminate の drawable の level を回し続けるので、rotate で囲むと滑らかに回る。
const syncSpinningXml = `<?xml version="1.0" encoding="utf-8"?>
<rotate xmlns:android="http://schemas.android.com/apk/res/android"
  android:drawable="@drawable/widget_sync_icon"
  android:fromDegrees="0"
  android:toDegrees="360"
  android:pivotX="50%"
  android:pivotY="50%" />
`;

// id はパッチを当てた expo-widgets が tint を当てる先。Android 11 以前は tint できないので、色は呼び出し側の既定に任せる。
const syncSpinnerLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<ProgressBar xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/expo_widgets_tint_target"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:minWidth="0dp"
  android:minHeight="0dp"
  android:indeterminate="true"
  android:indeterminateOnly="true"
  android:indeterminateDrawable="@drawable/widget_sync_spinning"
  android:indeterminateDuration="1000" />
`;

/** @param {{ previews: Record<string, string> }} options ウィジェット名 → プレビュー画像（app/ からの相対パス）。 */
const withAndroidWidgetResources = (config, { previews }) =>
  withBaseMod(config, {
    platform: 'android',
    mod: 'dangerous',
    isProvider: false,
    async action({ modRequest: { nextMod, ...modRequest }, ...config }) {
      // expo-widgets がウィジェット情報の XML を作り直したあとで書き換えるため、先に残りの mod を走らせる。
      const results = await nextMod({ ...config, modRequest });
      const resDirectory = path.join(modRequest.platformProjectRoot, 'app/src/main/res');
      const drawableDirectory = path.join(resDirectory, 'drawable');
      const nodpiDirectory = path.join(resDirectory, 'drawable-nodpi');
      const layoutDirectory = path.join(resDirectory, 'layout');
      for (const directory of [drawableDirectory, nodpiDirectory, layoutDirectory]) fs.mkdirSync(directory, { recursive: true });

      fs.writeFileSync(path.join(drawableDirectory, 'widget_sync_icon.xml'), syncIconXml);
      fs.writeFileSync(path.join(drawableDirectory, 'widget_sync_spinning.xml'), syncSpinningXml);
      fs.writeFileSync(path.join(layoutDirectory, 'widget_sync_spinner.xml'), syncSpinnerLayoutXml);

      for (const [widgetName, source] of Object.entries(previews)) {
        const resourceName = toResourceName(widgetName);
        const previewName = `${resourceName}_preview`;
        fs.copyFileSync(path.join(modRequest.projectRoot, source), path.join(nodpiDirectory, `${previewName}.png`));
        const infoPath = path.join(resDirectory, 'xml', `${resourceName}_info.xml`);
        if (!fs.existsSync(infoPath)) throw new Error(`ウィジェット ${widgetName} の ${infoPath} がありません。app.json の expo-widgets と名前を揃えてください。`);
        const info = fs.readFileSync(infoPath, 'utf8');
        if (!info.includes('android:previewImage')) {
          fs.writeFileSync(infoPath, info.replace('<appwidget-provider ', `<appwidget-provider android:previewImage="@drawable/${previewName}" `));
        }
      }
      return results;
    },
  });

module.exports = withAndroidWidgetResources;
