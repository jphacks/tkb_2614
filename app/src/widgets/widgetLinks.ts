/** ウィジェットを押したときに開くページ。URL は各ウィジェットの widgetURL と app.json の scheme に揃える。 */
export type WidgetLinkPage = 'home' | 'graph';

const pages: Record<string, WidgetLinkPage> = { home: 'home', graph: 'graph' };

/** tkb2614://home のような URL から開くページを返す。ウィジェットからの URL でなければ null。 */
export function widgetLinkPage(url: string | null | undefined): WidgetLinkPage | null {
  const match = url?.match(/^tkb2614:\/\/([a-z]+)/);
  return (match && pages[match[1]]) ?? null;
}
