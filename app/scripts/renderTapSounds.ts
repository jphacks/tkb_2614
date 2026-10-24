// キャラをタップしたときの効果音を assets/sounds/ に書き出す。音を変えたら `pnpm render:tap-sounds` で作り直す。
// 素材のライセンスを気にしなくて済むよう、正弦波を合成して作る。
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(__dirname, '../assets/sounds');
const SAMPLE_RATE = 22050;

/** 1音ぶん。周波数は始まりから終わりへ指数的に動き、音量は立ち上がり後に減衰する。 */
interface Tone {
  start: number;
  duration: number;
  from: number;
  to: number;
  volume: number;
  /** 周波数をゆらす幅（比率）。ぷるぷるした感じを出す。 */
  wobble?: number;
}

function render(tones: Tone[]) {
  const length = Math.ceil(Math.max(...tones.map((t) => t.start + t.duration)) * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (const tone of tones) {
    let phase = 0;
    const count = Math.floor(tone.duration * SAMPLE_RATE);
    const offset = Math.floor(tone.start * SAMPLE_RATE);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const wobble = 1 + (tone.wobble ?? 0) * Math.sin(2 * Math.PI * 28 * (i / SAMPLE_RATE));
      const frequency = tone.from * (tone.to / tone.from) ** t * wobble;
      phase += (2 * Math.PI * frequency) / SAMPLE_RATE;
      // 立ち上がりを数msにしてクリックノイズを防ぐ。
      const envelope = Math.min(1, i / (0.004 * SAMPLE_RATE)) * (1 - t) ** 2;
      // 倍音を少し足して、丸いけれど聞き取りやすい音にする。
      samples[offset + i] += tone.volume * envelope * (Math.sin(phase) + 0.25 * Math.sin(2 * phase));
    }
  }
  return samples;
}

function toWav(samples: Float32Array) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // モノラル
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2));
  return buffer;
}

const sounds: Record<string, Tone[]> = {
  // ぷにっ：高いところから一気に下がる。
  puni: [{ start: 0, duration: 0.14, from: 1400, to: 520, volume: 0.6 }],
  // ぴょん：下から跳ね上がる。
  pyon: [{ start: 0, duration: 0.16, from: 480, to: 1500, volume: 0.55 }],
  // ぽよん：2回はずむ。
  poyon: [
    { start: 0, duration: 0.1, from: 900, to: 600, volume: 0.55 },
    { start: 0.09, duration: 0.16, from: 1100, to: 700, volume: 0.45 },
  ],
  // むにゅ：ゆれながらゆっくり下がる。
  munyu: [{ start: 0, duration: 0.26, from: 760, to: 420, volume: 0.6, wobble: 0.08 }],
};

mkdirSync(outDir, { recursive: true });
for (const [name, tones] of Object.entries(sounds)) {
  const wav = toWav(render(tones));
  writeFileSync(path.join(outDir, `${name}.wav`), wav);
  console.log(`${name}.wav (${wav.byteLength} bytes)`);
}
