import { Box, Column, Image, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

// Android はタイムラインがないので、「◯分前」はアプリが最後に更新した時点の値のまま残る。
const SyncWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette } = props;
  const timeColor = props.syncTime === '–' ? palette.outline : palette.onSurface;
  const agoColor = props.syncTime === '–' ? palette.outline : palette.onSurfaceVariant;
  return (
    <Box contentAlignment="bottomStart" modifiers={[fillMaxSize(), background(palette.surface), cornerRadius(24), paddingAll(16)]}>
      <Box contentAlignment="topStart" modifiers={[fillMaxSize()]}>
        {props.icons.sync ? <Image source={{ uri: props.icons.sync }} tint={palette.primary} modifiers={[size(28, 28)]} /> : null}
      </Box>
      <Column>
        <Text color={timeColor} maxLines={1} style={{ fontSize: 44, fontWeight: '600' }}>{props.syncTime}</Text>
        <Text color={agoColor} maxLines={1} style={{ fontSize: 18, fontWeight: '500' }}>{props.syncAgo}</Text>
      </Column>
    </Box>
  );
};

export default createWidget('MoldSync', SyncWidget, initialWidgetProps);
