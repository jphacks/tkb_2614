import Svg, { Circle, Path } from 'react-native-svg';

import { useScheme } from '../theme/theme';
import type { Mood } from './homeState';

/** 低く横広のおむすび形で、裾を波打たせている（Figma の Character と同じパス）。 */
const BODY =
  'M120 52 C146 52 162 70 184 100 C206 130 226 158 222 180 C219 196 210 202 198 202 Q182.4 212 166.8 202 Q151.2 212 135.6 202 Q120 212 104.4 202 Q88.8 212 73.2 202 Q57.6 212 42 202 C30 202 21 196 18 180 C14 158 34 130 56 100 C78 70 94 52 120 52 Z';

const moodLabels: Record<Mood, string> = { fine: '快適', worried: 'カビに注意', dizzy: 'カビの危険', sleep: '未接続' };

function Face({ mood, color }: { mood: Mood; color: string }) {
  const stroke = { stroke: color, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  switch (mood) {
    case 'fine':
      return (
        <>
          <Circle cx={98} cy={150} r={7} fill={color} />
          <Circle cx={142} cy={150} r={7} fill={color} />
          <Path d="M106 170 Q120 184 134 170" {...stroke} />
        </>
      );
    case 'worried':
      return (
        <>
          <Circle cx={98} cy={152} r={7} fill={color} />
          <Circle cx={142} cy={152} r={7} fill={color} />
          <Path d="M108 176 Q120 170 132 176" {...stroke} />
          <Path d="M168 104 C162 114 160 120 168 124 C176 120 174 114 168 104 Z" {...stroke} />
        </>
      );
    case 'dizzy':
      return (
        <>
          <Path d="M90 142 L106 158 M106 142 L90 158 M134 142 L150 158 M150 142 L134 158" {...stroke} />
          <Path d="M102 178 q6 -7 12 0 t12 0 t12 0" {...stroke} />
        </>
      );
    case 'sleep':
      return <Path d="M88 152 Q98 160 108 152 M132 152 Q142 160 152 152 M114 176 H126" {...stroke} />;
  }
}

export function Character({ mood, size }: { mood: Mood; size: number }) {
  const scheme = useScheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityRole="image" accessibilityLabel={moodLabels[mood]}>
      <Path d={BODY} fill={scheme.primaryContainer} />
      <Face mood={mood} color={scheme.onPrimaryContainer} />
    </Svg>
  );
}
