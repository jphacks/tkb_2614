#include "ble.h"

#include <NimBLEDevice.h>

#include "logstore.h"
#include "timesync.h"

static const size_t MFG_DATA_SIZE = 8;

// アドバタイズ間隔（0.625ms 単位）。接続不可のアドバタイズは 100ms 以上にする必要がある
static const uint16_t ADV_INTERVAL_MIN = 160;  // 100ms
static const uint16_t ADV_INTERVAL_MAX = 320;  // 200ms

static NimBLEAdvertising* advertising = nullptr;
static uint8_t mfgData[MFG_DATA_SIZE];
static uint32_t advertisedCount = 0;
static bool advertisedSynced = false;

static void buildMfgData(uint32_t count, bool synced) {
  mfgData[0] = BLE_COMPANY_ID & 0xFF;
  mfgData[1] = BLE_COMPANY_ID >> 8;
  mfgData[2] = BLE_ADV_VERSION;
  mfgData[3] = count;
  mfgData[4] = count >> 8;
  mfgData[5] = count >> 16;
  mfgData[6] = count >> 24;
  mfgData[7] = synced ? BLE_FLAG_TIME_SYNCED : 0;
}

// アドバタイズの中身を作り直して反映する。
// setManufacturerData() は既存のデータに追記していくので、毎回まっさらな状態から作る
static bool updateAdvertisement() {
  uint32_t count = logstoreCount();
  bool synced = clockIsValid();
  buildMfgData(count, synced);

  NimBLEAdvertisementData data;
  data.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  data.setName(BLE_DEVICE_NAME);
  data.setManufacturerData(mfgData, MFG_DATA_SIZE);
  if (!advertising->setAdvertisementData(data)) {
    return false;
  }

  advertisedCount = count;
  advertisedSynced = synced;
  return true;
}

bool bleBegin() {
  if (!NimBLEDevice::init(BLE_DEVICE_NAME)) {
    return false;
  }
  advertising = NimBLEDevice::getAdvertising();

  // ステップ3はアドバタイズのみ。GATT サービスができるまでは接続を受け付けない
  advertising->setConnectableMode(BLE_GAP_CONN_MODE_NON);
  advertising->setMinInterval(ADV_INTERVAL_MIN);
  advertising->setMaxInterval(ADV_INTERVAL_MAX);

  return updateAdvertisement() && advertising->start();
}

void bleLoop() {
  if (advertising == nullptr) {
    return;
  }
  if (logstoreCount() != advertisedCount || clockIsValid() != advertisedSynced) {
    updateAdvertisement();
  }
}

void blePrintStatus() {
  if (advertising == nullptr) {
    Serial.println("BLE: 未初期化");
    return;
  }
  Serial.printf("BLE: %s\n", advertising->isAdvertising() ? "アドバタイズ中" : "停止中");
  Serial.printf("デバイス名: %s\n", BLE_DEVICE_NAME);
  Serial.printf("アドレス: %s\n", NimBLEDevice::getAddress().toString().c_str());
  Serial.printf("未送信件数: %lu / 時刻同期: %s\n", (unsigned long)advertisedCount,
                advertisedSynced ? "済" : "未");
  Serial.print("Manufacturer Data: 0x");
  for (size_t i = 0; i < MFG_DATA_SIZE; i++) {
    Serial.printf("%02X", mfgData[i]);
  }
  Serial.println();
}
