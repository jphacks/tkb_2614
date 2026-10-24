#include "logstore.h"

#include <LittleFS.h>
#include <Preferences.h>
#include <math.h>

static const char* LOG_PATH = "/log.bin";
static const char* TMP_PATH = "/log.tmp";  // ACK で書き直すときの作業ファイル

// 最後の通し番号は NVS に置く（記録を全部消しても続きから振るため）
static const char* PREF_NAMESPACE = "logstore";
static const char* PREF_LAST_SEQ = "lastSeq";

static Preferences prefs;
static uint32_t lastSeq = 0;
static uint32_t recordCount = 0;

static void put32(uint8_t* p, uint32_t v) {
  p[0] = v;
  p[1] = v >> 8;
  p[2] = v >> 16;
  p[3] = v >> 24;
}

static void put16(uint8_t* p, uint16_t v) {
  p[0] = v;
  p[1] = v >> 8;
}

static uint32_t get32(const uint8_t* p) {
  return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

static uint16_t get16(const uint8_t* p) {
  return (uint16_t)(p[0] | p[1] << 8);
}

static void encode(const LogRecord& rec, uint8_t* buf) {
  put32(buf, rec.seq);
  put32(buf + 4, rec.timestamp);
  put16(buf + 8, (uint16_t)rec.temp100);
  put16(buf + 10, rec.hum100);
}

static void decode(const uint8_t* buf, LogRecord& rec) {
  rec.seq = get32(buf);
  rec.timestamp = get32(buf + 4);
  rec.temp100 = (int16_t)get16(buf + 8);
  rec.hum100 = get16(buf + 10);
}

static int16_t toTemp100(float tempC) {
  if (isnan(tempC)) {
    return LOG_TEMP_INVALID;
  }
  long v = lroundf(tempC * 100);
  return (int16_t)constrain(v, -32767L, 32767L);
}

static uint16_t toHum100(float humidity) {
  if (isnan(humidity)) {
    return LOG_HUM_INVALID;
  }
  long v = lroundf(humidity * 100);
  return (uint16_t)constrain(v, 0L, 10000L);
}

static uint32_t fileRecordCount() {
  File f = LittleFS.open(LOG_PATH, FILE_READ);
  if (!f) {
    return 0;
  }
  size_t size = f.size();
  f.close();
  return size / LOG_RECORD_SIZE;
}

// 先頭 skip 件を捨てて残りを作業ファイルに写し、元のファイルと入れ替える。
// 末尾の欠けたレコード（追記中の電源断で残ったもの）もここで落ちる。
static bool rewriteFrom(uint32_t skip) {
  File src = LittleFS.open(LOG_PATH, FILE_READ);
  if (!src) {
    return false;
  }
  File dst = LittleFS.open(TMP_PATH, FILE_WRITE);
  if (!dst) {
    src.close();
    return false;
  }

  uint32_t total = src.size() / LOG_RECORD_SIZE;
  bool ok = src.seek((size_t)skip * LOG_RECORD_SIZE);
  uint8_t buf[LOG_RECORD_SIZE];
  for (uint32_t i = skip; ok && i < total; i++) {
    ok = src.read(buf, LOG_RECORD_SIZE) == LOG_RECORD_SIZE &&
         dst.write(buf, LOG_RECORD_SIZE) == LOG_RECORD_SIZE;
  }
  src.close();
  dst.close();

  if (!ok) {
    LittleFS.remove(TMP_PATH);
    return false;
  }
  // ここで止まっても、次の起動時に作業ファイルを本体として拾い直す（logstoreBegin 参照）
  LittleFS.remove(LOG_PATH);
  if (!LittleFS.rename(TMP_PATH, LOG_PATH)) {
    return false;
  }
  recordCount = total > skip ? total - skip : 0;
  return true;
}

bool logstoreBegin() {
  // 初回はフォーマットが必要なので、マウントに失敗したらフォーマットする
  if (!LittleFS.begin(true)) {
    return false;
  }

  // ACK の書き直し途中で電源が切れた場合の後始末
  if (LittleFS.exists(TMP_PATH)) {
    if (LittleFS.exists(LOG_PATH)) {
      // 作業ファイルを書いている途中だった。元のファイルが正しい
      LittleFS.remove(TMP_PATH);
    } else {
      // 元のファイルを消した直後だった。作業ファイルは書き終わっている
      LittleFS.rename(TMP_PATH, LOG_PATH);
    }
  }

  // 追記中の電源断で末尾が欠けていたら、完全なレコードだけにする
  File f = LittleFS.open(LOG_PATH, FILE_READ);
  if (f) {
    size_t size = f.size();
    f.close();
    if (size % LOG_RECORD_SIZE != 0) {
      rewriteFrom(0);
    }
  }
  recordCount = fileRecordCount();

  prefs.begin(PREF_NAMESPACE, false);
  lastSeq = prefs.getUInt(PREF_LAST_SEQ, 0);

  // 追記の直後、NVS に書く前に電源が切れていたら、ファイルの方が進んでいる
  LogRecord last;
  if (recordCount > 0 && logstoreRead(recordCount - 1, last) && last.seq > lastSeq) {
    lastSeq = last.seq;
    prefs.putUInt(PREF_LAST_SEQ, lastSeq);
  }
  return true;
}

bool logstoreAdd(uint32_t timestamp, float tempC, float humidity, LogRecord* out) {
  LogRecord rec;
  rec.seq = lastSeq + 1;
  rec.timestamp = timestamp;
  rec.temp100 = toTemp100(tempC);
  rec.hum100 = toHum100(humidity);

  uint8_t buf[LOG_RECORD_SIZE];
  encode(rec, buf);

  File f = LittleFS.open(LOG_PATH, FILE_APPEND);
  if (!f) {
    return false;
  }
  size_t written = f.write(buf, LOG_RECORD_SIZE);
  f.close();
  if (written != LOG_RECORD_SIZE) {
    // 書きかけのバイトが残ると以降のレコードがずれるので切り落とす
    rewriteFrom(0);
    return false;
  }

  lastSeq = rec.seq;
  recordCount++;
  prefs.putUInt(PREF_LAST_SEQ, lastSeq);
  if (out) {
    *out = rec;
  }
  return true;
}

uint32_t logstoreCount() {
  return recordCount;
}

uint32_t logstoreLastSeq() {
  return lastSeq;
}

bool logstoreRead(uint32_t index, LogRecord& rec) {
  if (index >= recordCount) {
    return false;
  }
  File f = LittleFS.open(LOG_PATH, FILE_READ);
  if (!f) {
    return false;
  }
  uint8_t buf[LOG_RECORD_SIZE];
  bool ok = f.seek((size_t)index * LOG_RECORD_SIZE) &&
            f.read(buf, LOG_RECORD_SIZE) == LOG_RECORD_SIZE;
  f.close();
  if (ok) {
    decode(buf, rec);
  }
  return ok;
}

uint32_t logstoreAck(uint32_t seq) {
  // 記録は通し番号の昇順に並んでいるので、先頭から seq 以下を数える
  uint32_t skip = 0;
  LogRecord rec;
  while (skip < recordCount && logstoreRead(skip, rec) && rec.seq <= seq) {
    skip++;
  }
  if (skip == 0) {
    return 0;
  }
  if (skip == recordCount) {
    return logstoreClear() ? skip : 0;
  }
  return rewriteFrom(skip) ? skip : 0;
}

bool logstoreClear() {
  if (LittleFS.exists(LOG_PATH) && !LittleFS.remove(LOG_PATH)) {
    return false;
  }
  recordCount = 0;
  return true;
}

size_t logstoreUsedBytes() {
  return LittleFS.usedBytes();
}

size_t logstoreTotalBytes() {
  return LittleFS.totalBytes();
}

float logTempC(const LogRecord& rec) {
  return rec.temp100 == LOG_TEMP_INVALID ? NAN : rec.temp100 / 100.0f;
}

float logHumidity(const LogRecord& rec) {
  return rec.hum100 == LOG_HUM_INVALID ? NAN : rec.hum100 / 100.0f;
}
