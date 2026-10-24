import { Image } from '@expo/ui/swift-ui';
import { containerBackground, frame, opacity, resizable } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { initialWidgetProps, type MoldWidgetProps } from '../widgetProps';

/** 選んでいるマスコットの表情と配色だけでリスクを表す。'widget' の関数は別ランタイムで動くので、外側の値を参照しない。 */
const CharacterWidget = (props: MoldWidgetProps) => {
  'widget';
  const { palette, character } = props;
  return (
    <Image
      uiImage={character || undefined}
      modifiers={[resizable(), frame({ width: 168, height: 147 }), opacity(props.characterOpacity), containerBackground(palette.surface, 'widget')]}
    />
  );
};

export default createWidget('MoldCharacter', CharacterWidget, initialWidgetProps);
