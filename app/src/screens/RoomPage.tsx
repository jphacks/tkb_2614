import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Polygon } from 'react-native-svg';

import { useScheme, type ColorScheme } from '../theme/theme';
import { fitRoom, ROOM_VIEW, SPOT_HIT_AREAS, SPOT_IDS, type RoomLayout, type SpotId } from '../ui/roomGeometry';

// 座標（Figma「A / Room (default)」フレーム 402×874 の座標系）と fitRoom は ../ui/roomGeometry にある。

/** 押せることを示す縁取り用の外形。 */
const SPOT_OUTLINES: Record<SpotId, string> = {
  window: '210.44,304.88 271.24,335.28 271.24,410.1 274.6,411.8 274.6,416.3 266.6,420.3 199.4,386.7 199.4,382.2 207.4,378.2 210.44,379.72',
  bed: '50.6,453.2 111.4,422.8 117,425.6 117,454.25 196.2,493.85 198.6,492.75 201,505.1 201,516.35 145.8,543.95 145.8,548.4 139.4,551.6 133,548.4 56.2,510 50.6,507.2',
  shelf: '284.2,392.8 311.4,379.2 353,400 353,508 325.8,521.6 284.2,500.8',
};

const SPOT_LABELS: Record<SpotId, string> = { window: '窓', bed: 'ベッド', shelf: '棚' };

/** 木の色はテーマによらず固定する。 */
const wood = { light: '#EBD9BA', top: '#DCC39B', left: '#C9A472', right: '#AE8656' } as const;
const glint = '#FFFFFF';

/**
 * 斜め上から見下ろした部屋。窓・ベッド・棚をタップすると onSelect で SpotId を返す。
 * overlay には部屋の座標を画面座標に直す関数が渡るので、SPOT_ANCHORS にキャラやカビを置ける。
 */
