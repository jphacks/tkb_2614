#pragma once

// このファイルをコピーして secrets.h という名前で保存し、値を書き換える
// secrets.h は .gitignore 済みなので GitHub には上がらない

// 2.4GHz の Wi-Fi（ESP32 は 5GHz 非対応）
#define WIFI_SSID     "your-ssid"
#define WIFI_PASSWORD "your-wifi-password"

// （任意）NTP サーバーを変えたい場合はコメントを外す
// #define NTP_SERVER "ntp.nict.jp"
