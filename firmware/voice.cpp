#include "voice.h"

#include <DFRobotDFPlayerMini.h>

static const int PLAYER_RX_PIN = 16;  // DFPlayer の TX につなぐ
static const int PLAYER_TX_PIN = 17;  // DFPlayer の RX につなぐ
static const uint8_t PLAYER_VOLUME = 17;  // 0〜30（30 が最大）

// 再生が終わったかは DFPlayer に問い合わせず、音声の長さで判断する（DFPlayer の答えが当てにならないため）。
// 長さに少し余裕を足して待つ
static const unsigned long TRACK_MARGIN_MS = 500;

// 音声の長さ。SD カードの音声を差し替えたらここも直す
static unsigned long trackLengthMs(uint8_t track) {
  switch (track) {
    case VOICE_SYNC_OK:
      return 2000;
    case VOICE_STARTUP:
      return 3000;
    case VOICE_DATA_SENT:
      return 3000;
    default:
      return 5000;
  }
}

static HardwareSerial playerSerial(2);
static DFRobotDFPlayerMini player;
static bool ready = false;

// 再生の依頼。NTP 同期のタスクからも頼まれるので、DFPlayer への命令は loop だけで送る
static QueueHandle_t trackQueue = nullptr;

static bool playing = false;
static unsigned long playUntilMs = 0;

bool voiceBegin() {
  trackQueue = xQueueCreate(8, sizeof(uint8_t));
  playerSerial.begin(9600, SERIAL_8N1, PLAYER_RX_PIN, PLAYER_TX_PIN);
  if (trackQueue == nullptr || !player.begin(playerSerial)) {
    return false;
  }
  delay(1000);  // SD カードの準備待ち
  player.volume(PLAYER_VOLUME);
  ready = true;
  return true;
}

void voicePlay(VoiceTrack track) {
  if (trackQueue == nullptr) {
    return;
  }
  uint8_t t = track;
  xQueueSend(trackQueue, &t, 0);
}

// DFPlayer からの通知（終了の通知など）は使わないので読み捨てる。
// available() は readType() で読み出すまで true のままなので、必ず読み出す
static void discardMessages() {
  while (player.available()) {
    player.readType();
  }
}

void voicePlayAndWait(VoiceTrack track) {
  if (!ready) {
    return;
  }
  discardMessages();
  player.play(track);
  delay(trackLengthMs(track) + TRACK_MARGIN_MS);
}

void voiceLoop() {
  if (trackQueue == nullptr) {
    return;
  }
  uint8_t track;
  if (!ready) {
    // DFPlayer がつながっていなければ、頼まれた分は捨てる
    while (xQueueReceive(trackQueue, &track, 0) == pdTRUE) {
    }
    return;
  }

  discardMessages();
  if (playing) {
    if ((long)(millis() - playUntilMs) < 0) {
      return;
    }
    playing = false;
  }

  if (xQueueReceive(trackQueue, &track, 0) == pdTRUE) {
    player.play(track);
    playUntilMs = millis() + trackLengthMs(track) + TRACK_MARGIN_MS;
    playing = true;
  }
}
