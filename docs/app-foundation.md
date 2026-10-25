# アプリ開発のベース

## 今できること

毎時の温湿度履歴を ESP32（chiikabi）から BLE でまとめて受け取り、計測時刻をキーにして端末のAsyncStorageに保存する（通信仕様は `docs/ble-protocol.md`）。chiikabi の代わりに SwitchBot 温湿度計も使える（後述）。起動時・バックグラウンドからの復帰時・pull-to-refresh・15分間隔で同期する。iOSのinactiveでは中断しない。履歴は起動をまたいで1年分保持する。

画面は Figma（[アプリデザイン](https://www.figma.com/design/vLT0crJRcCHbFusl0AZodV)）の Material 3 ベースのデザインに沿う。`[グラフ] ← [メイン] → [部屋]` を横スワイプで行き来し、ボタンとナビゲーションバーは置かない。「不要なセカンダリラベルや説明を避け、レイアウトに説明させる」を原則とし、状態は文言ではなく配色（リスクごとの M3 配色）・キャラの表情・数字の濃さで表す。部屋ページは斜め上から見下ろした木の部屋（Figma の「Room 案A」）で、窓・棚・ベッドの前に、ページを開いたときにランダムに選んだ別々のキャラを1体ずつ立たせる。キャラの表情でスポットごとの予測（`predictSpots`）を見せるので、タップしなくてもどこが危ないかがひと目でわかる。窓が結露していればガラスに水滴を出す（結露は今の外気温で判定し、取れないときは月別の表で判定する）。部屋の横幅は最初から画面幅に合わせる。キャラは窓台の上・ベッドの掛け布団の上・棚の左の床（棚の陰から顔を出す）に立つ。2本指のピンチで拡大、2本指のドラッグで移動でき（最大3倍）、2本指が触れている間はページャーを止めるので、1本指の横スワイプとはぶつからない。ダブルタップでは拡大しない（キャラのタップと区別できないため）。ページを離れても拡大は戻さない（スワイプ中に戻すとページ送りが引っかかるため）。スワイプでページを送っている間は、全ページのキャラの動きを止める（部屋のキャラ3体と同時に動かすと JS の負荷でページ送りが引っかかるため）。

カビのリスクはVTTモデル（[mold-model.md](mold-model.md)）で計算する。

## 起動と確認

`app/.prototools` に合わせてNode.js 24系・pnpm 11系を使用する（corepackは使わない）。proto利用時は `app/` で `proto install` する。

```sh
cd app
pnpm install
pnpm start:mock  # モックで起動（Expo Go）
pnpm ios         # development build を iPhone に入れて起動（BLE）
pnpm android     # development build を Android に入れて起動（BLE）
pnpm start       # 入れた development build 用に Metro だけ起動する
pnpm typecheck
pnpm lint
pnpm test
```

既定の取得元はBLE（react-native-ble-plx）で、Expo GoとiOSシミュレータでは動かない。ESP32とつなぐときは、次の節の development build を実機に入れる。ハードなしでUIを触るときは `pnpm start:mock` でモックに切り替え、Expo Go で開く。`pnpm start` で起動した Metro を Expo Go で開くと、BLE のネイティブコードがないのでエラーになる。ページャーは ScrollView の pagingEnabled で作っており、ルーティングはないため、既存の `index.ts → App.tsx` がエントリ。

## development build（実機）

ネイティブコードを含むアプリを手元でビルドし、USBでつないだ実機に入れる。`app/ios/`・`app/android/` はビルド時に `app.json` から生成され、gitには入れない。手で編集しない。

**iPhone**（Mac が必要）

1. Xcode と CocoaPods（`brew install cocoapods`）を入れる。Xcode のメニュー Xcode → Settings… の「Apple Accounts」（@ のアイコン）で Apple アカウントにサインインする（Xcode 27 で確認。Developer Program に入っていなくても、無料の Personal Team が作られる）。サインインしただけでは署名用の証明書はできないので、同じ画面でアカウントを選び、Manage Certificates… →「+」→ Apple Development で作る。これがないと `No code signing certificates are available to use.` で止まる。`security find-identity -p codesigning -v` で1件以上出れば足りている。証明書があるのに0件のときは、発行元の中間証明書（Apple WWDR G3）がキーチェーンにない。[Apple の配布ページ](https://www.apple.com/certificateauthority/)の「Worldwide Developer Relations - G3」を入れる（ダウンロードした `.cer` をダブルクリックする）。
2. iPhone を USB でつなぎ、「このコンピュータを信頼」する。iOS 16 以降は 設定 → プライバシーとセキュリティ → デベロッパモード（いちばん下）をオンにし、再起動後のダイアログで「オンにする」を選ぶ。オフのままだと `Developer Mode disabled` で止まる。
3. `app/.env.local` に自分だけの bundle identifier を書く（例: `IOS_BUNDLE_IDENTIFIER=com.<名前>.chiikabi`）。Personal Team では人ごとに値が違うので、`app.json` ではなく gitignore 済みのこのファイルに置き、`app.config.ts` が読む。`cd app && pnpm ios` を実行し、一覧から iPhone を選ぶ。
4. 初回は `No profiles for '<bundle identifier>' were found` で止まる（Expo CLI はプロファイルを作る `-allowProvisioningUpdates` を渡さない）。`xed ios` で Xcode を開き、TARGETS の app → Signing & Capabilities で Team が自分の Personal Team になっていることを確かめ、実行先に iPhone を選んで ▶ で一度ビルドする。プロファイルができるので、以後は `pnpm ios` で通る。
5. 起動しないときは、iPhone の 設定 → 一般 → VPNとデバイス管理 で自分の Apple ID を信頼する。初回起動時の Bluetooth の許可は「許可」を選ぶ。

Personal Team で入れたアプリは7日で起動しなくなるので、そのときは同じコマンドで入れ直す。

**Android**

1. Android Studio を入れ、SDK と JDK 17 を用意する（`ANDROID_HOME` を設定する）。
2. 端末の 開発者向けオプション → USBデバッグ をオンにし、USB でつなぐ。`adb devices` に出ることを確認する。
3. `cd app && pnpm android` を実行し、端末を選ぶ。初回起動時の「付近のデバイス」の許可は「許可」を選ぶ。

**入れた後**

- このビルドは Metro からJSを読み込む。2回目以降は `pnpm start` で Metro を起動し、入れたアプリを開けばよい（Mac と端末は同じ Wi-Fi にする）。JS の変更はビルドし直さなくても反映される。
- ネイティブのパッケージを足したとき・`app.json` を変えたときは、`pnpm ios` / `pnpm android` でビルドし直す。
- Metro なしで動くアプリが欲しいとき（デモなど）は `pnpm expo run:ios --device --configuration Release` / `pnpm expo run:android --device --variant release` でビルドする。
- ホーム画面ウィジェットは development build でのみ動き、Expo Go（`pnpm start:mock`）ではウィジェットの更新を読み飛ばす。iOS のウィジェットは App Group（`group.<bundle identifier>`）でアプリと値を共有する。ウィジェットの設定（`app.json` の expo-widgets）を変えたら `pnpm expo prebuild --clean` してからビルドし直す。

## 実装の分担

- `src/domain/measurement.ts`: 計測時刻が主キーの履歴と、取得元（`fetchSince(since)`）の型。欠測は温度・湿度ごとにnull。
- `src/data/ble/protocol.ts`: BLE 形式バージョン2のバイト形式（送信要求・データ通知・アドバタイズ判定・base64）。温度INT16_MIN・湿度0xFFFFはnullへ変換する。
- `src/data/ble/BleMeasurementSource.ts`: 権限要求 → Bluetoothのオン待ち → フィルタなしスキャンで `chiikabi` を探す → 接続（Android は MTU 517）→ データを購読 → 送信要求を書く → 終了の印まで受信 → 切断。abort・タイムアウトでもスキャン停止と切断をする。途中で切れた分は捨て、次回同じ要求をし直す。1台前提。
- `src/data/ble/manager.ts`: BleManager の共有（1つだけ作る）・Android の権限要求・Bluetoothのオン待ち付きのスキャン。Android は画面が消えているとフィルタなしのスキャンを始めない（`Cannot start unfiltered scan in screen-off`）。SwitchBot はサービス UUID の一覧を出さないので、ble-plx に Manufacturer Data の会社IDで絞る `manufacturerId` オプションを足した（`app/patches/react-native-ble-plx.patch`、`pnpm-workspace.yaml` の `patchedDependencies`）。取得のスキャンは SwitchBot が `0x0969`、chiikabi が `0xFFFF` で絞る。最初の端末選び（アプリを開いているときだけ）は絞らない。パッチを変えたら `app/android/build/generated/autolinking` を消してからビルドし直す（消さないと古い ble-plx のパスのままビルドされる）。
- `src/data/ble/switchbot.ts`・`SwitchBotMeasurementSource.ts`: SwitchBot 温湿度計（温湿度計・プラス・防水・Pro・Pro CO2）のアドバタイズを読む。接続しない。温湿度は Manufacturer Data（会社ID `0x0969`、会社IDの後ろ8〜10バイト目）にあればそれを、なければサービスデータ（UUID `FD3D`／古いファームは `0D00`、3〜5バイト目）を使う。Hub 2 は並びが違うので扱わない。アドバタイズには今の値しかないので、同期のたびに1件を、その時台の始まりを計測時刻にしてためる。アプリを閉じている間は、Android ならバックグラウンドの同期（後述）で埋める。deviceId は `switchbot-<Device.id>`（Android は MAC、iOS は端末ごとの UUID）。
- `src/data/ble/AutoMeasurementSource.ts`: どの温湿度計を使うかを決める。選ぶ画面は作らない。最初の同期でスキャンし、chiikabi があればそれを、なければ RSSI が -60dBm 以上（スマホのすぐそば）の SwitchBot のうち、見つけてから3秒のうちに一番強かったものを選んで（隣の部屋や会場の他人の端末を選ばないため。離れていると見つからず、同期がタイムアウトする） AsyncStorage（`sensor:v1`）に保存する。ホームのキャラを長押しすると保存した端末を忘れ、探し直す（VoiceOver/TalkBack ではカスタムアクション「温湿度計を探し直す」）。長押しが効いたら、探し直した同期が終わるまでキャラの下に回る同期アイコン（`src/ui/SyncIndicator.tsx`、ウィジェットと同じ形）を出す。非公式である旨と参考にした資料は README に書いた。
- `src/services/backgroundSync.ts`: アプリを閉じている間も同期する（expo-background-task、Android の WorkManager）。間隔は最短の15分で、実際には OS が遅らせることがある。WorkManager の条件でネットにつながっていないと動かない（BLE しか使わなくても）。画面と同じ AppServices（`getAppServices`）を使うので、開いている間の同期とは直列になる。`index.ts` で App より前に定義・登録し、Expo Go（ネイティブモジュールなし）では読み込まない。iOS は実行の時期を OS が決めるので登録しない（バックグラウンドの BLE スキャンにはサービス UUID の指定が要るが、SwitchBot は出していない）。
- `src/services/syncMeasurements.ts`: 取得元に `prepare` があれば先に呼んで端末を決め、保存済みの最新計測時刻を読み、その時刻以上をfetchSince → 計測時刻で上書きマージ → 1年より古い分を捨てて永続化。初回は全件。取得は既定15秒（BLEは60秒）でタイムアウトし、次回再試行。中断後の結果は使用しない。
- `src/data/measurementStore.ts`: デバイスIDごとに履歴を保存（キーは `measurements:v2:`）。最新時刻は保存済み履歴の末尾から復元するため、別キーの更新不整合はない。破損・読み書き失敗を空データで隠さない。
- `src/services/createAppServices.ts`: 取得元・保存先・予測を生成する差し替え場所。`EXPO_PUBLIC_MEASUREMENT_SOURCE=mock` でモック、それ以外はBLE（`AutoMeasurementSource`）。同一同期サービス内では手動更新や再開も直列化。
- `src/hooks/useMeasurements.ts`: 同期状態・AppStateとの連携。
- `src/domain/moldModel.ts`: VTTモデル。月別のΔTで表面の温湿度を推定し、履歴を古い順に1時間ずつMを更新する。間隔はmeasuredAtの差で求め、3時間以内の欠測は直前の条件で埋め、それより長い欠測ではMを保持する。連続した観測が7日未満なら `isProvisional`。M=1までの日数は将来を1時間ずつシミュレーションして求める。月別ΔT・湿度オフセット・Cmatは `createVttMoldPredictor` の引数で調整する。
- `src/hooks/useMoldPrediction.ts`: useMemoで同期的に予測。
- `src/domain/weather.ts`: 現在地の今の外の天気（気温・相対湿度・降水量・風速・昼夜・観測時刻・取得時刻）と、取得元（`fetchCurrent`）の型。権限の拒否・オフライン・APIの失敗ではnullを返し、画面は「外の天気なし」で動かす。
- `src/data/weather/OpenMeteoWeatherSource.ts`: Open-Meteo の `current` を取得する。位置は小数2桁（約1km）に丸めて送る。取得から30分は AsyncStorage（キー `weather:v1`）のキャッシュを返し、位置もAPIも使わない。失敗はキャッシュしない。
- `src/data/weather/deviceLocation.ts`: expo-location で使用中のみの位置権限を要求し、直近1時間の位置か、精度 Low の現在地を返す。拒否されたら null。
- `src/hooks/useOutdoorWeather.ts`: 起動時・フォアグラウンド復帰時と、フォアグラウンドにいる間は5分ごと（`WEATHER_REFRESH_MS`）に天気を取得する。キャッシュが残っていればそれが返るので、開いたままでも30分を過ぎたら取り直される。
- `src/theme/`: リスク3段階×ライト/ダークの M3 配色（`schemes.ts`、Figma の Scheme コレクションと同じ値）と、文字・余白・角丸の値。`schemeFor` でリスクから配色を選ぶ。
- `src/ui/homeState.ts`: 履歴・同期状態・予測から、表情（リスク→表情、データなし→眠り）と数字の状態（live / stale / empty / searching）を決める純粋関数。2時間より古い計測値と同期失敗中は stale。
- `src/ui/roomGeometry.ts`: 部屋の絵の形状（Figma の「Room 案A」をアイソメトリックの投影 `project(x, y, z)` で起こしたもの）、スポット（`SpotId`）ごとのキャラの立ち位置と、窓の結露の水滴。色はテーマの色名か固定の木の色で持つ。
- `src/ui/chartGeometry.ts`: 最新の計測時刻を右端とする直近24hのグラフ形状。欠測で線を切る。危険帯の下限 `HUMIDITY_DANGER_PERCENT` もここ。
- `src/ui/`: Character（おむすび形のメインキャラ）・Reading・PageIndicator・ChartCard。
- `src/screens/HomeScreen.tsx`: 3ページのページャーと、固定のページインジケーター。`GraphPage`・`MainPage`・`RoomPage` が各ページ。
- `src/widgets/`: ホーム画面ウィジェット（expo-widgets）。Figma の Widgets セクションと同じ5種類（キャラ・湿度・温度・同期時刻の小サイズと、それらをまとめた中サイズ）。レイアウトは `ios/`（`@expo/ui/swift-ui`）と `android/`（`@expo/ui/jetpack-compose`）に分かれ、`'widget'` の関数は別ランタイムで動くため外側の値やモジュールを参照できない。表示する値・配色は `widgetProps.ts` の純粋関数で文字列にして渡し、古さと表情は `deriveHomeState` と同じ判定にする。iOS は15分ごとのタイムラインで「◯分前」と古さを先回りして更新し、Android はスナップショットのみ。ウィジェットは BLE を使わず、アプリが最後に同期した値を表示する。
- `scripts/renderWidgetImages.ts`: ウィジェットは SVG を描けないので、`assets/mascots` の5種類×危険度3段階のマスコットとアイコンを `assets/widgets/` に PNG で書き出す。マスコットの SVG を変えたら `pnpm render:widget-images` で作り直す。ウィジェットはメイン画面で選んでいるマスコットを表示し、計測値がないときはアプリと同じく low の絵を薄く出す。iOS はアプリが App Group の共有ディレクトリへ画像をコピーし、Android のリリースビルドは drawable 名をそのまま渡す。
- `tests/`: Node test runnerとtsxによる同期・デコード・保存・モックの回帰テスト。Node型はtests/tsconfig.jsonに限定。

同期処理のabortとタイムアウトはアプリ側の待機を解除し、BLEアダプターはsignalでスキャン停止・切断する。abortを無視するネイティブ操作そのものの終了までは保証できない。

## モックの変更

`src/data/mock/samples.ts` の温湿度を変更する。2026-10-01 UTCを起点に毎時1件を作り、配列の値を繰り返す。起点は `createMockMeasurementSource` の `epoch` で変えられる（冬の挙動を見るときは1月にする）。BLEと同じく、since以上の時刻の記録を返し、再取得しても同じ時刻の計測値は同じ。

`createMockMeasurementSource({ samples, delayMs: 300, failEvery: 4 })` で遅延や失敗を設定できる。外の天気のモックは `src/data/mock/MockWeatherSource.ts` で、`createMockWeatherSource({ weather: null })` にすると「外の天気なし」を再現できる。天気の取得元は `EXPO_PUBLIC_WEATHER_SOURCE`（`mock` / `open-meteo`）で計測とは別に選べ、未指定なら計測と同じになる。expo-location は Expo Go に含まれるので、`EXPO_PUBLIC_MEASUREMENT_SOURCE=mock` と `EXPO_PUBLIC_WEATHER_SOURCE=open-meteo` を併せて指定すれば、Expo Go で実際の Open-Meteo を試せる。`now` を注入して時計も固定できる。自動同期の間隔は `DEFAULT_SYNC_INTERVAL_MS`、取得の制限は `DEFAULT_REQUEST_TIMEOUT_MS`。

## 今後の実装

chiikabi 同士の複数台の切り替えは未対応（chiikabi の deviceId は `chiikabi` 固定）。ペアリングが入ったら、初回接続時のOSのダイアログで同期がタイムアウトしないかを確認する。

月別ΔTは地域・住宅の差を見ていない概算。外気温を取得できるようになったら、ΔT=(1−fRsi)(室温−外気温) で求める（[mold-model.md](mold-model.md)）。参考値（`isProvisional`）の画面での見せ方は未定。

## 手動確認

- 起動時に保存済み履歴を復元し、同期後も同じ計測時刻を重複表示しない。
- アプリを終了・再起動しても履歴が残り、保存済みの最新時刻から同期する（ESP32 のシリアルで開始時刻を確認できる）。
- ESP32 の電源を切ると数字が薄くなり（stale）、電源を戻すと次回の同期で回復する。
- pull-to-refresh で新しい毎時計測がなければ履歴が増えない。
- failEveryで失敗しても保存済み履歴が残り、次回同期で復旧する。
- バックグラウンドで停止し、復帰直後に同期する。iOSの権限ダイアログやコントロールセンターによるinactiveでは中断しない。
- 部屋ページで、冬のモックでは窓のキャラが危ない表情になり、ほかが穏やかな表情になることを確認する。2本指で拡大・移動したあとも、1本指の横スワイプでページを移動できることを確認する（iOS シミュレータでは Option を押しながらドラッグでピンチ、Option+Shift で2本指の平行移動）。縦横比の違う端末（タブレットを含む）で部屋とキャラが見切れないことを確認する。
- Android のバックグラウンド同期: アプリをホームに下げ、`adb shell cmd jobscheduler run -f <パッケージ名> <JOB_ID>`（JOB_ID は `adb shell dumpsys jobscheduler` で探す）で今すぐ動かし、開き直すとグラフに点が増えている。画面を消した状態でも試す。
- 実機の描画・ネイティブストレージ・BLEは自動テストでは検証していないため実機で確認する。

## 公式資料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [AsyncStorage（SDK 58）](https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/)
- [React Native AppState](https://reactnative.dev/docs/appstate)