import { Circle, G, Path } from 'react-native-svg';

import { useScheme } from '../theme/theme';

const BODY =
  'M24 3c4 0 6 4 9 5s8-1 10 3-1 7 0 10 5 6 3 10-6 4-8 7-3 8-7 8-6-4-9-5-8 1-10-3 1-7 0-10-5-6-3-10 6-4 8-7 3-8 7-8z';

/** AR に並ぶカビキャラ。親の Svg の中に置く。inverse-surface と inverse-on-surface の組み合わせ。 */
export function Mold({ x, y, size }: { x: number; y: number; size: number }) {
  const scheme = useScheme();
  return (
    <G transform={`translate(${x} ${y}) scale(${size / 48})`}>
      <Path d={BODY} fill={scheme.inverseSurface} />
      <Circle cx={18} cy={24} r={3} fill={scheme.inverseOnSurface} />
      <Circle cx={30} cy={24} r={3} fill={scheme.inverseOnSurface} />
    </G>
  );
}
