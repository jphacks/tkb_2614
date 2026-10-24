# アプリ開発のベース

## 今できること

モックの温湿度を起動直後に取得し、取得完了の5秒後に次の値を取得する。最新値・受信時刻・最大30件の取得履歴・仮の予測を簡単な画面で表示する。「今すぐ取得」で手動更新できる。デザインと本当の予測処理は今後実装する。

通信方式はまだ決めていないため、BLEの依存追加・権限設定・ファームウェア変更はしていない。アプリ内データと取得元・予測の契約は [contracts.md](./contracts.md) を参照。

## 起動と確認

`app/.prototools` に合わせてNode.js 24系・pnpm 11系を使用する（corepackは使わない）。protoを導入している場合は `app/` で `proto install` を実行して指定バージョンを用意する。

pnpm 11で開発ツールをインストールできるよう、`app/pnpm-workspace.yaml` の `allowBuilds` で `esbuild`（tsx用）と `unrs-resolver`（lint用）のビルドを許可している。

```sh
cd app
pnpm install
pnpm start

# 別ターミナルから実行
pnpm typecheck
pnpm lint
pnpm test
```

現在のモック構成はExpo Goで動作させる想定。MetroのQRからスマホで開く。ネイティブBLEライブラリを追加する際はdevelopment buildと実機確認が必要になる。Web向けの追加依存は今回導入していない。

## 構成と責務

```text
app/
  App.tsx                              # 依存を1度生成し、画面へ渡す
  src/
    domain/
      measurement.ts                   # 計測値・取得元の型と入力検証
      prediction.ts                    # 予測の型とインターフェース
    data/mock/
      samples.ts                       # 差し込む温湿度データ
      MockMeasurementSource.ts         # モック取得元（遅延・失敗も再現可能）
      PlaceholderMoldPredictor.ts       # 仮の固定値を返す予測
    services/
      createAppServices.ts             # 具体的な取得元・予測実装の選択
      pollMeasurements.ts              # 逐次取得・再試行・停止
    hooks/
      useMeasurements.ts               # 取得状態・メモリ履歴・アプリ状態との連携
      useMoldPrediction.ts             # 予測状態・古い結果の破棄
    screens/
      EnvironmentScreen.tsx            # 表示と手動再取得
  tests/                               # データ境界・取得ライフサイクル等のテスト
```

現時点では単一画面。Expo Routerや状態管理ライブラリは追加せず、既存の `index.ts → App.tsx` を維持している。画面はhooksと注入されたインターフェースを使い、モック実装を直接参照しない。

## モック値を変更する

`app/src/data/mock/samples.ts` の `mockSamples` に温度（°C）と相対湿度（%）を追加・変更する。配列は上から順に取得され、末尾の次は先頭へ戻る。受信・計測時刻は取得時に生成される。

別の配列を渡すこともできる。`createAppServices.ts` の生成箇所を変更する。

```ts
measurementSource: createMockMeasurementSource({
  samples: [
    { temperatureC: 22.5, relativeHumidityPercent: 45 },
    { temperatureC: 27.0, relativeHumidityPercent: 85 },
  ],
  delayMs: 300,
  failEvery: 4, // 4回に1回エラー。0なら失敗しない
}),
```

取得周期は `pollMeasurements.ts` の `DEFAULT_POLL_INTERVAL_MS`、履歴上限は `useMeasurements.ts` の `MEASUREMENT_HISTORY_LIMIT`。モックのカーソルはアプリ起動時に初期化される。Fast Refreshで状態が保持される場合はアプリをリロードする。

## 実データ・予測・画面を実装する場所

1. **実データ:** `MeasurementSource` を実装するアダプターを追加し、`createAppServices.ts` の `measurementSource` を差し替える。payloadの解析、単位変換、時計未同期の扱い、通信のタイムアウトや中断処理はアダプターに置く。画面からBLE等を直接呼ばない。
2. **予測:** `MoldPredictor` を実装し、同じ生成箇所の `moldPredictor` を差し替える。モックの固定区分を判定基準として流用しない。本物の結果では `isPlaceholder: false` を返す。
3. **デザイン:** `EnvironmentScreen.tsx` を作り替える。計測値・取得状態・履歴は `useMeasurements`、予測とその状態は `useMoldPrediction` から取得できる。

永続化・複数台対応・バックグラウンド取得・実通信・本当のリスク判定と予測は未実装。保存方法や長期間の履歴を前提とした予測を導入する際は、データ契約と履歴管理を見直す。

## テストと手動確認

自動テストはNode標準のtest runnerとtsxを使用する。センサー入力の境界値・不正値、モックの循環とエラー、取得の重複防止、停止後の通知抑止、エラー後の再取得、仮予測の契約を確認する。React Nativeの描画や実機動作を検証するテストではない。

実機では以下を確認する。

- 起動直後に取得中表示が出て、温湿度と「仮の固定値」の予測が表示される。
- 自動更新と「今すぐ取得」で値が進み、最新順の履歴が最大30件に収まる。
- `failEvery: 4` で取得失敗時にも前回値が残り、次の成功でエラーが解除される。
- 初回エラーは `failEvery: 1` で再現でき、履歴0件のまま再試行できる。
- アプリをバックグラウンドにすると取得が止まり、復帰直後に再取得する。
- 通信方式や予測実装を差し替えるときは、それぞれのアダプター・実装に固有のテストも追加する。

## 参照した公式ドキュメント

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Safe area context（SDK 58）](https://docs.expo.dev/versions/v58.0.0/sdk/safe-area-context/)
- [Expo ESLint設定](https://docs.expo.dev/guides/using-eslint/)
- [React Native AppState](https://reactnative.dev/docs/appstate)
