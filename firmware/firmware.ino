// ESP32 + Si7021 温湿度ロガー
//
// 起動時に裏のタスクで Wi-Fi に接続して NTP で時刻を合わせ、Wi-Fi を切る。
// 未同期のときや、最後に時計を合わせてから時間が経ったときは、自動で NTP を試し直す（timesync.h 参照）。
// 起動・時刻同期・データ送信のときに DFPlayer Mini で音声を流す（voice.h 参照）。
// 起動時は「起動しました」を流し終えてから動き始める。
// MEASURE_INTERVAL_MS ごとに温湿度を測り、計測時刻を主キーとして LittleFS に1年分記録する。
// 時刻が未同期の間は記録せず、時計が合った時点で計測し直す。
// BLE で "chiikabi" としてアドバタイズし、スマホが送信要求を書くと指定の時刻以降の記録を Notify で送る。
// 送信要求に入っている端末の時刻でも時計を合わせる（ble.h、docs/ble-protocol.md 参照）。
// シリアル（115200 baud）で help と打つとコマンド一覧が出る。
// Wi-Fi の設定は secrets.h（secrets.example.h をコピーして作る）に書く。

#include "ble.h"
#include "logstore.h"
#include "sensor.h"
#include "timesync.h"
#include "voice.h"

// 計測間隔。本番は1時間（60UL * 60 * 1000）。
// 今はアプリの表示確認用にデータを増やすため、5分にしている
const unsigned long MEASURE_INTERVAL_MS = 5UL * 60 * 1000;

unsigned long lastMeasureMs = 0;
bool measurePending = false;  // 未同期で記録できなかった計測があれば、時計が合った時点でやり直す
String lineBuf;

const char* clockSourceName(ClockSource source) {
  switch (source) {
    case CLOCK_SOURCE_NTP:
      return "NTP";
    case CLOCK_SOURCE_PHONE:
      return "端末";
    default:
      return "なし";
  }
}

void printRecord(const LogRecord& rec) {
  char timeBuf[32];
  clockFormat(rec.timestamp, timeBuf, sizeof(timeBuf));
  float t = logTempC(rec);
  float h = logHumidity(rec);
  Serial.printf("%s (epoch %lu)  ", timeBuf, (unsigned long)rec.timestamp);
  if (isnan(t) || isnan(h)) {
    Serial.println("（センサ読み取り失敗）");
  } else {
    Serial.printf("%.2f℃  %.2f%%\n", t, h);
  }
}

// 計測して1件記録する
void measureAndStore() {
  float t = NAN;
  float h = NAN;
  if (!sensorRead(t, h)) {
    Serial.println("センサ読み取り失敗");
  }
  LogRecord rec;
  measurePending = false;
  switch (logstoreAdd(clockNow(), t, h, &rec)) {
    case LOG_ADD_OK:
      Serial.print("記録: ");
      printRecord(rec);
      break;
    case LOG_ADD_NO_TIME:
      Serial.println("時刻が未同期なので記録しません（時計が合ったら計測し直します）");
      measurePending = true;
      break;
    case LOG_ADD_NOT_NEWER:
      Serial.println("最新の記録と同じか古い時刻なので記録しません");
      break;
    case LOG_ADD_FAILED:
      Serial.println("記録失敗");
      break;
  }
}

void printHelp() {
  Serial.println("コマンド一覧:");
  Serial.println("  help     この一覧");
  Serial.println("  status   時刻・時計合わせ・記録件数・容量");
  Serial.println("  read     センサを読む（記録しない）");
  Serial.println("  add      今すぐ計測して記録する");
  Serial.println("  dump     記録をすべて表示");
  Serial.println("  count    記録の件数");
  Serial.println("  clear    記録をすべて削除");
  Serial.println("  sync     NTP 時刻同期をやり直す（裏で実行）");
  Serial.println("  unsync   時計を未同期に戻す（端末の時刻で合わせる確認用）");
  Serial.println("  ble      BLE の状態（接続・送信の進み具合）");}

