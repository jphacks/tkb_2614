# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

JPHACKS のチームリポジトリ。ESP32 と Si7021 で室内の温度・湿度を測り、BLE でスマホアプリに送って、部屋のカビやすさを可視化する。

- `firmware/`: ESP32 の Arduino スケッチ（BLE peripheral）。Si7021 を I2C で読み、1時間ごとの温湿度を計測時刻を主キーにして LittleFS に1年分ためる。アプリが数分おきに接続し、開始時刻を指定して記録をまとめて Notify で受け取る（polling）。
- `app/`: Expo（React Native, TypeScript）のアプリ（BLE central）。JS パッケージはこれ1つだけなので、pnpm workspace は作っていない。

サーバーはなく、ESP32 とスマホが BLE で直接つながる。

## firmware と app にまたがる取り決め

- BLE の Service/Characteristic の UUID と payload の形式は、両側にハードコードされる。仕様は `docs/ble-protocol.md` にまとめている。変えるときは `firmware/`・`app/`・`docs/ble-protocol.md` を同じコミットで直す。
- カビリスクの判定はアプリ側で行い、ESP32 は計測値を送るだけにする。判定基準を変えるたびにファームウェアを書き込み直さなくて済む。計算方法は `docs/mold-model.md` にまとめている。

## プロダクトの方針

誰に向けて何を作るかは `docs/persona.md` にまとめている。メインのペルソナは B（一度カビが生えて困った、一人暮らしの賃貸住まいの人）で、A と C は「するべきでないこと」の判断に使う。

- 機能、画面、通知、リスク表示の文言を足したり変えたりするときは、`docs/persona.md` の「するべきでないこと」に当たらないか確かめる（`persona-review` スキル）。
- ヒアリングや実測で新しい情報が入ったら、`persona-study` スキルで `docs/persona.md` を更新する。

## スキル

チームで作ったスキルは `.agents/skills/` に置き、`.claude/skills/` からシンボリックリンクを張る。Claude Code と Codex の両方から同じファイルを読むためである。外部から入れたスキル（material-3）は `skills-lock.json` で管理していて、両方のディレクトリに実体がある。

## firmware

チームは VSCode の Arduino 拡張（中身は arduino-cli）で Verify/Upload している。ボード設定は `.vscode/arduino.json` と `firmware/.vscode/arduino.json` にある（汎用の `esp32:esp32:esp32`）。NimBLE を入れるとデフォルトのパーティションではプログラム領域が足りなくなるので、パーティションは `huge_app`（プログラム 3MB、OTA なし）にしている。パーティションを変えると LittleFS の記録は消える。Arduino の制約で、スケッチのフォルダ名と `.ino` のファイル名は一致させる必要がある。

arduino-cli は PATH に入っていない場合がある。CLI から操作する場合のコマンドは以下（リポジトリのルートで実行する）。

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install "NimBLE-Arduino@2.5.1"
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app firmware
arduino-cli upload -p <port> --fqbn esp32:esp32:esp32:PartitionScheme=huge_app firmware
arduino-cli monitor -p <port> -c baudrate=115200
```

BLE には NimBLE-Arduino（2.x）を使う。esp32 コア同梱の `BLEDevice.h` より軽い。

## app

詳しくは `app/AGENTS.md`（`app/CLAUDE.md` から読み込まれる）を参照。ただし blank-typescript テンプレートから作ったので Expo Router は入っておらず、エントリは `app/App.tsx` になっている。AGENTS.md の Routing の節は、Expo Router を導入するまで当てはまらない。

開発環境によっては `npx` が `pnpm dlx` に割り当てられていて、ローカルのバイナリを実行できない。AGENTS.md に書かれている `npx expo ...` や `npx tsc` は、`pnpm expo ...` や `pnpm exec tsc` に置き換えて実行する。

```bash
cd app
pnpm install
pnpm start                     # Metro を起動する
pnpm typecheck                 # 型チェック（tests/ も含む）
pnpm lint
pnpm test
pnpm expo install <package>    # パッケージ追加は pnpm add ではなくこれを使う
```

BLE ライブラリ（react-native-ble-plx など）はネイティブコードを含むため、導入すると Expo Go では動かなくなり、development build（`pnpm expo run:ios` / `run:android`）が必要になる。iOS シミュレータでは BLE が使えないので、動作確認は実機で行う。

## パッケージ管理

pnpm を使う（corepack は使わない）。
