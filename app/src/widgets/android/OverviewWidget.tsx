import { Box, Button, Column, Image, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, padding, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

/**
 * 湿度を主役に、キャラ（リスク）・温度・同期時刻をまとめた中サイズ。
 * 押した場所で動きを変える。キャラ側はホーム、数字側はグラフを開き、同期時刻は同期する（SyncWidget と同じ）。
 */
const OverviewWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette, character } = props;
  const valueColor = props.stale ? palette.outline : palette.onSurface;
  const subColor = props.stale ? palette.outline : palette.onSurfaceVariant;
  const temperature = props.temperature === '–' ? '–' : `${props.temperature}°C`;
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxSize(), background(palette.surface), cornerRadius(24), padding(4, 4, 16, 4), { $type: 'widgetURL', url: 'tkb2614://home' }]}>
      {character ? <Image source={{ uri: character }} contentScale="fit" alpha={props.characterOpacity} contentDescription="カビのリスク" modifiers={[size(144, 126)]} /> : null}
      <Spacer modifiers={[width(8)]} />
      {/* 数字のまわりの余白を押してもグラフを開くよう、残りの幅いっぱいに広げる。 */}
      <Box contentAlignment="centerStart" modifiers={[fillMaxSize(), { $type: 'widgetURL', url: 'tkb2614://graph' }]}>
        <Column>
          <Row verticalAlignment="bottom" modifiers={[padding(0, 0, 0, 8)]}>
            <Text color={valueColor} maxLines={1} style={{ fontSize: 64, fontWeight: '600' }}>{props.humidity}</Text>
            <Text color={subColor} maxLines={1} style={{ fontSize: 30, fontWeight: '500' }}>%</Text>
          </Row>
          <Row verticalAlignment="center">
            {props.icons.temperature ? <Image source={{ uri: props.icons.temperature }} tint={palette.primary} modifiers={[size(18, 18)]} /> : null}
            <Spacer modifiers={[width(4)]} />
            <Text color={subColor} maxLines={1} style={{ fontSize: 18, fontWeight: '500' }}>{temperature}</Text>
            <Spacer modifiers={[width(12)]} />
            <Button>
              <Row verticalAlignment="center">
                {props.syncing ? (
                  <Image source={{ uri: 'remote-layout:widget_sync_spinner' }} tint={palette.primary} contentDescription="同期中" modifiers={[size(18, 18)]} />
                ) : props.icons.sync ? (
                  <Image source={{ uri: props.icons.sync }} tint={palette.primary} modifiers={[size(18, 18)]} />
                ) : null}
                <Spacer modifiers={[width(4)]} />
                <Text color={subColor} maxLines={1} style={{ fontSize: 18, fontWeight: '500' }}>{props.syncTime}</Text>
              </Row>
            </Button>
          </Row>
        </Column>
      </Box>
    </Row>
  );
};

export default createWidget('MoldOverview', OverviewWidget, initialWidgetProps);
