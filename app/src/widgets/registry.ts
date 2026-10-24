import type { Widget } from 'expo-widgets';

import type { MoldWidgetProps } from './widgetProps';

/** ウィジェットのない Web 向け。iOS と Android は registry.ios.ts / registry.android.ts が使われる。 */
export const moldWidgets: readonly Widget<MoldWidgetProps>[] = [];
