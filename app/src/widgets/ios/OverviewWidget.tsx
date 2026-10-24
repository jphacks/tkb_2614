import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, kerning, lineLimit, minimumScaleFactor, opacity, padding, resizable } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

/** 湿度を主役に、キャラ（リスク）・温度・同期時刻をまとめた中サイズ。 */
const OverviewWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette, character } = props;
  const valueColor = props.stale ? palette.outline : palette.onSurface;
  const subColor = props.stale ? palette.outline : palette.onSurfaceVariant;
  const temperature = props.temperature === '–' ? '–' : `${props.temperature}°C`;
  return (
    <HStack spacing={8} modifiers={[padding({ leading: 4, trailing: 16 }), containerBackground(palette.surface, 'widget')]}>
      <Image uiImage={character || undefined} modifiers={[resizable(), frame({ width: 150, height: 131 }), opacity(props.characterOpacity)]} />
      <VStack alignment="leading" spacing={12}>
        <HStack alignment="firstTextBaseline" spacing={2}>
          <Text modifiers={[font({ size: 72, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.5), kerning(-2), foregroundStyle(valueColor)]}>{props.humidity}</Text>
          <Text modifiers={[font({ size: 34, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.5), foregroundStyle(subColor)]}>%</Text>
        </HStack>
        <HStack spacing={12}>
          <HStack spacing={4}>
            <Image systemName="thermometer.medium" size={18} color={palette.primary} />
            <Text modifiers={[font({ size: 20, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.7), foregroundStyle(subColor)]}>{temperature}</Text>
          </HStack>
          <HStack spacing={4}>
            <Image systemName="arrow.triangle.2.circlepath" size={18} color={palette.primary} />
            <Text modifiers={[font({ size: 20, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.7), foregroundStyle(subColor)]}>{props.syncTime}</Text>
          </HStack>
        </HStack>
      </VStack>
      <Spacer />
    </HStack>
  );
};

export default createWidget('MoldOverview', OverviewWidget, initialWidgetProps);
