import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROOM_SPOTS } from '../src/domain/roomSpots';
import { CHARACTER_ANCHORS, project, SCENE } from '../src/ui/roomGeometry';

const inScene = ([x, y]: readonly [number, number]) =>
  x >= SCENE.x && x <= SCENE.x + SCENE.width && y >= SCENE.y && y <= SCENE.y + SCENE.height;

test('部屋の外形とキャラの立ち位置が絵の範囲に収まる', () => {
  for (const corner of [project(-0.5, -0.5, 10), project(10, 10, -0.6), project(-0.5, 10, 10), project(10, -0.5, 10)]) assert.ok(inScene(corner), `${corner}`);
  for (const { id } of ROOM_SPOTS) {
    const [x, y] = CHARACTER_ANCHORS[id];
    // キャラ（104）は足元から上に置く。
    assert.ok(inScene([x - 52, y - 104]) && inScene([x + 52, y]), id);
  }
});

// キャラの枠（mascotViewport）のうち、体が描かれる範囲（artwork の 320×280）。上と左右は動きのための余白。
const body = (id: (typeof ROOM_SPOTS)[number]['id']) => {
  const [x, y] = CHARACTER_ANCHORS[id];
  const scale = 104 / 416;
  return { left: x - 52 + 48 * scale, right: x - 52 + 368 * scale, top: y - 104 + 104 * scale, bottom: y - 104 + 384 * scale };
};

test('スポットのキャラの体同士が重ならない', () => {
  const ids = ROOM_SPOTS.map(({ id }) => id);
  for (const a of ids) for (const b of ids) {
    if (a >= b) continue;
    const p = body(a), q = body(b);
    assert.ok(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top, `${a} ${b}`);
  }
});
