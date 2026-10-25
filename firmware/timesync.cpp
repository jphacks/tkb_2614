#include "timesync.h"

#include <WiFi.h>
#include <esp_sntp.h>
#include <sys/time.h>
#include <time.h>

#include "secrets.h"
#include "voice.h"

#ifndef NTP_SERVER
#define NTP_SERVER "ntp.nict.jp"
#endif

// これより前の時刻は「未同期」とみなす（2024-01-01 00:00:00 UTC）
static const time_t VALID_EPOCH_MIN = 1704067200;

// 最後に時計を合わせた記録。NTP は自動同期のタスク、端末の時刻は loop から書き換える
static portMUX_TYPE syncMux = portMUX_INITIALIZER_UNLOCKED;
static uint32_t lastSyncEpoch = 0;
static ClockSource lastSyncSource = CLOCK_SOURCE_NONE;
static unsigned long lastSyncMs = 0;  // 経過時間は時計を合わせても変わらない millis() で測る

// 端末の時刻で時計を合わせた回数。NTP 同期の最中に端末の時刻で合ったかを見分けるのに使う
static volatile uint32_t phoneSyncCount = 0;

static TaskHandle_t syncTask = nullptr;

// NTP の応答で時計が合わせられたら立つ
static volatile bool ntpDone = false;

static void onNtpSynced(struct timeval* tv) {
  ntpDone = true;
}

static void recordSync(ClockSource source) {
  // time() は中でロックを取るので、割り込みを止めた区間（portENTER_CRITICAL）の中では呼ばない
  uint32_t now = (uint32_t)time(nullptr);
  portENTER_CRITICAL(&syncMux);
  lastSyncEpoch = now;
  lastSyncSource = source;
  lastSyncMs = millis();
  portEXIT_CRITICAL(&syncMux);
}

static bool isStale() {
  portENTER_CRITICAL(&syncMux);
  bool stale = lastSyncSource == CLOCK_SOURCE_NONE || millis() - lastSyncMs >= CLOCK_STALE_MS;
  portEXIT_CRITICAL(&syncMux);
  return stale;
}

void clockBegin() {
  // 内部時刻は UTC のまま、表示用のタイムゾーンを日本時間にする
  setenv("TZ", "JST-9", 1);
  tzset();
  sntp_set_time_sync_notification_cb(onNtpSynced);
}

uint32_t clockNow() {
  time_t now = time(nullptr);
  return now > VALID_EPOCH_MIN ? (uint32_t)now : 0;
}

bool clockIsValid() {
  return clockNow() != 0;
}

uint32_t clockLastSync() {
  portENTER_CRITICAL(&syncMux);
  uint32_t epoch = lastSyncEpoch;
  portEXIT_CRITICAL(&syncMux);
  return epoch;
}

ClockSource clockLastSyncSource() {
  portENTER_CRITICAL(&syncMux);
  ClockSource source = lastSyncSource;
  portEXIT_CRITICAL(&syncMux);
  return source;
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
  uint32_t phoneSyncCountAtStart = phoneSyncCount;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Wi-Fi 接続（最大30秒）。アクセスポイントがすぐに見つからないことがあるので長めに待つ
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
  }

  bool ok = false;
  if (WiFi.status() == WL_CONNECTED) {
    // 端末の時刻ですでに時計が合っていることもあるので、時計が有効かではなく NTP の応答で判断する
    ntpDone = false;
    configTzTime("JST-9", NTP_SERVER, "pool.ntp.org");

    // NTP 応答待ち（最大10秒）
    start = millis();
    while (!ntpDone && millis() - start < 10000) {
      delay(200);
    }
    ok = ntpDone && clockIsValid();
    if (!ok) {
      Serial.println("NTP サーバーから応答がありません");
    }
    // Wi-Fi を切った後も SNTP が再送を続けないよう止める
    esp_sntp_stop();
  } else {
    Serial.printf("Wi-Fi に接続できません（status %d）\n", (int)WiFi.status());
  }

  // BLE との共存・省電力のため、成功・失敗にかかわらず Wi-Fi を切る
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  if (ok) {
    recordSync(CLOCK_SOURCE_NTP);
  }
  // 同期の最中にアプリからの要求で時計が合っていたら、そちらで「成功しました」と言っているので言わない
  if (ok && phoneSyncCount == phoneSyncCountAtStart) {
    voicePlay(VOICE_SYNC_OK);
  }
  return ok;
}

// 未同期か、最後に合わせてから時間が経っていれば NTP を試す。頼まれたときはすぐ試す
static void syncTaskMain(void*) {
  for (;;) {
    bool requested = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(CLOCK_RETRY_MS)) > 0;
    if (requested || !clockIsValid() || isStale()) {
      Serial.println(syncClock() ? "NTP 時刻同期成功" : "NTP 時刻同期失敗");
    }
  }
}

void clockStartAutoSync() {
  if (syncTask == nullptr) {
    xTaskCreate(syncTaskMain, "clockSync", 6144, nullptr, 1, &syncTask);
  }
}

void clockRequestSync() {
  if (syncTask != nullptr) {
    xTaskNotifyGive(syncTask);
  }
}

bool clockSetFromPhone(uint32_t epoch) {
  if (epoch <= VALID_EPOCH_MIN) {
    return false;
  }
  if (clockIsValid() && !isStale()) {
    return false;
  }
  struct timeval tv = {(time_t)epoch, 0};
  settimeofday(&tv, nullptr);
  recordSync(CLOCK_SOURCE_PHONE);
  phoneSyncCount = phoneSyncCount + 1;  // 書き換えるのは loop だけ
  return true;
}

void clockReset() {
  struct timeval tv = {0, 0};
  settimeofday(&tv, nullptr);
  portENTER_CRITICAL(&syncMux);
  lastSyncEpoch = 0;
  lastSyncSource = CLOCK_SOURCE_NONE;
  portEXIT_CRITICAL(&syncMux);
}
