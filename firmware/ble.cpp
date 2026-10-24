#include "ble.h"

#include <NimBLEDevice.h>

#include "logstore.h"
#include "timesync.h"

static const size_t MFG_DATA_SIZE = 8;

// アドバタイズ間隔（0.625ms 単位）
static const uint16_t ADV_INTERVAL_MIN = 160;  // 100ms
static const uint16_t ADV_INTERVAL_MAX = 320;  // 200ms

// 1回の通知に詰められる最大件数（MTU の上限 517 のとき）
static const uint16_t PREFERRED_MTU = 517;
static const uint32_t MAX_RECORDS_PER_NOTIFY = (PREFERRED_MTU - 3) / LOG_RECORD_SIZE;

// 通知の送信バッファが一杯のとき、次に試すまでの待ち時間
static const unsigned long NOTIFY_RETRY_MS = 20;

static NimBLEAdvertising* advertising = nullptr;
static NimBLECharacteristic* dataChar = nullptr;

static uint8_t mfgData[MFG_DATA_SIZE];
static uint32_t advertisedCount = 0;
static bool advertisedSynced = false;
static uint32_t advertisedLastSeq = 0;

// 以下の接続状態は NimBLE のタスクで書き換わり、loop で読む
static volatile uint16_t connHandle = BLE_HS_CONN_HANDLE_NONE;
static volatile uint16_t connMtu = 23;
static volatile bool subscribed = false;

// 状態キャラクタリスティックの中身（現在時刻以外）。loop で作り、NimBLE のタスクで読む
static portMUX_TYPE statusMux = portMUX_INITIALIZER_UNLOCKED;
static uint8_t statusValue[BLE_STATUS_SIZE];

// 制御に書き込まれた命令。記録の読み書きは loop だけで行うため、キューで渡す
struct Command {
  uint8_t op;
  uint32_t seq;
};
static QueueHandle_t commandQueue = nullptr;

// 記録の送信状態（loop だけで使う）
static bool sending = false;
static uint32_t sendNextSeq = 0;
static uint32_t sentCount = 0;
static unsigned long retryAtMs = 0;

static void put32(uint8_t* p, uint32_t v) {
  p[0] = v;
  p[1] = v >> 8;
  p[2] = v >> 16;
  p[3] = v >> 24;
}

static uint32_t get32(const uint8_t* p) {
  return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& info) override {
    connHandle = info.getConnHandle();
    connMtu = info.getMTU();
    subscribed = false;
    Serial.printf("BLE 接続: %s\n", info.getAddress().toString().c_str());
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& info, int reason) override {
    connHandle = BLE_HS_CONN_HANDLE_NONE;
    subscribed = false;
    Serial.printf("BLE 切断（reason 0x%02X）\n", reason);
  }

  void onMTUChange(uint16_t mtu, NimBLEConnInfo& info) override {
    connMtu = mtu;
  }
};

class StatusCallbacks : public NimBLECharacteristicCallbacks {
  void onRead(NimBLECharacteristic* chr, NimBLEConnInfo& info) override {
    uint8_t buf[BLE_STATUS_SIZE];
    portENTER_CRITICAL(&statusMux);
    memcpy(buf, statusValue, BLE_STATUS_SIZE);
    portEXIT_CRITICAL(&statusMux);
    put32(buf + 14, clockNow());
    chr->setValue(buf, BLE_STATUS_SIZE);
  }
};

class ControlCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* chr, NimBLEConnInfo& info) override {
    NimBLEAttValue value = chr->getValue();
    if (value.size() != BLE_CONTROL_SIZE) {
      Serial.printf("BLE: 制御の長さが不正（%u バイト）\n", (unsigned)value.size());
      return;
    }
    Command cmd = {value.data()[0], get32(value.data() + 1)};
    xQueueSend(commandQueue, &cmd, 0);
  }
};

class DataCallbacks : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic* chr, NimBLEConnInfo& info, uint16_t subValue) override {
    subscribed = subValue & 0x01;  // bit0 が Notify
  }
};

