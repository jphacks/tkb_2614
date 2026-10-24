#pragma once

#include <Arduino.h>

// 計測記録を LittleFS のファイルに追記して保存する。
// 1件 = 固定長 8 バイト、リトルエンディアン
//   計測時刻（UNIX 時間）uint32 / 温度 ×100 int16 / 湿度 ×100 uint16
// 計測時刻が主キー。記録は時刻の昇順に並び、同じ時刻の記録はない。
// 追記するたびに、その時刻から LOG_RETENTION_SEC より古い記録を消す。

const size_t LOG_RECORD_SIZE = 8;

// 記録を残す期間（1年）
const uint32_t LOG_RETENTION_SEC = 365UL * 24 * 60 * 60;

// センサが読めなかったときに入れる値
const int16_t LOG_TEMP_INVALID = INT16_MIN;
const uint16_t LOG_HUM_INVALID = 0xFFFF;

struct LogRecord {
  uint32_t timestamp;
  int16_t temp100;
  uint16_t hum100;
};

enum LogAddResult {
  LOG_ADD_OK,
  LOG_ADD_NO_TIME,    // 時刻が 0（未同期）なので記録しなかった
  LOG_ADD_NOT_NEWER,  // 最新の記録と同じか古い時刻なので記録しなかった
  LOG_ADD_FAILED,     // 書き込みに失敗した
};

// LittleFS をマウントし、前回の状態を読み込む。電源断で中途半端になったファイルも直す
bool logstoreBegin();

// 1件追記し、1年より古い記録を消す。温湿度が NAN なら「読めなかった」値で記録する
LogAddResult logstoreAdd(uint32_t timestamp, float tempC, float humidity, LogRecord* out = nullptr);

// 保存している件数
uint32_t logstoreCount();

// 最古・最新の記録の時刻（記録が1件もなければ 0）
uint32_t logstoreFirstTime();
uint32_t logstoreLastTime();

// 古い方から index 番目（0 始まり）の記録を読む
bool logstoreRead(uint32_t index, LogRecord& rec);

// 古い方から index 番目以降の記録を、保存形式（8 バイト単位）のまま最大 maxRecords 件読む。
// 読めた件数を返す。BLE でそのまま送るのに使う
uint32_t logstoreReadRaw(uint32_t index, uint8_t* buf, uint32_t maxRecords);

// 時刻が timestamp 以上の最初の記録の index。なければ logstoreCount() を返す
uint32_t logstoreFindIndex(uint32_t timestamp);

// 記録をすべて削除する（開発用）
bool logstoreClear();

// LittleFS の使用量・全容量（バイト）
size_t logstoreUsedBytes();
size_t logstoreTotalBytes();

// 記録の値を表示用の単位に直す。読めなかった値は NAN
float logTempC(const LogRecord& rec);
float logHumidity(const LogRecord& rec);
