import { Box, Image } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

/** 選んでいるマスコットの表情と配色だけでリスクを表す。'widget' の関数は別ランタイムで動くので、外側の値を参照しない。 */
const CharacterWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette, character } = props;
  return (
    <Box contentAlignment="center" modifiers={[fillMaxSize(), background(palette.surface), cornerRadius(24), paddingAll(4)]}>
      {character ? <Image source={{ uri: character }} contentScale="fit" alpha={props.characterOpacity} contentDescription="カビのリスク" modifiers={[fillMaxSize()]} /> : null}
    </Box>
  );
};

export default createWidget('MoldCharacter', CharacterWidget, initialWidgetProps);
