// ステップ1：Wi-Fi 接続 + NTP 時刻同期
//
// 起動時に Wi-Fi に接続して NTP で時刻を合わせ、Wi-Fi を切る。
// その後は10秒ごとに現在時刻をシリアルに表示する。
// Wi-Fi の設定は secrets.h（secrets.example.h をコピーして作る）に書く。

#include <WiFi.h>
#include <time.h>

#include "secrets.h"

// これより前の時刻は「未同期」とみなす（2024-01-01 00:00:00 UTC）
const time_t VALID_EPOCH_MIN = 1704067200;

// 現在の UNIX 時間（UTC 基準の秒）。未同期なら 0
uint32_t clockNow() {
  time_t now = time(nullptr);
  return now > VALID_EPOCH_MIN ? (uint32_t)now : 0;
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
    configTzTime("JST-9", "ntp.nict.jp", "pool.ntp.org");

    // NTP 応答待ち（最大10秒）
    start = millis();
    while (clockNow() == 0 && millis() - start < 10000) {
      delay(200);
    }
    ok = clockNow() != 0;
  }

  // BLE との共存・省電力のため、成功・失敗にかかわらず Wi-Fi を切る
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  return ok;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  if (syncClock()) {
    Serial.println("時刻同期成功");
  } else {
    Serial.println("時刻同期失敗（未同期のまま動作します）");
  }
}

void loop() {
  uint32_t epoch = clockNow();
  time_t t = epoch;
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", localtime(&t));
  Serial.printf("%s JST (epoch %lu)\n", epoch ? buf : "未同期", epoch);
  delay(10000);
}
