#include "sensor.h"

#include <Wire.h>

// 読み取り手順は実機で動作確認済みの test2.ino に合わせている

static const uint8_t SI7021_ADDR = 0x40;
static const uint8_t CMD_TEMP_NOHOLD = 0xF3;
static const uint8_t CMD_RH_NOHOLD = 0xF5;
static const uint8_t CMD_RESET = 0xFE;

// 1回の測定はデータシート上の最大で約 12ms。センサが外れていても止まらないよう打ち切る
static const unsigned long MEASURE_TIMEOUT_MS = 100;

static void writeCommand(uint8_t cmd) {
  Wire.beginTransmission(SI7021_ADDR);
  Wire.write(cmd);
  Wire.endTransmission();
}

// 測定命令を送り、測定が終わるまで待って生の値を読む。タイムアウトしたら false
static bool measure(uint8_t cmd, uint16_t& raw) {
  writeCommand(cmd);

  // No Hold モードでは測定中は読めないので、読めるまで繰り返す
  unsigned long start = millis();
  while (Wire.requestFrom(SI7021_ADDR, (uint8_t)3) != 3) {
    if (millis() - start > MEASURE_TIMEOUT_MS) {
      return false;
    }
    delay(6);
  }
  uint8_t msb = Wire.read();
  uint8_t lsb = Wire.read();
  Wire.read();  // チェックサム（使っていない）
  raw = (uint16_t)msb << 8 | lsb;
  return true;
}

bool sensorBegin() {
  Wire.begin();
  writeCommand(CMD_RESET);
  delay(50);

  // リセット命令では応答を確かめられないので、試しに1回読んでみる
  float t, h;
  return sensorRead(t, h);
}

bool sensorRead(float& tempC, float& humidity) {
  uint16_t rawTemp, rawHum;
  if (!measure(CMD_TEMP_NOHOLD, rawTemp) || !measure(CMD_RH_NOHOLD, rawHum)) {
    return false;
  }
  tempC = rawTemp * 175.72f / 65536 - 46.85f;
  humidity = rawHum * 125.0f / 65536 - 6;
  return true;
}
