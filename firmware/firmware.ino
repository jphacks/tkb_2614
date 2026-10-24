// ESP32 + Si7021 温湿度ロガー
//
// 起動時に Wi-Fi に接続して NTP で時刻を合わせ、Wi-Fi を切る。
// その後は MEASURE_INTERVAL_MS ごとに温湿度を測り、LittleFS に記録する。
// BLE で "chiikabi" としてアドバタイズし、未送信件数を載せる。
// スマホが接続して送信要求を書くと記録を Notify で送り、ACK を受けたら削除する（ble.h 参照）。
// シリアル（115200 baud）で help と打つとコマンド一覧が出る。
// Wi-Fi の設定は secrets.h（secrets.example.h をコピーして作る）に書く。

#include "ble.h"
#include "logstore.h"
#include "sensor.h"
#include "timesync.h"

// 計測間隔。本番は1時間。開発中は短くして確認する（例: 10UL * 1000）
const unsigned long MEASURE_INTERVAL_MS = 60UL * 60 * 1000;

unsigned long lastMeasureMs = 0;
String lineBuf;

void printRecord(const LogRecord& rec) {
  char timeBuf[32];
  clockFormat(rec.timestamp, timeBuf, sizeof(timeBuf));
  float t = logTempC(rec);
  float h = logHumidity(rec);
  Serial.printf("#%lu  %s  ", (unsigned long)rec.seq, timeBuf);
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
  if (logstoreAdd(clockNow(), t, h, &rec)) {
    Serial.print("記録: ");
    printRecord(rec);
  } else {
    Serial.println("記録失敗");
  }
}

void printHelp() {
  Serial.println("コマンド一覧:");
  Serial.println("  help     この一覧");
  Serial.println("  status   時刻・記録件数・容量");
  Serial.println("  read     センサを読む（記録しない）");
  Serial.println("  add      今すぐ計測して記録する");
  Serial.println("  dump     未送信の記録をすべて表示");
  Serial.println("  count    未送信件数");
  Serial.println("  ack N    通し番号 N 以下の記録を削除");
  Serial.println("  clear    記録をすべて削除（通し番号は続きから）");
  Serial.println("  sync     NTP 時刻同期をやり直す");
  Serial.println("  ble      BLE の状態（接続・送信の進み具合）");
}

void printStatus() {
  char timeBuf[32];
  uint32_t now = clockNow();
  clockFormat(now, timeBuf, sizeof(timeBuf));
  Serial.printf("時刻: %s (epoch %lu)\n", timeBuf, (unsigned long)now);
  Serial.printf("未送信件数: %lu\n", (unsigned long)logstoreCount());
  Serial.printf("最後の通し番号: %lu\n", (unsigned long)logstoreLastSeq());
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
  String arg = space < 0 ? "" : line.substring(space + 1);
  arg.trim();

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
    Serial.printf("未送信件数: %lu\n", (unsigned long)logstoreCount());
  } else if (cmd == "ack") {
    char* end;
    unsigned long seq = strtoul(arg.c_str(), &end, 10);
    if (arg.length() == 0 || *end != '\0') {
      Serial.println("使い方: ack N（N は通し番号）");
      return;
    }
    uint32_t removed = logstoreAck(seq);
    Serial.printf("%lu 件削除（残り %lu 件）\n", (unsigned long)removed,
                  (unsigned long)logstoreCount());
  } else if (cmd == "clear") {
    Serial.println(logstoreClear() ? "全件削除しました" : "削除失敗");
  } else if (cmd == "sync") {
    Serial.println(syncClock() ? "時刻同期成功" : "時刻同期失敗");
  } else if (cmd == "ble") {
    blePrintStatus();
  } else {
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

  if (!sensorBegin()) {
    Serial.println("Si7021 が応答しません（配線を確認してください）");
  }
  if (!logstoreBegin()) {
    Serial.println("記録領域の初期化に失敗しました");
  }
  Serial.printf("未送信件数: %lu / 最後の通し番号: %lu\n", (unsigned long)logstoreCount(),
                (unsigned long)logstoreLastSeq());

  if (syncClock()) {
    Serial.println("時刻同期成功");
  } else {
    Serial.println("時刻同期失敗（未同期のまま動作します）");
  }

  // Wi-Fi を切った後に始める（起動時の同期と無線を取り合わないように）
  if (bleBegin()) {
    Serial.printf("BLE アドバタイズ開始: %s\n", BLE_DEVICE_NAME);
  } else {
    Serial.println("BLE の初期化に失敗しました");
  }
  Serial.println("help でコマンド一覧");

  // 起動直後に1件記録し、以降は一定間隔で記録する
  measureAndStore();
  lastMeasureMs = millis();
}

void loop() {
  pollSerial();

  if (millis() - lastMeasureMs >= MEASURE_INTERVAL_MS) {
    lastMeasureMs += MEASURE_INTERVAL_MS;
    measureAndStore();
  }

  bleLoop();
}
