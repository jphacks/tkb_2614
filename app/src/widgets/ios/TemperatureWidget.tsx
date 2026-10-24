import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, kerning, lineLimit, minimumScaleFactor } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

const TemperatureWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette } = props;
  const valueColor = props.stale ? palette.outline : palette.onSurface;
  const unitColor = props.stale ? palette.outline : palette.onSurfaceVariant;
  return (
    <VStack alignment="leading" spacing={0} modifiers={[containerBackground(palette.surface, 'widget')]}>
      <HStack>
        <Image systemName="thermometer.medium" size={28} color={palette.primary} />
        <Spacer />
      </HStack>
      <Spacer />
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text modifiers={[font({ size: 72, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.5), kerning(-2), foregroundStyle(valueColor)]}>{props.temperature}</Text>
        <Text modifiers={[font({ size: 34, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.5), foregroundStyle(unitColor)]}>°C</Text>
        <Spacer />
      </HStack>
    </VStack>
  );
};

export default createWidget('MoldTemperature', TemperatureWidget, initialWidgetProps);
