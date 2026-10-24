# アプリ開発のベース

## 今できること

毎時の温湿度履歴をモックからまとめて同期し、端末のAsyncStorageに保存してからACKする。起動時・バックグラウンドからの復帰時・pull-to-refresh・15分間隔で同期する。iOSのinactiveでは中断しない。履歴は起動をまたいで保持する。

画面は Figma（[アプリデザイン](https://www.figma.com/design/vLT0crJRcCHbFusl0AZodV)）の Material 3 ベースのデザインに沿う。`[グラフ] ← [メイン] → [AR]` を横スワイプで行き来し、ボタンとナビゲーションバーは置かない。「不要なセカンダリラベルや説明を避け、レイアウトに説明させる」を原則とし、状態は文言ではなく配色（リスクごとの M3 配色）・キャラの表情・数字の濃さで表す。AR は表示中かつアプリが active の間だけ背面カメラを使う。準備中・非表示・一時停止中は部屋の絵を表示し、カメラ権限の要求はARページに来た際に行う。権限拒否時は眠っているキャラと1文を表示し、キャラのタップで権限要求・設定・再試行を行う。カビ画像はリスクに応じて数と大きさが増え、仮の配置の周囲をゆっくり漂う。

BLE通信・BLE権限設定・本当の予測モデルは未実装。BLEのUUID・要求・バッチ転送・ACKの送信形式はハード担当と確定し、アプリとファームウェアを同じコミットで実装する。現在のインターフェースはアプリ内の抽象化であり、通信仕様ではない。

## 起動と確認

`app/.prototools` に合わせてNode.js 24系・pnpm 11系を使用する（corepackは使わない）。proto利用時は `app/` で `proto install` する。

```sh
cd app
pnpm install
pnpm start
pnpm typecheck
pnpm lint
pnpm test
```

モック構成はExpo Goを想定。BLEのネイティブライブラリを追加したらdevelopment buildと実機確認が必要。ページャーは ScrollView の pagingEnabled で作っており、ルーティングはないため、既存の `index.ts → App.tsx` がエントリ。

## 実装の分担

- `src/domain/measurement.ts`: seq付き履歴・取得元の型と、firmware/logstore.hの12バイトLE保存レコードのデコード。timestamp=0はnull、温度INT16_MIN・湿度0xFFFFは個別にnullへ変換する。この保存形式とBLEのフレーミングは別。
- `src/services/syncMeasurements.ts`: 保存済み最大seqを読み、fetchSince → seqで重複除去 → 永続化 → ACK。取得・ACKは各15秒でタイムアウトし、次回再試行。空バッチでも保存済み最大seqをACKし直す。中断後の結果は使用しない。
- `src/data/measurementStore.ts`: デバイスIDごとに履歴を保存。最大seqは保存済み履歴の末尾から復元するため、別キーの更新不整合はない。破損・読み書き失敗を空データで隠さず、ACKしない。
- `src/services/createAppServices.ts`: 取得元・保存先・予測を生成する差し替え場所。同一同期サービス内では手動更新や再開も直列化。
- `src/hooks/useMeasurements.ts`: 同期状態・AppStateとの連携。
- `src/hooks/useMoldPrediction.ts`: useMemoで同期的に予測。仮予測は欠測・時刻未同期ならnull。
- `src/theme/`: リスク3段階×ライト/ダークの M3 配色（`schemes.ts`、Figma の Scheme コレクションと同じ値）と、文字・余白・角丸の値。`schemeFor` でリスクから配色を選ぶ。
- `src/ui/homeState.ts`: 履歴・同期状態・予測から、表情（リスク→表情、データなし→眠り）と数字の状態（live / stale / empty / searching）を決める純粋関数。2時間より古い計測値と同期失敗中は stale。
- `src/ui/chartGeometry.ts`: 最新の計測時刻を右端とする直近24hのグラフ形状。欠測で線を切る。危険帯の下限 `HUMIDITY_DANGER_PERCENT` もここ。
- `src/ui/`: Character（おむすび形のメインキャラ）・Mold・Reading・PageIndicator・ChartCard。
- `src/screens/HomeScreen.tsx`: 3ページのページャーと、固定のページインジケーター。`MainPage`・`GraphPage`・`ARPage` が各ページ。
- `tests/`: Node test runnerとtsxによる同期・デコード・保存・モックの回帰テスト。Node型はtests/tsconfig.jsonに限定。

同期処理のabortとタイムアウトはアプリ側の待機を解除する。実BLEアダプターはsignalによるネイティブ操作のキャンセル・接続回復も実装する。abortを無視するネイティブ操作そのものの終了までは保証できない。

## モックの変更

`src/data/mock/samples.ts` の温湿度を変更する。2026-10-01 UTCを起点に毎時1件のseqを付け、配列の値を繰り返す。再取得しても同じseqの計測値・計測時刻は同じ。ACK前は再送できる。モックのACK状態はメモリ上だが、アプリ再起動時も保存済みseqから再開する。

`createMockMeasurementSource({ samples, delayMs: 300, failEvery: 4 })` で遅延や失敗を設定できる。`now` を注入して時計も固定できる。自動同期の間隔は `DEFAULT_SYNC_INTERVAL_MS`、取得・ACKの制限は `DEFAULT_REQUEST_TIMEOUT_MS`。

## 今後の実装

実データはMeasurementSourceのfetchSince/ackを実装し、単位変換と入力検証をアダプター境界に置く。seqはデバイス単位で単調増加する前提のため、初期化によるseqリセットや複数台の切り替えは別途設計する。保存済み履歴の削除・保持期間も長期運用前に決める。

予測はMoldPredictorの同期関数を差し替える。VTTに必要な長期間の毎時系列を使用し、欠測と未同期時刻の扱いもモデル側で決める。モックの固定リスクを判定基準に流用しない。

## 手動確認

- 起動時に保存済み履歴を復元し、同期後も同じseqを重複表示しない。
- アプリを終了・再起動しても履歴が残り、保存済みseqから同期する。
- pull-to-refresh で新しい毎時計測がなければ履歴が増えない。
- failEveryで失敗しても保存済み履歴が残り、次回同期で復旧する。
- バックグラウンドで停止し、復帰直後に同期する。iOSの権限ダイアログやコントロールセンターによるinactiveでは中断しない。
- 起動時とメイン・グラフページでカメラ権限が要求されず、ARページでのみ要求されることを確認する。
- ARページから離れたとき・バックグラウンド移行時のカメラ停止、復帰、権限拒否後のキャラのタップ、設定変更、起動失敗からの再試行を実機で確認する。
- 実機の描画・ネイティブストレージ・BLEは自動テストでは検証していないため実機で確認する。

## 公式資料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [AsyncStorage（SDK 58）](https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/)
- [React Native AppState](https://reactnative.dev/docs/appstate)