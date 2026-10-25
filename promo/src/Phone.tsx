import { Audio, Video } from '@remotion/media';
import { Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

/** record.sh が書く <take>.events.json。tMs は映像の時刻、座標は録画（1080x2400）の px。 */
export type RecordedEvent = { kind: string; tMs: number; x: number; y: number; x2?: number; y2?: number };

// ponytail: events.json の時刻はスワイプの映りはじめに合わせてある。タップの波紋が映像とずれたら、ここで合わせる。
const RECORD_OFFSET_MS = 0;

const SRC_W = 1080;
const SRC_H = 2400;
const SCREEN_W = 640;
const SCALE = SCREEN_W / SRC_W;
const SCREEN_H = SRC_H * SCALE;
const BEZEL = 18;
const LEFT = (1080 - SCREEN_W) / 2 - BEZEL;
const TOP = 420;
// ズームしたとき、注目点を寄せる先（コンポジション上の座標）。
const FOCUS_TO = { x: 540, y: 1200 };

export const msToFrame = (ms: number, fps: number) => Math.round(((ms + RECORD_OFFSET_MS) / 1000) * fps);

export type Zoom = { from: number; to: number; scale: number; x: number; y: number };

/**
 * スマホのフレームに録画を映す。trimBefore は録画の何フレーム目から使うか。
 * events のタップに波紋と効果音、スワイプに指の軌跡を重ね、zoom で録画上の (x, y) へ寄る。
 */
export const Phone = ({ src, events, trimBefore, zoom }: { src: string; events: RecordedEvent[]; trimBefore: number; zoom?: Zoom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = zoom
    ? interpolate(frame, [zoom.from, zoom.to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.65, 0, 0.35, 1) })
    : 0;
  const fx = LEFT + BEZEL + (zoom?.x ?? 0) * SCALE;
  const fy = TOP + BEZEL + (zoom?.y ?? 0) * SCALE;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: `${fx}px ${fy}px`,
        scale: zoom ? 1 + (zoom.scale - 1) * p : 1,
        translate: `${(FOCUS_TO.x - fx) * p}px ${(FOCUS_TO.y - fy) * p}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: LEFT,
          top: TOP,
          padding: BEZEL,
          borderRadius: 96,
          background: '#16191a',
          boxShadow: '0 40px 120px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: 78, overflow: 'hidden', position: 'relative', background: '#fff' }}>
          <Video src={src} trimBefore={trimBefore} muted style={{ width: SCREEN_W, height: SCREEN_H }} />
          {events.map((e) => {
            const at = msToFrame(e.tMs, fps) - trimBefore;
            if (at < -20) return null;
            return (
              <Sequence key={e.tMs} from={at} durationInFrames={24} layout="none">
                {e.kind === 'tap' ? <Ripple x={e.x * SCALE} y={e.y * SCALE} /> : <SwipeTrail x={e.x * SCALE} y={e.y * SCALE} x2={(e.x2 ?? e.x) * SCALE} />}
                {e.kind === 'tap' && at >= 0 && <Audio src={staticFile('sounds/puni.wav')} />}
              </Sequence>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Ripple = ({ x, y }: { x: number; y: number }) => {
  const frame = useCurrentFrame();
  const size = interpolate(frame, [0, 18], [40, 170], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          border: '6px solid rgba(255,255,255,0.95)',
          boxShadow: '0 0 0 3px rgba(0,0,0,0.12)',
          opacity: interpolate(frame, [0, 18], [1, 0], { extrapolateRight: 'clamp' }),
        }}
      />
      <Dot x={x} y={y} opacity={interpolate(frame, [0, 4, 10], [0, 1, 0], { extrapolateRight: 'clamp' })} />
    </>
  );
};

const SwipeTrail = ({ x, y, x2 }: { x: number; y: number; x2: number }) => {
  const frame = useCurrentFrame();
  const cx = interpolate(frame, [0, 10], [x, x2], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  return <Dot x={cx} y={y} opacity={interpolate(frame, [0, 3, 10, 14], [0, 1, 1, 0], { extrapolateRight: 'clamp' })} />;
};

const Dot = ({ x, y, opacity }: { x: number; y: number; opacity: number }) => (
  <div
    style={{
      position: 'absolute',
      left: x - 36,
      top: y - 36,
      width: 72,
      height: 72,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.75)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      opacity,
    }}
  />
);
