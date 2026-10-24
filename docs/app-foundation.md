# アプリ開発のベース

## 今できること

毎時の温湿度履歴をモックからまとめて同期し、端末のAsyncStorageに保存してからACKする。起動時・バックグラウンドからの復帰時・「今すぐ同期」・15分間隔で同期する。iOSのinactiveでは中断しない。最新の計測値・計測時刻・受信時刻・履歴・仮の予測を表示する。履歴は起動をまたいで保持し、画面は最新30件に絞る。

BLE通信・権限設定・本当の予測モデルは未実装。BLEのUUID・要求・バッチ転送・ACKの送信形式はハード担当と確定し、アプリとファームウェアを同じコミットで実装する。現在のインターフェースはアプリ内の抽象化であり、通信仕様ではない。

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

モック構成はExpo Goを想定。BLEのネイティブライブラリを追加したらdevelopment buildと実機確認が必要。単一画面のため、既存の `index.ts → App.tsx` がエントリ。

## 実装の分担

- `src/domain/measurement.ts`: seq付き履歴・取得元の型と、firmware/logstore.hの12バイトLE保存レコードのデコード。timestamp=0はnull、温度INT16_MIN・湿度0xFFFFは個別にnullへ変換する。この保存形式とBLEのフレーミングは別。
- `src/services/syncMeasurements.ts`: 保存済み最大seqを読み、fetchSince → seqで重複除去 → 永続化 → ACK。取得・ACKは各15秒でタイムアウトし、次回再試行。空バッチでも保存済み最大seqをACKし直す。中断後の結果は使用しない。
- `src/data/measurementStore.ts`: デバイスIDごとに履歴を保存。最大seqは保存済み履歴の末尾から復元するため、別キーの更新不整合はない。破損・読み書き失敗を空データで隠さず、ACKしない。
- `src/services/createAppServices.ts`: 取得元・保存先・予測を生成する差し替え場所。同一同期サービス内では手動更新や再開も直列化。
- `src/hooks/useMeasurements.ts`: 同期状態・AppStateとの連携。
- `src/hooks/useMoldPrediction.ts`: useMemoで同期的に予測。仮予測は欠測・時刻未同期ならnull。
- `src/screens/EnvironmentScreen.tsx`: 最新値・欠測表示・最新30件の表示・手動同期。
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
- 「今すぐ同期」で新しい毎時計測がなければ履歴が増えない。
- failEveryで失敗しても保存済み履歴が残り、次回同期で復旧する。
- バックグラウンドで停止し、復帰直後に同期する。iOSの権限ダイアログやコントロールセンターによるinactiveでは中断しない。
- 実機の描画・ネイティブストレージ・BLEは自動テストでは検証していないため実機で確認する。

## 公式資料

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [AsyncStorage（SDK 58）](https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/)
- [React Native AppState](https://reactnative.dev/docs/appstate)