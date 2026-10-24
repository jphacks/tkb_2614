import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, kerning, lineLimit, minimumScaleFactor } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

const SyncWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette } = props;
  const timeColor = props.syncTime === '–' ? palette.outline : palette.onSurface;
  const agoColor = props.syncTime === '–' ? palette.outline : palette.onSurfaceVariant;
  return (
    <VStack alignment="leading" spacing={0} modifiers={[containerBackground(palette.surface, 'widget')]}>
      <HStack>
        <Image systemName="arrow.triangle.2.circlepath" size={28} color={palette.primary} />
        <Spacer />
      </HStack>
      <Spacer />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 48, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.5), kerning(-1.5), foregroundStyle(timeColor)]}>{props.syncTime}</Text>
        <Text modifiers={[font({ size: 20, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.7), foregroundStyle(agoColor)]}>{props.syncAgo}</Text>
      </VStack>
    </VStack>
  );
};

export default createWidget('MoldSync', SyncWidget, initialWidgetProps);
