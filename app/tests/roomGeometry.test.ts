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
    // キャラ（86）は足元から上に置く。
    assert.ok(inScene([x - 43, y - 86]) && inScene([x + 43, y]), id);
  }
});

test('スポットのキャラ同士が重ならない', () => {
  const ids = ROOM_SPOTS.map(({ id }) => id);
  for (const a of ids) for (const b of ids) {
    if (a >= b) continue;
    const [ax, ay] = CHARACTER_ANCHORS[a], [bx, by] = CHARACTER_ANCHORS[b];
    assert.ok(Math.abs(ax - bx) >= 86 || Math.abs(ay - by) >= 86, `${a} ${b}`);
  }
});
