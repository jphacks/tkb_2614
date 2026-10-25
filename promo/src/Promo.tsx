import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import lowEvents from '../public/recordings/low.events.json';
import humidEvents from '../public/recordings/humid.events.json';
import { Caption, fontFamily } from './Caption';
import { msToFrame, Phone, type RecordedEvent, type Zoom } from './Phone';

const low = lowEvents as RecordedEvent[];
const humid = humidEvents as RecordedEvent[];
const FPS = 30;
// record.sh で撮った順。low: タップ → グラフへスワイプ。humid: タップ → 部屋へスワイプ。
const lowTap = msToFrame(low[0].tMs, FPS);
const lowToGraph = msToFrame(low[1].tMs, FPS);
const humidTap = msToFrame(humid[0].tMs, FPS);
const humidToRoom = msToFrame(humid[1].tMs, FPS);

// アプリの配色（app/src/theme/schemes.ts）。low / medium の primaryContainer と surface。
const LOW_TOP = '#9ef2e3';
const MEDIUM_TOP = '#ffdea9';
const LOW_BG = `linear-gradient(180deg, ${LOW_TOP} 0%, #f4fbf8 70%)`;
const MEDIUM_BG = `linear-gradient(180deg, ${MEDIUM_TOP} 0%, #fff8f3 70%)`;
const fadeTiming = linearTiming({ durationInFrames: 10 });

// 各シーンの長さの合計 960 から、トランジション 6 回 × 10 フレームを引いて 900（30 秒）。
export const Promo = () => (
  <AbsoluteFill style={{ background: '#171d1b' }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="つかみ" durationInFrames={95}>
        <AbsoluteFill style={{ background: '#171d1b' }}>
          <Caption lines={['気づいたら、', 'カビ生えてませんか？']} color="#f4fbf8" top={760} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="センサー" durationInFrames={130}>
        <Device />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="メイン（低）" durationInFrames={190}>
        <AppScene
          lines={['カビやすさを', 'キャラの表情で']}
          src="recordings/low.mp4"
          events={low}
          trimBefore={lowTap - 45}
          zoom={{ from: 70, to: 100, scale: 1.3, x: 540, y: 1260 }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="メイン（湿気）" durationInFrames={160}>
        <AppScene
          medium
          lines={['湿気がたまると', 'カビが広がる']}
          src="recordings/humid.mp4"
          events={humid}
          trimBefore={humidTap - 60}
          zoom={{ from: 20, to: 80, scale: 1.15, x: 540, y: 1300 }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="グラフ" durationInFrames={130}>
        <AppScene
          lines={['24時間の温湿度を', 'グラフで']}
          src="recordings/low.mp4"
          events={low}
          trimBefore={lowToGraph - 12}
          zoom={{ from: 40, to: 70, scale: 1.35, x: 540, y: 460 }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="部屋" durationInFrames={165}>
        <AppScene
          medium
          lines={['どこが危ないか', 'ひと目で']}
          src="recordings/humid.mp4"
          events={humid}
          trimBefore={humidToRoom - 12}
          zoom={{ from: 50, to: 85, scale: 2, x: 780, y: 1000 }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="エンド" durationInFrames={90}>
        <End />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

const AppScene = ({ medium, lines, ...phone }: { medium?: boolean; lines: string[]; src: string; events: RecordedEvent[]; trimBefore: number; zoom?: Zoom }) => (
  <AbsoluteFill style={{ background: medium ? MEDIUM_BG : LOW_BG }}>
    <Phone {...phone} src={staticFile(phone.src)} />
    {/* ズームしたスマホがテロップに重ならないよう、背景の上端の色でフェードさせる。 */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 440, background: `linear-gradient(180deg, ${medium ? MEDIUM_TOP : LOW_TOP} 70%, transparent)` }} />
    <Caption lines={lines} />
  </AbsoluteFill>
);

const Device = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: LOW_BG }}>
      <Img
        src={staticFile('device.jpg')}
        style={{
          position: 'absolute',
          left: 100,
          top: 560,
          width: 880,
          height: 880,
          borderRadius: 64,
          objectFit: 'cover',
          boxShadow: '0 40px 120px rgba(0,0,0,0.2)',
          scale: interpolate(frame, [0, 130], [1, 1.08]),
        }}
      />
      <Caption lines={['部屋の温度と湿度を', 'センサーがはかる']} />
    </AbsoluteFill>
  );
};

const End = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: LOW_BG, alignItems: 'center', justifyContent: 'center', fontFamily, fontWeight: 800, color: '#171d1b' }}>
      <Img src={staticFile('mascots/mimi-low.png')} style={{ width: 560, scale: pop }} />
      <div style={{ fontSize: 130, marginTop: 40, opacity: interpolate(frame, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>カビのしらせ</div>
      <div
        style={{
          fontSize: 64,
          color: '#006b5f',
          opacity: interpolate(frame, [16, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          translate: interpolate(frame, [16, 28], ['0px 20px', '0px 0px'], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }),
        }}
      >
        カビを、先回り。
      </div>
    </AbsoluteFill>
  );
};
