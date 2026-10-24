import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { MoldRiskLevel } from '../domain/prediction';
import { Character } from '../ui/Character';
import type { Mood } from '../ui/homeState';
import { Mold } from '../ui/Mold';

// AR は未実装。カメラ映像の代わりに部屋の隅の絵を描き、その上にカビキャラを置く。
// 座標は Figma の AR 画面（402×874）に合わせ、画面いっぱいに切り抜いて表示する。
const VIEW = { width: 402, height: 874 };
const ROOM = {
  wall: '#D9D3C9',
  leftWall: '#C8C0B3',
  floor: '#A9987F',
  baseboard: '#EFEBE4',
};

/** [x, y（下端）, 大きさ]。リスクが高いほど数と大きさを増やす。 */
const MOLDS: Record<MoldRiskLevel, readonly (readonly [number, number, number])[]> = {
  low: [[104, 604, 43]],
  medium: [[98, 604, 61], [150, 604, 43], [76, 548, 40]],
  high: [[94, 604, 79], [150, 604, 61], [196, 604, 43], [240, 604, 32], [70, 518, 58], [78, 448, 43], [84, 388, 32], [30, 668, 50]],
};

export function ARPage({ risk, mood }: { risk: MoldRiskLevel | null; mood: Mood }) {
  return (
    <View style={styles.page}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="xMidYMid slice">
        <Path d="M0 0 H402 V874 H0 Z" fill={ROOM.wall} />
        <Path d="M0 0 L90 0 L90 600 L0 690 Z" fill={ROOM.leftWall} />
        <Path d="M0 690 L90 600 L402 600 L402 874 L0 874 Z" fill={ROOM.floor} />
        <Path d="M90 596 L402 596 L402 604 L90 604 Z" fill={ROOM.baseboard} />
        {risk && MOLDS[risk].map(([x, bottom, size]) => <Mold key={`${x}-${bottom}`} x={x} y={bottom - size} size={size} />)}
      </Svg>
      <View style={styles.character}>
        <Character mood={mood} size={108} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  // 床の上、ページインジケーターの少し上に立たせる。
  character: { position: 'absolute', left: 0, right: 0, bottom: '14%', alignItems: 'center' },
});