static void buildMfgData(uint32_t count, bool synced) {
  mfgData[0] = BLE_COMPANY_ID & 0xFF;
  mfgData[1] = BLE_COMPANY_ID >> 8;
  mfgData[2] = BLE_ADV_VERSION;
  put32(mfgData + 3, count);
  mfgData[7] = synced ? BLE_FLAG_TIME_SYNCED : 0;
}

// アドバタイズの中身を作り直して反映する。
// setManufacturerData() は既存のデータに追記していくので、毎回まっさらな状態から作る
static bool updateAdvertisement(uint32_t count, bool synced) {
  buildMfgData(count, synced);

  NimBLEAdvertisementData data;
  data.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  data.setName(BLE_DEVICE_NAME);
  data.setManufacturerData(mfgData, MFG_DATA_SIZE);
  return advertising->setAdvertisementData(data);
}

static void updateStatus(uint32_t count, bool synced, uint32_t lastSeq) {
  uint8_t buf[BLE_STATUS_SIZE];
  buf[0] = BLE_STATUS_VERSION;
  buf[1] = synced ? BLE_FLAG_TIME_SYNCED : 0;
  put32(buf + 2, count);
  put32(buf + 6, logstoreFirstSeq());
  put32(buf + 10, lastSeq);
  put32(buf + 14, 0);  // 現在時刻は読まれたときに入れる
  portENTER_CRITICAL(&statusMux);
  memcpy(statusValue, buf, BLE_STATUS_SIZE);
  portEXIT_CRITICAL(&statusMux);
}

// 件数・同期状態・最新の通し番号のどれかが変わったら、アドバタイズと状態を更新する
static void refreshIfChanged() {
  uint32_t count = logstoreCount();
  bool synced = clockIsValid();
  uint32_t lastSeq = logstoreLastSeq();
  if (count == advertisedCount && synced == advertisedSynced && lastSeq == advertisedLastSeq) {
    return;
  }
  updateStatus(count, synced, lastSeq);
  if (updateAdvertisement(count, synced)) {
    advertisedCount = count;
    advertisedSynced = synced;
    advertisedLastSeq = lastSeq;
  }
}

static void handleCommand(const Command& cmd) {
  switch (cmd.op) {
    case BLE_CMD_SEND:
      if (!subscribed) {
        Serial.println("BLE: データの Notify が購読されていないので送信しません");
        return;
      }
      sending = true;
      sendNextSeq = cmd.seq;
      sentCount = 0;
      retryAtMs = millis();
      Serial.printf("BLE: 送信要求（%lu 番以降）\n", (unsigned long)cmd.seq);
      break;
    case BLE_CMD_ACK: {
      uint32_t removed = logstoreAck(cmd.seq);
      Serial.printf("BLE: ACK %lu 番まで、%lu 件削除（残り %lu 件）\n", (unsigned long)cmd.seq,
                    (unsigned long)removed, (unsigned long)logstoreCount());
      break;
    }
    default:
      Serial.printf("BLE: 不明な命令 0x%02X\n", cmd.op);
      break;
  }
}

// 記録を1通知分送る。送信は位置ではなく通し番号で追うので、途中で ACK や記録の追加があってもずれない
static void continueSending() {
  if (connHandle == BLE_HS_CONN_HANDLE_NONE || !subscribed) {
    sending = false;
    Serial.printf("BLE: 送信中断（%lu 件送信済み）\n", (unsigned long)sentCount);
    return;
  }
  if ((long)(millis() - retryAtMs) < 0) {
    return;
  }

  uint32_t perNotify = min((uint32_t)(connMtu - 3) / LOG_RECORD_SIZE, MAX_RECORDS_PER_NOTIFY);
  uint8_t buf[MAX_RECORDS_PER_NOTIFY * LOG_RECORD_SIZE];

  uint32_t index = logstoreFindIndex(sendNextSeq);
  uint32_t n = logstoreReadRaw(index, buf, perNotify);
  bool lastChunk = index + n >= logstoreCount();
  size_t len = n * LOG_RECORD_SIZE;

  // 記録の後ろに余裕があれば終了の印も同じ通知に入れる。なければ次の通知で送る
  bool withEndMarker = lastChunk && n < perNotify;
  if (withEndMarker) {
    memset(buf + len, 0, LOG_RECORD_SIZE);
    len += LOG_RECORD_SIZE;
  }

  if (!dataChar->notify(buf, len, connHandle)) {
    // 送信バッファが一杯。少し待ってから同じ内容を送り直す
    retryAtMs = millis() + NOTIFY_RETRY_MS;
    return;
  }

  if (n > 0) {
    sendNextSeq = get32(buf + (n - 1) * LOG_RECORD_SIZE) + 1;
    sentCount += n;
  }
  if (withEndMarker) {
    sending = false;
    Serial.printf("BLE: 送信完了（%lu 件）\n", (unsigned long)sentCount);
  }
}

