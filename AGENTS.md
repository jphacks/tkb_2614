# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

JPHACKS のチームリポジトリ。ESP32 と BME280 で室内の温度・湿度を測り、BLE でスマホアプリに送って、部屋のカビやすさを可視化する。

- `firmware/`: ESP32 の Arduino スケッチ（BLE peripheral）。BME280 は I2C で読み、最新の値を BLE の read 可能な Characteristic に置く。ESP32 からは送信せず、アプリが定期的に read しに行く（polling）。
- `app/`: Expo（React Native, TypeScript）のアプリ（BLE central）。JS パッケージはこれ1つだけなので、pnpm workspace は作っていない。

サーバーはなく、ESP32 とスマホが BLE で直接つながる。

## firmware と app にまたがる取り決め

- BLE の Service/Characteristic の UUID と payload の形式は、両側にハードコードされる。変えるときは `firmware/` と `app/` を同じコミットで直す。
- カビリスクの判定はアプリ側で行い、ESP32 は計測値を送るだけにする。判定基準を変えるたびにファームウェアを書き込み直さなくて済む。

## firmware

チームは VSCode の Arduino 拡張（中身は arduino-cli）で Verify/Upload している。ボード設定は `firmware/.vscode/arduino.json` にある（今は汎用の `esp32:esp32:esp32`）。Arduino の制約で、スケッチのフォルダ名と `.ino` のファイル名は一致させる必要がある。

arduino-cli は PATH に入っていない場合がある。CLI から操作する場合のコマンドは以下（リポジトリのルートで実行する）。

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install "Adafruit BME280 Library"
arduino-cli compile --fqbn esp32:esp32:esp32 firmware
arduino-cli upload -p <port> --fqbn esp32:esp32:esp32 firmware
arduino-cli monitor -p <port> -c baudrate=115200
```

BLE には esp32 コアに同梱の `BLEDevice.h` を使う。

## app

詳しくは `app/AGENTS.md`（`app/CLAUDE.md` から読み込まれる）を参照。ただし blank-typescript テンプレートから作ったので Expo Router は入っておらず、エントリは `app/App.tsx` になっている。AGENTS.md の Routing の節は、Expo Router を導入するまで当てはまらない。

開発環境によっては `npx` が `pnpm dlx` に割り当てられていて、ローカルのバイナリを実行できない。AGENTS.md に書かれている `npx expo ...` や `npx tsc` は、`pnpm expo ...` や `pnpm exec tsc` に置き換えて実行する。

```bash
cd app
pnpm install
pnpm start                     # Metro を起動する
pnpm exec tsc --noEmit         # 型チェック
pnpm expo install <package>    # パッケージ追加は pnpm add ではなくこれを使う
```

BLE ライブラリ（react-native-ble-plx など）はネイティブコードを含むため、導入すると Expo Go では動かなくなり、development build（`pnpm expo run:ios` / `run:android`）が必要になる。iOS シミュレータでは BLE が使えないので、動作確認は実機で行う。

## パッケージ管理

pnpm を使う（corepack は使わない）。
