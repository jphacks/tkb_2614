#pragma once

#include <Arduino.h>

// Si7021 を初期化する（I2C、アドレス 0x40、デフォルトの SDA/SCL）。応答があれば true
bool sensorBegin();

// 温度［℃］と湿度［%RH］を読む。センサが応答しない・データが壊れているときは false
bool sensorRead(float& tempC, float& humidity);
