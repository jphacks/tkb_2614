import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

// `pnpm render:tap-sounds` で作った効果音。タップのたびにランダムに鳴らす。
const sources = [
  require('../../../assets/sounds/puni.wav'),
  require('../../../assets/sounds/pyon.wav'),
  require('../../../assets/sounds/poyon.wav'),
  require('../../../assets/sounds/boyon.wav'),
  require('../../../assets/sounds/pyopyon.wav'),
];

// 部屋ページのキャラも含めて全キャラで同じプレイヤーを使う。キャラごとに作ると数が増え、Android では
// 同時に持てるプレイヤーの数を超えて、後から作ったキャラ（部屋のキャラ）の音が鳴らなかった。
let players: AudioPlayer[] = [];
let users = 0;
let last = -1;

function acquire() {
  if (users++ === 0) players = sources.map((source) => createAudioPlayer(source));
}

function release() {
  if (--users > 0) return;
  players.forEach((player) => player.remove());
  players = [];
}

/** Returns a function that plays a random tap sound, never the same one twice in a row. */
export function useTapSound() {
  useEffect(() => {
    acquire();
    return release;
  }, []);
  return useCallback(() => {
    const count = players.length;
    if (count === 0) return;
    // 初回はすべてから選び、2回目以降は直前の音を除いて選ぶ。
    const first = last < 0;
    let index = Math.floor(Math.random() * (first ? count : count - 1));
    if (!first && index >= last) index += 1;
    last = index;
    const player = players[index];
    // 連打したときも頭から鳴らし直す。
    void player.seekTo(0).then(() => player.play()).catch(() => {});
  }, []);
}
