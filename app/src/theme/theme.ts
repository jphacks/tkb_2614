import { createContext, useContext } from 'react';
import type { TextStyle } from 'react-native';

import type { MoldRiskLevel } from '../domain/prediction';
import { schemes, type ColorScheme } from './schemes';

export type { ColorScheme };

/** リスクごとに配色全体を切り替える。リスク不明（未接続など）は low の配色を使う。 */
export function schemeFor(risk: MoldRiskLevel | null): ColorScheme {
  return schemes[`${risk ?? 'low'}-light`];
}

export const SchemeContext = createContext<ColorScheme>(schemes['low-light']);

export function useScheme(): ColorScheme {
  return useContext(SchemeContext);
}

/** App.tsx の useFonts で読み込む名前。 */
export const fonts = {
  medium: 'Roboto_500Medium',
  semiBold: 'Roboto_600SemiBold',
} as const;

/** M3 の type scale のうち使うものだけ。reading は Display Large emphasized を Expressive に拡大したもの。 */
export const type = {
  reading: { fontFamily: fonts.semiBold, fontSize: 128, lineHeight: 140, letterSpacing: -4 },
  readingUnit: { fontFamily: fonts.medium, fontSize: 45, lineHeight: 52 },
  /** グラフのカードに出す最新値。 */
  headline: { fontFamily: fonts.semiBold, fontSize: 32, lineHeight: 40 },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, letterSpacing: 0.5 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
} as const satisfies Record<string, TextStyle>;

export const space = { s8: 8, s12: 12, s16: 16, s24: 24 } as const;

export const corner = { extraLargeIncreased: 32, full: 9999 } as const;
