import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { companions } from './mascot/companions';
import type { ArtworkNode, CharacterKind } from './mascot/types';
import { moldCoverage, moldTiles } from './moldCoverage';

const elements = { g: G, path: Path, ellipse: Ellipse, circle: Circle };
function Drawing({ nodes }: { nodes: ArtworkNode[] }) {
  return nodes.map((node, index) => {
    const Element = elements[node.tag];
    return <Element key={index} {...node.props}>{node.children.length ? <Drawing nodes={node.children} /> : undefined}</Element>;
  });
}

/** 元のSVGに付いているカビを背景に群生させる。操作・読み上げは前面のUIに任せる。 */
export function MoldBackground({ moldIndex, character }: { moldIndex: number | null; character: CharacterKind }) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const coverage = moldCoverage(moldIndex);
  const tiles = useMemo(() => moldTiles(bounds.width, bounds.height, coverage), [bounds.width, bounds.height, coverage]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
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
