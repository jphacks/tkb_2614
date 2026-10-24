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

// BLE を初期化してアドバタイズを始める
bool bleBegin();

// 未送信件数・時刻同期の状態が変わっていたらアドバタイズの中身を更新する。loop から毎回呼ぶ
void bleLoop();

// アドバタイズの状態をシリアルに表示する
void blePrintStatus();
