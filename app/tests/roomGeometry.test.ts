import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTER_ANCHORS, HIT_AREAS, MOLD_ANCHORS, project, SCENE, SPOT_IDS } from '../src/ui/roomGeometry';

const inScene = ([x, y]: readonly [number, number]) =>
  x >= SCENE.x && x <= SCENE.x + SCENE.width && y >= SCENE.y && y <= SCENE.y + SCENE.height;

test('部屋の外形とカビ・キャラの置き場所が絵の範囲に収まる', () => {
  for (const corner of [project(-0.5, -0.5, 10), project(10, 10, -0.6), project(-0.5, 10, 10), project(10, -0.5, 10)]) assert.ok(inScene(corner), `${corner}`);
  for (const id of SPOT_IDS) {
    for (const anchor of MOLD_ANCHORS[id]) assert.ok(inScene(anchor), `${id} ${anchor}`);
    const [x, y] = CHARACTER_ANCHORS[id];
    assert.ok(inScene([x, y - 84]), id);
  }
});

test('タップ領域は 48 以上あり、ベッドと棚は重ならない', () => {
  const overlaps = (a: string, b: string) => {
    const p = HIT_AREAS[a as keyof typeof HIT_AREAS], q = HIT_AREAS[b as keyof typeof HIT_AREAS];
    return p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
  };
  for (const id of SPOT_IDS) {
    assert.ok(HIT_AREAS[id].width >= 48 && HIT_AREAS[id].height >= 48, id);
  }
  assert.equal(overlaps('bed', 'shelf'), false);
});
