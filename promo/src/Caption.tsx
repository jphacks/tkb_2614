import { loadFont } from '@remotion/google-fonts/MPLUSRounded1c';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

export const { fontFamily } = loadFont('normal', { weights: ['800'] });

/** 画面上部のテロップ。lines は1行ずつ少し遅れて出す。 */
export const Caption = ({ lines, color = '#171d1b', top = 150 }: { lines: string[]; color?: string; top?: number }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top, left: 80, right: 80, textAlign: 'center', fontFamily, fontWeight: 800, color }}>
      {lines.map((line, i) => (
        <div
          key={line}
          style={{
            fontSize: 76,
            lineHeight: 1.35,
            opacity: interpolate(frame, [6 + i * 6, 18 + i * 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            translate: interpolate(frame, [6 + i * 6, 18 + i * 6], ['0px 30px', '0px 0px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};
