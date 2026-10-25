import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G } from 'react-native-svg';

import { companions } from './mascot/companions';
import { Drawing } from './mascot/Drawing';
import type { CharacterKind } from './mascot/types';
import { moldCoverage, moldTiles } from './moldCoverage';

/** 元のSVGに付いているカビを背景に群生させる。操作・読み上げは前面のUIに任せる。 */
export function MoldBackground({ moldIndex, character, stale = false }: { moldIndex: number | null; character: CharacterKind; stale?: boolean }) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const coverage = moldCoverage(moldIndex);
  const tiles = useMemo(() => moldTiles(bounds.width, bounds.height, coverage), [bounds.width, bounds.height, coverage]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity: stale ? 0.45 : 1 }]}
      onLayout={({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}
    >
      <Svg width="100%" height="100%" accessible={false}>
        {tiles.map(({ id, x, y, size, rotation }) => (
          <G key={id} transform={`translate(${x} ${y}) rotate(${rotation}) scale(${size / 48})`}>
            <Drawing nodes={companions[character]} />
          </G>
        ))}
      </Svg>
    </View>
  );
}
