import { Box, Image, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

// Glance の Column は spaceBetween を使えないので、Box を重ねてアイコンを上、値を下に置く。押すとグラフを開く。
const HumidityWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette } = props;
  const valueColor = props.stale ? palette.outline : palette.onSurface;
  const unitColor = props.stale ? palette.outline : palette.onSurfaceVariant;
  return (
    <Box contentAlignment="bottomStart" modifiers={[fillMaxSize(), background(palette.surface), cornerRadius(24), paddingAll(16), { $type: 'widgetURL', url: 'tkb2614://graph' }]}>
      <Box contentAlignment="topStart" modifiers={[fillMaxSize()]}>
        {props.icons.humidity ? <Image source={{ uri: props.icons.humidity }} tint={palette.primary} modifiers={[size(28, 28)]} /> : null}
      </Box>
      <Row verticalAlignment="bottom">
        <Text color={valueColor} maxLines={1} style={{ fontSize: 64, fontWeight: '600' }}>{props.humidity}</Text>
        <Text color={unitColor} maxLines={1} style={{ fontSize: 30, fontWeight: '500' }}>%</Text>
      </Row>
    </Box>
  );
};

export default createWidget('MoldHumidity', HumidityWidget, initialWidgetProps);
