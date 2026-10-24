#include "timesync.h"

#include <WiFi.h>
#include <time.h>

#include "secrets.h"

#ifndef NTP_SERVER
#define NTP_SERVER "ntp.nict.jp"
#endif

// これより前の時刻は「未同期」とみなす（2024-01-01 00:00:00 UTC）
static const time_t VALID_EPOCH_MIN = 1704067200;

uint32_t clockNow() {
  time_t now = time(nullptr);
  return now > VALID_EPOCH_MIN ? (uint32_t)now : 0;
}

bool clockIsValid() {
  return clockNow() != 0;
}

void clockFormat(uint32_t epoch, char* buf, size_t len) {
  if (epoch == 0) {
    snprintf(buf, len, "未同期");
    return;
  }
  time_t t = epoch;
  struct tm tm;
  localtime_r(&t, &tm);
  strftime(buf, len, "%Y-%m-%d %H:%M:%S", &tm);
}

bool syncClock() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Wi-Fi 接続（最大15秒）
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
  }

  bool ok = false;
  if (WiFi.status() == WL_CONNECTED) {
    // 内部時刻は UTC のまま、表示用のタイムゾーンを日本時間にする
    configTzTime("JST-9", NTP_SERVER, "pool.ntp.org");

    // NTP 応答待ち（最大10秒）
    start = millis();
    while (!clockIsValid() && millis() - start < 10000) {
      delay(200);
    }
    ok = clockIsValid();
  }

  // BLE との共存・省電力のため、成功・失敗にかかわらず Wi-Fi を切る
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  return ok;
}