bool bleBegin() {
  commandQueue = xQueueCreate(4, sizeof(Command));
  if (commandQueue == nullptr || !NimBLEDevice::init(BLE_DEVICE_NAME)) {
    return false;
  }
  NimBLEDevice::setMTU(PREFERRED_MTU);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  server->advertiseOnDisconnect(true);  // 切断されたらアドバタイズを再開する

  NimBLEService* service = server->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic* statusChar =
      service->createCharacteristic(BLE_STATUS_UUID, NIMBLE_PROPERTY::READ);
  statusChar->setCallbacks(new StatusCallbacks());
  NimBLECharacteristic* controlChar =
      service->createCharacteristic(BLE_CONTROL_UUID, NIMBLE_PROPERTY::WRITE);
  controlChar->setCallbacks(new ControlCallbacks());
  dataChar = service->createCharacteristic(BLE_DATA_UUID, NIMBLE_PROPERTY::NOTIFY);
  dataChar->setCallbacks(new DataCallbacks());

  advertising = NimBLEDevice::getAdvertising();
  advertising->setMinInterval(ADV_INTERVAL_MIN);
  advertising->setMaxInterval(ADV_INTERVAL_MAX);

  // アドバタイズ本体は名前と件数で一杯なので、サービス UUID はスキャン応答に入れる
  advertising->enableScanResponse(true);
  NimBLEAdvertisementData scanData;
  scanData.addServiceUUID(NimBLEUUID(BLE_SERVICE_UUID));
  if (!advertising->setScanResponseData(scanData)) {
    return false;
  }

  uint32_t count = logstoreCount();
  bool synced = clockIsValid();
  uint32_t lastSeq = logstoreLastSeq();
  updateStatus(count, synced, lastSeq);
  if (!updateAdvertisement(count, synced)) {
    return false;
  }
  advertisedCount = count;
  advertisedSynced = synced;
  advertisedLastSeq = lastSeq;

  return advertising->start();
}

void bleLoop() {
  if (advertising == nullptr) {
    return;
  }

  Command cmd;
  while (xQueueReceive(commandQueue, &cmd, 0) == pdTRUE) {
    handleCommand(cmd);
  }
  if (sending) {
    continueSending();
  }
  refreshIfChanged();
}

void blePrintStatus() {
  if (advertising == nullptr) {
    Serial.println("BLE: 未初期化");
    return;
  }
  Serial.printf("デバイス名: %s\n", BLE_DEVICE_NAME);
  Serial.printf("アドレス: %s\n", NimBLEDevice::getAddress().toString().c_str());
  if (connHandle == BLE_HS_CONN_HANDLE_NONE) {
    Serial.printf("BLE: %s\n", advertising->isAdvertising() ? "アドバタイズ中" : "停止中");
  } else {
    Serial.printf("BLE: 接続中（MTU %u、Notify %s）\n", connMtu, subscribed ? "購読中" : "未購読");
  }
  if (sending) {
    Serial.printf("送信中: 次は %lu 番、%lu 件送信済み\n", (unsigned long)sendNextSeq,
                  (unsigned long)sentCount);
  }
  Serial.printf("未送信件数: %lu / 時刻同期: %s\n", (unsigned long)advertisedCount,
                advertisedSynced ? "済" : "未");
  Serial.print("Manufacturer Data: 0x");
  for (size_t i = 0; i < MFG_DATA_SIZE; i++) {
    Serial.printf("%02X", mfgData[i]);
  }
  Serial.println();
}
