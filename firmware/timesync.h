#pragma once

#include <Arduino.h>

// Wi-Fi に接続して NTP で時刻を合わせ、Wi-Fi を切る。成功したら true
bool syncClock();

// 現在の UNIX 時間（UTC 基準の秒）。未同期なら 0
uint32_t clockNow();

// 時刻が同期済みなら true
bool clockIsValid();

// UNIX 時間を日本時間の "YYYY-MM-DD HH:MM:SS" にする。0 なら "未同期"
void clockFormat(uint32_t epoch, char* buf, size_t len);