export function RoomPage({ selected, onSelect, topInset, bottomInset, overlay }: {
  selected: SpotId | null;
  onSelect: (spot: SpotId) => void;
  topInset: number;
  bottomInset: number;
  overlay?: (layout: RoomLayout) => ReactNode;
}) {
  const scheme = useScheme();
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null);
  const layout = bounds && fitRoom(bounds);

  return (
    <View style={[styles.page, { backgroundColor: scheme.surface, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.stage} onLayout={({ nativeEvent: { layout: l } }) => setBounds({ width: l.width, height: l.height })}>
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox={`${ROOM_VIEW.x} ${ROOM_VIEW.y} ${ROOM_VIEW.width} ${ROOM_VIEW.height}`}
          preserveAspectRatio="xMidYMid meet"
          accessible={false}
        >
          <RoomShell scheme={scheme} />
          <Window scheme={scheme} />
          <Shelf scheme={scheme} />
          <Bed scheme={scheme} />
          {SPOT_IDS.map((spot) => (
            <Polygon
              key={spot}
              points={SPOT_OUTLINES[spot]}
              fill={spot === selected ? scheme.primary : 'none'}
              fillOpacity={0.12}
              stroke={spot === selected ? scheme.primary : scheme.outlineVariant}
              strokeWidth={spot === selected ? 3 : 1.5}
              strokeDasharray={spot === selected ? undefined : '6 4'}
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {/*
          タップは SVG ではなく上に重ねた Pressable で受ける。横スワイプが始まると
          ScrollView がタッチを奪って onPress が取り消されるので、ページ移動とぶつからない。
        */}
        {layout && SPOT_IDS.map((spot) => {
          const area = SPOT_HIT_AREAS[spot];
          const topLeft = layout.toScreen(area);
          return (
            <Pressable
              key={spot}
              onPress={() => onSelect(spot)}
              accessibilityRole="button"
              accessibilityLabel={SPOT_LABELS[spot]}
              accessibilityState={{ selected: spot === selected }}
              style={({ pressed }) => ({
                position: 'absolute',
                left: topLeft.x,
                top: topLeft.y,
                width: area.width * layout.scale,
                height: area.height * layout.scale,
                borderRadius: 12 * layout.scale,
                backgroundColor: pressed ? scheme.primary : 'transparent',
                opacity: pressed ? 0.08 : 1,
              })}
            />
          );
        })}
        {layout && overlay && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">{overlay(layout)}</View>
        )}
      </View>
    </View>
  );
}

function RoomShell({ scheme }: { scheme: ColorScheme }) {
  return (
    <G>
      {/* walls */}
      <Path d="M201 432L41 512V362L201 282V432Z" fill={scheme.surfaceContainerLow} />
      <Path d="M201 432L361 512V362L201 282V432Z" fill={scheme.surfaceContainerLowest} />
      <Path d="M201.16 432.08L41.16 512.08V506.08L201.16 426.08V432.08Z" fill={wood.top} />
      <Path d="M200.84 432.08L360.84 512.08V506.08L200.84 426.08V432.08Z" fill={wood.top} />
      <Path d="M201 282L361 362L369 358L201 274L33 358L41 362L201 282Z" fill={scheme.surfaceContainerHighest} />
      <Path d="M369 358L361 362V521L369 517V358Z" fill={scheme.outlineVariant} />
      <Path d="M33 358L41 362V521L33 517V358Z" fill={scheme.surfaceContainerHighest} />
      {/* floor */}
      <Path d="M201 432L361 512L201 592L41 512L201 432Z" fill={wood.light} />
      <Path
        d="M181 442L341 522M161 452L321 532M141 462L301 542M121 472L281 552M101 482L261 562M81 492L241 572M61 502L221 582M252.2 457.6L232.2 467.6M286.6 494.8L266.6 504.8M189.8 466.4L169.8 476.4M221 502L201 512M252.2 537.6L232.2 547.6M158.6 510.8L138.6 520.8M191.4 547.2L171.4 557.2M99.4 521.2L79.4 531.2"
        stroke={wood.top}
        strokeLinecap="round"
      />
      <Path d="M41 512L201 592V601L41 521V512Z" fill={wood.left} />
      <Path d="M361 512L201 592V601L361 521V512Z" fill={wood.right} />
      <Path
        d="M214.317 498.942C216.006 498.097 217.994 498.097 219.683 498.942L270.267 524.233C274.689 526.445 274.689 532.755 270.267 534.967L219.683 560.258C217.994 561.103 216.006 561.103 214.317 560.258L163.733 534.967C159.311 532.755 159.311 526.445 163.733 524.233L214.317 498.942Z"
        fill={scheme.surfaceContainerHigh}
      />
    </G>
  );
}

function Window({ scheme }: { scheme: ColorScheme }) {
  return (
    <G>
      <Path d="M210.44 379.88L271.24 410.28V335.28L210.44 304.88V379.88Z" fill={wood.left} />
      <Path d="M215.08 377.86L239.08 389.86V323.86L215.08 311.86V377.86Z" fill={scheme.tertiaryContainer} />
      <Path d="M242.28 391.46L266.28 403.46V337.46L242.28 325.46V391.46Z" fill={scheme.tertiaryContainer} />
      <Path d="M220.2 342.6L225 345L234.6 328.8L229.8 326.4L220.2 342.6Z" fill={glint} />
      <Path d="M247.4 380.2L250.6 381.8L258.6 369.3L255.4 367.7L247.4 380.2Z" fill={glint} />
      {/* sill */}
      <Path d="M199.4 386.7L266.6 420.3V415.8L199.4 382.2V386.7Z" fill={wood.left} />
      <Path d="M274.6 416.3L266.6 420.3V415.8L274.6 411.8V416.3Z" fill={wood.right} />
      <Path d="M207.4 378.2L274.6 411.8L266.6 415.8L199.4 382.2L207.4 378.2Z" fill={wood.top} />
    </G>
  );
}

function Shelf({ scheme }: { scheme: ColorScheme }) {
  return (
    <G>
      <Path d="M284.2 500.8L325.8 521.6V413.6L284.2 392.8V500.8Z" fill={wood.left} />
      <Path d="M353 508L325.8 521.6V413.6L353 400V508Z" fill={wood.right} />
      <Path d="M311.4 379.2L353 400L325.8 413.6L284.2 392.8L311.4 379.2Z" fill={wood.top} />
      <Path d="M288.04 498.38L321.64 515.18V485.18L288.04 468.38V498.38Z" fill={wood.right} />
      <Path d="M288.04 464.63L321.64 481.43V450.68L288.04 433.88V464.63Z" fill={wood.right} />
      <Path d="M288.04 430.13L321.64 446.93V415.43L288.04 398.63V430.13Z" fill={wood.right} />
      {/* items */}
      <Path d="M290.28 499.66L295.88 502.46V479.96L290.28 477.16V499.66Z" fill={scheme.primaryContainer} />
      <Path d="M296.68 502.86L301.48 505.26V479.76L296.68 477.36V502.86Z" fill={scheme.tertiaryContainer} />
      <Path d="M302.28 505.66L307.08 508.06V487.81L302.28 485.41V505.66Z" fill={scheme.secondaryContainer} />
      <Path d="M309.48 509.26L319.08 514.06V499.06L309.48 494.26V509.26Z" fill={wood.light} />
      <Path d="M290.28 465.91L307.88 474.71V470.21L290.28 461.41V465.91Z" fill={scheme.primaryContainer} />
      <Path d="M291.08 461.81L306.28 469.41V465.36L291.08 457.76V461.81Z" fill={scheme.surfaceContainerLowest} />
      <Path d="M311.08 476.31L315.88 478.71V452.46L311.08 450.06V476.31Z" fill={scheme.tertiaryContainer} />
      <Path d="M316.68 479.11L320.68 481.11V457.86L316.68 455.86V479.11Z" fill={scheme.primaryContainer} />
      <Path d="M290.28 431.41L295.08 433.81V409.06L290.28 406.66V431.41Z" fill={scheme.secondaryContainer} />
      <Path d="M295.88 434.21L300.68 436.61V408.86L295.88 406.46V434.21Z" fill={scheme.primaryContainer} />
      <Path d="M308.68 440.61L319.08 445.81V431.56L308.68 426.36V440.61Z" fill={scheme.surfaceContainerLowest} />
    </G>
  );
}

function Bed({ scheme }: { scheme: ColorScheme }) {
  return (
    <G>
      {/* headboard */}
      <Path d="M50.6 507.2L56.2 510V456L50.6 453.2V507.2Z" fill={wood.left} />
      <Path d="M117 479.6L56.2 510V456L117 425.6V479.6Z" fill={wood.right} />
      <Path d="M111.4 422.8L117 425.6L56.2 456L50.6 453.2L111.4 422.8Z" fill={wood.top} />
      {/* leg */}
      <Path d="M133 548.4L139.4 551.6V546.35L133 543.15V548.4Z" fill={wood.left} />
      <Path d="M145.8 548.4L139.4 551.6V546.35L145.8 543.15V548.4Z" fill={wood.right} />
      <Path d="M139.4 539.95L145.8 543.15L139.4 546.35L133 543.15L139.4 539.95Z" fill={wood.top} />
      {/* base */}
      <Path d="M56.2 504.75L140.2 546.75V535.5L56.2 493.5V504.75Z" fill={wood.left} />
      <Path d="M201 516.35L140.2 546.75V535.5L201 505.1V516.35Z" fill={wood.right} />
      <Path d="M117 463.1L201 505.1L140.2 535.5L56.2 493.5L117 463.1Z" fill={wood.top} />
      {/* mattress */}
      <Path d="M60.2 493.1L140.2 533.1V521.85L60.2 481.85V493.1Z" fill={scheme.surfaceContainerHigh} />
      <Path d="M196.2 505.1L140.2 533.1V521.85L196.2 493.85V505.1Z" fill={scheme.surfaceContainerHighest} />
      <Path d="M116.2 453.85L196.2 493.85L140.2 521.85L60.2 481.85L116.2 453.85Z" fill={scheme.surfaceContainerLowest} />
      {/* pillow */}
      <Path d="M69.8 480.25L88.2 489.45V483.45L69.8 474.25V480.25Z" fill={scheme.surfaceContainerHigh} />
      <Path d="M131.4 467.85L88.2 489.45V483.45L131.4 461.85V467.85Z" fill={scheme.surfaceContainerHighest} />
      <Path d="M113 452.65L131.4 461.85L88.2 483.45L69.8 474.25L113 452.65Z" fill={scheme.surfaceContainerLowest} />
      {/* duvet（側面は secondaryContainer に黒を 6% / 12% 重ねて陰を付ける） */}
      <Path d="M84.2 505.9L141 534.3V521.55L84.2 493.15V505.9Z" fill={scheme.secondaryContainer} />
      <Path d="M84.2 505.9L141 534.3V521.55L84.2 493.15V505.9Z" fill="#000000" fillOpacity={0.06} />
      <Path d="M198.6 505.5L141 534.3V521.55L198.6 492.75V505.5Z" fill={scheme.secondaryContainer} />
      <Path d="M198.6 505.5L141 534.3V521.55L198.6 492.75V505.5Z" fill="#000000" fillOpacity={0.12} />
      <Path d="M141.8 464.35L198.6 492.75L141 521.55L84.2 493.15L141.8 464.35Z" fill={scheme.secondaryContainer} />
      <Path d="M141.8 464.34L151.4 469.14L93.8 497.94L84.2 493.14L141.8 464.34Z" fill={scheme.surfaceContainerLowest} />
      <Path d="M84.18 505.91L93.78 510.71V497.96L84.18 493.16V505.91Z" fill={scheme.surfaceContainerHigh} />
    </G>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden' },
  stage: { flex: 1 },
});
