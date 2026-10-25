import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

// `pnpm render:tap-sounds` で作った効果音。タップのたびにランダムに鳴らす。
const sources = [
  require('../../../assets/sounds/puni.wav'),
  require('../../../assets/sounds/pyon.wav'),
  require('../../../assets/sounds/poyon.wav'),
  require('../../../assets/sounds/boyon.wav'),
  require('../../../assets/sounds/pyopyon.wav'),
];

/** Returns a function that plays a random tap sound, never the same one twice in a row. */
export function useTapSound() {
  const players = useRef<AudioPlayer[]>([]);
  const last = useRef(-1);
  useEffect(() => {
    players.current = sources.map((source) => createAudioPlayer(source));
    return () => {
      players.current.forEach((player) => player.remove());
      players.current = [];
    };
  }, []);
  return useCallback(() => {
    const count = players.current.length;
    if (count === 0) return;
    // 初回はすべてから選び、2回目以降は直前の音を除いて選ぶ。
    const first = last.current < 0;
    let index = Math.floor(Math.random() * (first ? count : count - 1));
    if (!first && index >= last.current) index += 1;
    last.current = index;
    const player = players.current[index];
    // 連打したときも頭から鳴らし直す。
    void player.seekTo(0).then(() => player.play()).catch(() => {});
  }, []);
}
