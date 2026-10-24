import { Box, Image, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

const TemperatureWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette } = props;
  const valueColor = props.stale ? palette.outline : palette.onSurface;
  const unitColor = props.stale ? palette.outline : palette.onSurfaceVariant;
  return (
    <Box contentAlignment="bottomStart" modifiers={[fillMaxSize(), background(palette.surface), cornerRadius(24), paddingAll(16)]}>
      <Box contentAlignment="topStart" modifiers={[fillMaxSize()]}>
        {props.icons.temperature ? <Image source={{ uri: props.icons.temperature }} tint={palette.primary} modifiers={[size(28, 28)]} /> : null}
      </Box>
      <Row verticalAlignment="bottom">
        <Text color={valueColor} maxLines={1} style={{ fontSize: 64, fontWeight: '600' }}>{props.temperature}</Text>
        <Text color={unitColor} maxLines={1} style={{ fontSize: 30, fontWeight: '500' }}>°C</Text>
      </Row>
    </Box>
  );
};

export default createWidget('MoldTemperature', TemperatureWidget, initialWidgetProps);
