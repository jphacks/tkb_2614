import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { MoldRiskLevel } from '../domain/prediction';
import { useScheme, type ColorScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { Mood } from '../ui/homeState';
import { Mold } from '../ui/Mold';
import type { CharacterKind } from '../ui/mascot/types';
import {
  CHARACTER_ANCHORS, DRAW_ORDER, HIT_AREAS, MOLD_ANCHORS, ROOM_SHAPES, SCENE, SPOT_SHAPES, selectedOutline, selectedPads,
  type Paint, type Shape, type SpotId,
} from '../ui/roomGeometry';

/** スポットのカビの画像の [大きさ, 種類]。MOLD_ANCHORS の順に置き、リスクが高いほど数と大きさを増やす。 */
const MOLDS: Record<MoldRiskLevel, readonly (readonly [number, 'small' | 'normal' | 'big'])[]> = {
  low: [[26, 'small']],
  medium: [[40, 'normal'], [28, 'small']],
  high: [[56, 'big'], [42, 'normal']],
};
const CHARACTER_SIZE = 84;
const SPOT_LABELS: Record<SpotId, string> = { window: '窓', bed: 'ベッド', shelf: '棚' };

function paint(scheme: ColorScheme, value: Paint | undefined) {
  if (!value) return 'none';
  return value.startsWith('#') ? value : scheme[value as keyof ColorScheme];
}

function Shapes({ shapes, scheme }: { shapes: readonly Shape[]; scheme: ColorScheme }) {
  return shapes.map((shape, index) => (
    <Path
      key={index}
      d={shape.d}
      fill={paint(scheme, shape.fill)}
      fillOpacity={shape.opacity}
      stroke={paint(scheme, shape.stroke)}
      strokeWidth={shape.strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ));
}

/**
 * 部屋の絵と、窓・ベッド・棚のスポット。選んだスポットは縁取りを強め、その前にキャラを出す。
 * カビの画像は今は部屋全体のリスクで出す（スポットごとのリスクは #24 で入れる）。
 */
export function RoomPage({ risk, mood, character, selected, onSelect, active, topInset, bottomInset }: {
  risk: MoldRiskLevel | null;
  mood: Mood;
  character: CharacterKind;
  selected: SpotId | null;
  onSelect: (spot: SpotId) => void;
  active: boolean;
  topInset: number;
  bottomInset: number;
}) {
  const scheme = useScheme();
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // 絵の全体が収まるよう、縦横の小さい方の倍率に合わせる（meet）。タップ領域とカビ・キャラも同じ変換で置く。
  const scale = bounds ? Math.min(bounds.width / SCENE.width, bounds.height / SCENE.height) : 0;
  const offsetX = bounds ? (bounds.width - SCENE.width * scale) / 2 - SCENE.x * scale : 0;
  const offsetY = bounds ? (bounds.height - SCENE.height * scale) / 2 - SCENE.y * scale : 0;
  const toScreen = (x: number, y: number) => ({ left: x * scale + offsetX, top: y * scale + offsetY });
  const moving = active && isActive;

  return (
    <View style={[styles.page, { backgroundColor: scheme.surface, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.stage} onLayout={({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}>
        <Svg style={StyleSheet.absoluteFill} viewBox={`${SCENE.x} ${SCENE.y} ${SCENE.width} ${SCENE.height}`} preserveAspectRatio="xMidYMid meet" accessible={false}>
          <Shapes shapes={ROOM_SHAPES} scheme={scheme} />
          {DRAW_ORDER.map((id) => (
            <Shapes key={id} scheme={scheme} shapes={id === selected ? [...selectedPads(id), ...SPOT_SHAPES[id], selectedOutline(id)] : SPOT_SHAPES[id]} />
          ))}
        </Svg>
        {bounds && (
          <>
            {DRAW_ORDER.map((id) => {
              const area = HIT_AREAS[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => onSelect(id)}
                  accessibilityRole="button"
                  accessibilityLabel={SPOT_LABELS[id]}
                  accessibilityState={{ selected: id === selected }}
                  style={[styles.hit, toScreen(area.x, area.y), { width: area.width * scale, height: area.height * scale }]}
                />
              );
            })}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {risk && DRAW_ORDER.flatMap((id) => MOLDS[risk].map(([size, variant], index) => {
                const [x, y] = MOLD_ANCHORS[id][index];
                return <Mold key={`${id}-${index}`} x={(x - size / 2) * scale + offsetX} y={(y - size / 2) * scale + offsetY} size={size * scale} variant={variant} moving={moving} />;
              }))}
            </View>
            {selected && (
              <View style={[styles.character, toScreen(CHARACTER_ANCHORS[selected][0] - CHARACTER_SIZE / 2, CHARACTER_ANCHORS[selected][1] - CHARACTER_SIZE)]} pointerEvents="box-none">
                <Character mood={mood} size={CHARACTER_SIZE * scale} character={character} active={moving} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  stage: { flex: 1 },
  hit: { position: 'absolute', borderRadius: 12 },
  character: { position: 'absolute' },
});
