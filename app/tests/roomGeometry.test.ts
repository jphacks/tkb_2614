import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitRoom, ROOM_VIEW, SPOT_ANCHORS, SPOT_HIT_AREAS, SPOT_IDS } from '../src/ui/roomGeometry';

const corners = [
  { x: ROOM_VIEW.x, y: ROOM_VIEW.y },
  { x: ROOM_VIEW.x + ROOM_VIEW.width, y: ROOM_VIEW.y },
  { x: ROOM_VIEW.x, y: ROOM_VIEW.y + ROOM_VIEW.height },
  { x: ROOM_VIEW.x + ROOM_VIEW.width, y: ROOM_VIEW.y + ROOM_VIEW.height },
];
const eps = 1e-9;

for (const bounds of [{ width: 402, height: 874 }, { width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1024, height: 400 }]) {
  test(`${bounds.width}×${bounds.height} でも部屋の四角が見切れず、短い辺いっぱいに中央に収まる`, () => {
    const { toScreen } = fitRoom(bounds);
    const screen = corners.map(toScreen);
    for (const p of screen) {
      assert.ok(p.x >= -eps && p.x <= bounds.width + eps, `x=${p.x}`);
      assert.ok(p.y >= -eps && p.y <= bounds.height + eps, `y=${p.y}`);
    }
    const [topLeft, , , bottomRight] = screen;
    const fillsWidth = Math.abs(topLeft.x) < eps && Math.abs(bottomRight.x - bounds.width) < eps;
    const fillsHeight = Math.abs(topLeft.y) < eps && Math.abs(bottomRight.y - bounds.height) < eps;
    assert.ok(fillsWidth || fillsHeight);
    assert.ok(Math.abs(topLeft.x - (bounds.width - bottomRight.x)) < 1e-6);
    assert.ok(Math.abs(topLeft.y - (bounds.height - bottomRight.y)) < 1e-6);
  });
}

test('アンカーとタップ領域は ROOM_VIEW の中にある', () => {
  const inside = (x: number, y: number) =>
    x >= ROOM_VIEW.x && x <= ROOM_VIEW.x + ROOM_VIEW.width && y >= ROOM_VIEW.y && y <= ROOM_VIEW.y + ROOM_VIEW.height;
  for (const spot of SPOT_IDS) {
    for (const a of SPOT_ANCHORS[spot]) assert.ok(inside(a.x, a.y), `${spot} anchor`);
    const r = SPOT_HIT_AREAS[spot];
    assert.ok(inside(r.x, r.y) && inside(r.x + r.width, r.y + r.height), `${spot} hit area`);
  }
});
