#pragma once

#include <Arduino.h>

// 計測記録を LittleFS のファイルに追記して保存する。
// 1件 = 固定長 12 バイト、リトルエンディアン
//   通し番号 uint32 / タイムスタンプ（UNIX 時間、未同期は 0）uint32 /
//   温度 ×100 int16 / 湿度 ×100 uint16
// 記録はスマホから ACK（「◯番まで受信」）を受けるまで消さない。

const size_t LOG_RECORD_SIZE = 12;

// センサが読めなかったときに入れる値
const int16_t LOG_TEMP_INVALID = INT16_MIN;
const uint16_t LOG_HUM_INVALID = 0xFFFF;

struct LogRecord {
  uint32_t seq;
  uint32_t timestamp;
  int16_t temp100;
  uint16_t hum100;
};

// LittleFS をマウントし、前回の状態を読み込む。電源断で中途半端になったファイルも直す
bool logstoreBegin();

// 新しい通し番号で1件追記する。温湿度が NAN なら「読めなかった」値で記録する
bool logstoreAdd(uint32_t timestamp, float tempC, float humidity, LogRecord* out = nullptr);

// 未送信（ACK されていない）件数
uint32_t logstoreCount();

// 最後に振った通し番号（記録が1件もなければ 0）
uint32_t logstoreLastSeq();

// 古い方から index 番目（0 始まり）の記録を読む
bool logstoreRead(uint32_t index, LogRecord& rec);

// 通し番号 seq 以下の記録を削除し、削除した件数を返す
uint32_t logstoreAck(uint32_t seq);

// 記録をすべて削除する（開発用）。通し番号は続きから振る
bool logstoreClear();

// LittleFS の使用量・全容量（バイト）
size_t logstoreUsedBytes();
size_t logstoreTotalBytes();

// 記録の値を表示用の単位に直す。読めなかった値は NAN
float logTempC(const LogRecord& rec);
float logHumidity(const LogRecord& rec);
