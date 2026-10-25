import { memo } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { MascotClock } from './MascotClock';
import { MotionGroup } from './MotionGroup';
import type { ArtworkNode } from './types';

const elements = { g: G, path: Path, ellipse: Ellipse, circle: Circle };

/**
 * 時計を渡した場合だけ部位を動かし、背景では同じ素材を静止描画する。
 * 絵の木は種類と表情でしか変わらない。動きは clock が動かすので、キャラの active が切り替わっても描き直さない。
 */
export const Drawing = memo(function Drawing({ nodes, clock }: { nodes: ArtworkNode[]; clock?: MascotClock }) {
  return nodes.map((node, index) => {
    const Element = elements[node.tag];
    const children = node.children.length ? <Drawing nodes={node.children} clock={clock} /> : undefined;
    return node.motion && clock ? (
      <G key={index} {...node.props}>
        <MotionGroup motion={node.motion} clock={clock}>{children}</MotionGroup>
      </G>
    ) : <Element key={index} {...node.props}>{children}</Element>;
  });
});
