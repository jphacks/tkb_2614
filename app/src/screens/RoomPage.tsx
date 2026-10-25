import { Fragment, memo, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SpotId, SpotPredictions } from '../domain/roomSpots';
import { useScheme, type ColorScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import { moods } from '../ui/homeState';
import { characterKinds, type CharacterKind } from '../ui/mascot/types';
import { ZoomView } from '../ui/ZoomView';
import { CHARACTER_ANCHORS, CONDENSATION_SHAPES, LAYERS, ROOM_SHAPES, SCENE, SPOT_SHAPES, type Paint, type Shape } from '../ui/roomGeometry';

const CHARACTER_SIZE = 104;
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

/** 1層分の絵。最初の層に部屋と結露を含める。描く内容は配色と結露でしか変わらないので、ページの切り替えでは描き直さない。 */
const Layer = memo(function Layer({ index, scheme, isCondensing }: { index: number; scheme: ColorScheme; isCondensing: boolean }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`${SCENE.x} ${SCENE.y} ${SCENE.width} ${SCENE.height}`} preserveAspectRatio="xMidYMid meet" accessible={false} pointerEvents="none">
      {index === 0 && <Shapes shapes={ROOM_SHAPES} scheme={scheme} />}
      {LAYERS[index].spots.map((id) => <Shapes key={id} shapes={SPOT_SHAPES[id]} scheme={scheme} />)}
      {index === 0 && isCondensing && <Shapes shapes={CONDENSATION_SHAPES} scheme={scheme} />}
    </Svg>
  );
});

/** スポットの数だけ、重ならないようにキャラを選ぶ。ページを開くたびに変わらないよう、最初の1回だけ選ぶ。 */
function pickCharacters(): Record<SpotId, CharacterKind> {
  const shuffled = [...characterKinds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { window: shuffled[0], shelf: shuffled[1], bed: shuffled[2] };
}

/**
 * 部屋の絵と、窓・ベッド・棚のそれぞれに立つキャラ。キャラの表情で、どこが危ないかをタップせずにひと目で見せる。
 * 窓が結露していればガラスに水滴を出す。2本指で拡大・移動でき、ダブルタップで拡大と等倍を切り替える。
 */
export function RoomPage({ spots, active, topInset, bottomInset, onTwoFingers }: {
  spots: SpotPredictions;
  /** キャラを動かすか。スワイプ中は止める。 */
  onTwoFingers: (active: boolean) => void;
  active: boolean;
  topInset: number;
  bottomInset: number;
}) {
  const scheme = useScheme();
  const [characters] = useState(pickCharacters);
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // 絵の全体が収まるよう、縦横の小さい方の倍率に合わせる（meet）。キャラも同じ変換で置く。
  const scale = bounds ? Math.min(bounds.width / SCENE.width, bounds.height / SCENE.height) : 0;
  const offsetX = bounds ? (bounds.width - SCENE.width * scale) / 2 - SCENE.x * scale : 0;
  const offsetY = bounds ? (bounds.height - SCENE.height * scale) / 2 - SCENE.y * scale : 0;
  const size = CHARACTER_SIZE * scale;

  return (
    <View style={[styles.page, { backgroundColor: scheme.surface, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.stage} onLayout={({ nativeEvent: { layout } }) => setBounds({ width: layout.width, height: layout.height })}>
        <ZoomView onTwoFingers={onTwoFingers}>
          {LAYERS.map((layer, index) => (
            <Fragment key={index}>
              <Layer index={index} scheme={scheme} isCondensing={spots.window?.isCondensing ?? false} />
              {bounds && layer.characters.map((id) => {
                const prediction = spots[id];
                const [x, y] = CHARACTER_ANCHORS[id];
                const value = prediction ? prediction.moldIndex.toFixed(1) : '–';
                return (
                  <View
                    key={id}
                    style={[styles.spot, { left: x * scale + offsetX - size / 2, top: y * scale + offsetY - size, width: size }]}
                    accessible
                    accessibilityLabel={`${SPOT_LABELS[id]}、カビ指数 ${prediction ? value : '不明'}${prediction?.isProvisional ? '（参考値）' : ''}`}
                  >
                    <Character mood={prediction ? moods[prediction.riskLevel] : 'sleep'} size={size} character={characters[id]} active={active && isActive} />
                  </View>
                );
              })}
            </Fragment>
          ))}
        </ZoomView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  stage: { flex: 1, overflow: 'hidden' },
  spot: { position: 'absolute', alignItems: 'center' },
});
