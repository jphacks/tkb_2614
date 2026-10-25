import assert from 'node:assert/strict';
import { test } from 'node:test';

import { widgetLinkPage } from '../src/widgets/widgetLinks';

test('ウィジェットの URL から開くページを決める', () => {
  assert.equal(widgetLinkPage('tkb2614://home'), 'home');
  assert.equal(widgetLinkPage('tkb2614://graph'), 'graph');
  assert.equal(widgetLinkPage('tkb2614://unknown'), null);
  assert.equal(widgetLinkPage('https://example.com/graph'), null);
  assert.equal(widgetLinkPage(null), null);
});
