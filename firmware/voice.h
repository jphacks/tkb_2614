#pragma once

#include <Arduino.h>

// DFPlayer Mini（UART2、ESP32 の RX=GPIO16・TX=GPIO17）で、SD カードの音声を流す。
// 再生は頼まれた順に1つずつ、前の音声の長さだけ待ってから次を流す。

// SD カードに入っている音声の番号。音声を差し替えたら voice.cpp の長さも直す
enum VoiceTrack : uint8_t {
  VOICE_SYNC_OK = 2,    // 「時刻の同期に成功しました」
  VOICE_STARTUP = 4,    // 「キュイーン起動しました」
  VOICE_DATA_SENT = 5,  // 「アプリにデータを送信したよ確認してね」
};

// DFPlayer を初期化する。つながっていなければ false を返し、以降の再生は何もしない
bool voiceBegin();

// 再生を頼む。どのタスクから呼んでもよく、待たずに戻る
void voicePlay(VoiceTrack track);

// 流して、その長さだけ待つ。起動時の setup で、ほかの処理を始める前に使う
void voicePlayAndWait(VoiceTrack track);

// 頼まれた音声を順に流す。loop から毎回呼ぶ
void voiceLoop();