void printStatus() {
  char timeBuf[32];
  uint32_t now = clockNow();
  clockFormat(now, timeBuf, sizeof(timeBuf));
  Serial.printf("時刻: %s (epoch %lu)\n", timeBuf, (unsigned long)now);
  uint32_t lastSync = clockLastSync();
  clockFormat(lastSync, timeBuf, sizeof(timeBuf));
  Serial.printf("最後に時計を合わせた時刻: %s（%s）\n", timeBuf,
                clockSourceName(clockLastSyncSource()));
  Serial.printf("記録: %lu 件\n", (unsigned long)logstoreCount());
  clockFormat(logstoreFirstTime(), timeBuf, sizeof(timeBuf));
  Serial.printf("最古の記録: %s\n", logstoreCount() ? timeBuf : "なし");
  clockFormat(logstoreLastTime(), timeBuf, sizeof(timeBuf));
  Serial.printf("最新の記録: %s\n", logstoreCount() ? timeBuf : "なし");
  Serial.printf("容量: %u / %u バイト\n", (unsigned)logstoreUsedBytes(),
                (unsigned)logstoreTotalBytes());
  Serial.printf("計測間隔: %lu 秒\n", MEASURE_INTERVAL_MS / 1000);
}

void handleCommand(String line) {
  line.trim();
  if (line.length() == 0) {
    return;
  }
  int space = line.indexOf(' ');
  String cmd = space < 0 ? line : line.substring(0, space);

  if (cmd == "help") {
    printHelp();
  } else if (cmd == "status") {
    printStatus();
  } else if (cmd == "read") {
    float t, h;
    if (sensorRead(t, h)) {
      Serial.printf("%.2f℃  %.2f%%\n", t, h);
    } else {
      Serial.println("センサ読み取り失敗");
    }
  } else if (cmd == "add") {
    measureAndStore();
  } else if (cmd == "dump") {
    uint32_t count = logstoreCount();
    LogRecord rec;
    for (uint32_t i = 0; i < count; i++) {
      if (logstoreRead(i, rec)) {
        printRecord(rec);
      }
    }
    Serial.printf("（%lu 件）\n", (unsigned long)count);
  } else if (cmd == "count") {
    Serial.printf("記録: %lu 件\n", (unsigned long)logstoreCount());
  } else if (cmd == "clear") {
    Serial.println(logstoreClear() ? "全件削除しました" : "削除失敗");
  } else if (cmd == "sync") {
    clockRequestSync();
    Serial.println("NTP 時刻同期を始めます（結果は後で表示されます）");
  } else if (cmd == "unsync") {
    clockReset();
    Serial.println("時計を未同期に戻しました");
  } else if (cmd == "ble") {
    blePrintStatus();  } else {
    Serial.printf("不明なコマンド: %s（help で一覧）\n", cmd.c_str());
  }
}

// シリアルから1行ずつ読んでコマンドを実行する（loop を止めない）
void pollSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      handleCommand(lineBuf);
      lineBuf = "";
    } else if (lineBuf.length() < 64) {
      lineBuf += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // 「起動しました」を流し終えてから、計測・BLE・時刻同期を始める
  if (voiceBegin()) {
    voicePlayAndWait(VOICE_STARTUP);
  } else {
    Serial.println("DFPlayer が応答しません（音声なしで動作します）");
  }
  if (!sensorBegin()) {
    Serial.println("Si7021 が応答しません（配線を確認してください）");
  }
  if (!logstoreBegin()) {
    Serial.println("記録領域の初期化に失敗しました");
  }
  Serial.printf("記録: %lu 件\n", (unsigned long)logstoreCount());

  clockBegin();
  if (bleBegin()) {
    Serial.printf("BLE アドバタイズ開始: %s\n", BLE_DEVICE_NAME);
  } else {
    Serial.println("BLE の初期化に失敗しました");
  }

  // 起動時の NTP 同期も裏のタスクで行う。setup で待つと、その間 loop が回らず音声が流れないため
  clockStartAutoSync();
  clockRequestSync();
  Serial.println("help でコマンド一覧");

  // 起動直後の1件は時計が合った時点で記録し、以降は一定間隔で記録する
  measurePending = true;
  lastMeasureMs = millis();
}

void loop() {
  pollSerial();

  if (millis() - lastMeasureMs >= MEASURE_INTERVAL_MS) {
    lastMeasureMs += MEASURE_INTERVAL_MS;
    measureAndStore();
  } else if (measurePending && clockIsValid()) {
    measureAndStore();
  }

  bleLoop();
  voiceLoop();
}
