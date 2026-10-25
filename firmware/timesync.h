#pragma once

#include <Arduino.h>

// 時計を最後に合わせた手段
enum ClockSource : uint8_t {
  CLOCK_SOURCE_NONE = 0,   // 未同期
  CLOCK_SOURCE_NTP = 1,    // Wi-Fi 経由の NTP
  CLOCK_SOURCE_PHONE = 2,  // BLE で接続してきた端末の時刻
};

// 最後に時計を合わせてからこれだけ経つと「古い」とみなし、合わせ直す
const unsigned long CLOCK_STALE_MS = 24UL * 60 * 60 * 1000;

// 未同期・古いときに NTP を試す間隔
const unsigned long CLOCK_RETRY_MS = 10UL * 60 * 1000;

// タイムゾーン（表示用）を設定する。最初に1回呼ぶ
void clockBegin();

// Wi-Fi に接続して NTP で時刻を合わせ、Wi-Fi を切る。成功したら true。
// Wi-Fi 接続と NTP の応答を待つので最大40秒ほどかかる。普段は clockRequestSync() で自動同期のタスクに頼む
bool syncClock();

// 未同期・古いときに NTP を自動で試すタスクを始める
void clockStartAutoSync();

// 自動同期のタスクに、今すぐ NTP を試すよう頼む（待たずに戻る）
void clockRequestSync();

// 端末の時刻で時計を合わせる。未同期か、最後に合わせてから CLOCK_STALE_MS 以上経っているときだけ合わせる。
// 合わせたら true
bool clockSetFromPhone(uint32_t epoch);

// 時計を未同期の状態に戻す（開発用）
void clockReset();

// 現在の UNIX 時間（UTC 基準の秒）。未同期なら 0
uint32_t clockNow();

// 時刻が同期済みなら true
bool clockIsValid();

// 最後に時計を合わせた時刻（UNIX 時間）と手段。未同期なら 0 と CLOCK_SOURCE_NONE
uint32_t clockLastSync();
ClockSource clockLastSyncSource();

// UNIX 時間を日本時間の "YYYY-MM-DD HH:MM:SS" にする。0 なら "未同期"
void clockFormat(uint32_t epoch, char* buf, size_t len);
