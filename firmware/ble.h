#pragma once

#include <Arduino.h>

// 形式の詳細とアプリ側の手順は docs/ble-protocol.md にまとめている。
// ここを変えたら docs/ble-protocol.md と app/ も同じコミットで直すこと。

// BLE のデバイス名（スキャン時に表示される）
#define BLE_DEVICE_NAME "chiikabi"

// アドバタイズ・状態の形式バージョン
const uint8_t BLE_PROTOCOL_VERSION = 2;

// フラグ（アドバタイズ・状態で共通）
const uint8_t BLE_FLAG_TIME_SYNCED = 0x01;  // bit0: ESP32 の時刻が同期済み

// アドバタイズの Manufacturer Data（8 バイト、リトルエンディアン）
//   会社 ID uint16（0xFFFF = テスト用）/ 形式バージョン uint8 / フラグ uint8 /
//   最新の記録の時刻 uint32（記録がなければ 0）
const uint16_t BLE_COMPANY_ID = 0xFFFF;

// GATT。UUID はアプリ側にもハードコードされるので変えないこと
#define BLE_SERVICE_UUID "a29c0001-756b-4378-90b5-8651bbdbe79e"
#define BLE_STATUS_UUID "a29c0002-756b-4378-90b5-8651bbdbe79e"   // Read
#define BLE_CONTROL_UUID "a29c0003-756b-4378-90b5-8651bbdbe79e"  // Write
#define BLE_DATA_UUID "a29c0004-756b-4378-90b5-8651bbdbe79e"     // Notify

// 状態（Read、23 バイト、リトルエンディアン）
//   形式バージョン uint8 / フラグ uint8 / 記録の件数 uint32 /
//   最古の記録の時刻 uint32 / 最新の記録の時刻 uint32 / ESP32 の現在時刻 uint32 /
//   最後に時計を合わせた時刻 uint32 / 最後に時計を合わせた手段 uint8（ClockSource）
// 時刻はすべて UNIX 時間。記録・同期がなければ 0
const size_t BLE_STATUS_SIZE = 23;

// 制御（Write、9 バイト）: 命令 uint8 + 引数（リトルエンディアン）
//   0x01 送信要求: 開始時刻 uint32 + 端末の現在時刻 uint32
//        開始時刻以降の記録を、データの Notify で古い順に全部送る。
//        ESP32 が未同期か、最後に時計を合わせてから時間が経っていれば、端末の現在時刻で合わせる
const size_t BLE_CONTROL_SIZE = 9;
const uint8_t BLE_CMD_SEND = 0x01;

// データ（Notify）: 8 バイトの記録（logstore.h と同じ形式）を MTU に収まるだけ詰めて送る。
// 送り終えたら、時刻 0 の 8 バイト（全バイト 0）を終了の印として送る。
// 終了の印は最後の記録と同じ通知に入ることもある

// BLE を初期化してアドバタイズを始める
bool bleBegin();

// 届いた命令の処理、記録の送信、アドバタイズ・状態の更新を行う。loop から毎回呼ぶ
void bleLoop();

// BLE の状態をシリアルに表示する
void blePrintStatus();
