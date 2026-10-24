#pragma once

#include <Arduino.h>

// BLE のデバイス名（スキャン時に表示される）
#define BLE_DEVICE_NAME "chiikabi"

// アドバタイズの Manufacturer Data（8 バイト、リトルエンディアン）
//   会社 ID uint16（0xFFFF = テスト用）/ 形式バージョン uint8 /
//   未送信件数 uint32 / フラグ uint8（bit0: 時刻同期済み）
const uint16_t BLE_COMPANY_ID = 0xFFFF;
const uint8_t BLE_ADV_VERSION = 1;
const uint8_t BLE_FLAG_TIME_SYNCED = 0x01;

// GATT。UUID はアプリ側にもハードコードされるので変えないこと
#define BLE_SERVICE_UUID "a29c0001-756b-4378-90b5-8651bbdbe79e"
#define BLE_STATUS_UUID "a29c0002-756b-4378-90b5-8651bbdbe79e"   // Read
#define BLE_CONTROL_UUID "a29c0003-756b-4378-90b5-8651bbdbe79e"  // Write
#define BLE_DATA_UUID "a29c0004-756b-4378-90b5-8651bbdbe79e"     // Notify

// 状態（Read、18 バイト、リトルエンディアン）
//   形式バージョン uint8 / フラグ uint8（bit0: 時刻同期済み）/ 未送信件数 uint32 /
//   最古の通し番号 uint32 / 最新の通し番号 uint32 / ESP32 の現在時刻（UNIX 時間）uint32
// 最古の通し番号は記録が無ければ 0
const size_t BLE_STATUS_SIZE = 18;
const uint8_t BLE_STATUS_VERSION = 1;

// 制御（Write、5 バイト）: 命令 uint8 + 通し番号 uint32（リトルエンディアン）
const size_t BLE_CONTROL_SIZE = 5;
const uint8_t BLE_CMD_SEND = 0x01;  // 通し番号以降の記録をデータに Notify で送る
const uint8_t BLE_CMD_ACK = 0x02;   // 通し番号以下の記録を削除する

// データ（Notify）: 12 バイトの記録（logstore.h と同じ形式）を MTU に収まるだけ詰めて送る。
// 送り終えたら、通し番号 0 の 12 バイト（全バイト 0）を終了の印として送る。
// 終了の印は最後の記録と同じ通知に入ることもある

// BLE を初期化してアドバタイズを始める
bool bleBegin();

// 届いた命令の処理、記録の送信、アドバタイズ・状態の更新を行う。loop から毎回呼ぶ
void bleLoop();

// BLE の状態をシリアルに表示する
void blePrintStatus();
