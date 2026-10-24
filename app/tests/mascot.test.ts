import assert from 'node:assert/strict';
import { test } from 'node:test';

import { artwork } from '../src/ui/mascot/artwork';
import { characterKinds, nextCharacter, type ArtworkNode } from '../src/ui/mascot/types';
import { restMotion, selectMotion } from '../src/ui/mascot/motionState';

test('切り替えボタンは5種類を順に循環する', () => {
  assert.deepEqual(characterKinds.map((kind) => nextCharacter(kind, 1)), ['antenna', 'fin', 'mushroom', 'cloudtail', 'mimi']);
  assert.equal(nextCharacter('cloudtail', 1), 'mimi');
  assert.equal(nextCharacter('mimi', -1), 'cloudtail');
  for (const kind of characterKinds) assert.equal(nextCharacter(nextCharacter(kind, 1), -1), kind);
});

test('タップ後と非表示時に本体グループを原位置・等倍へ戻す', () => {
  for (const character of characterKinds) {
    for (const risk of ['low', 'medium', 'high'] as const) {
      const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
        if (node.motion?.reaction) {
          assert.equal(selectMotion(node.motion, true, true), node.motion.reaction);
          assert.equal(selectMotion(node.motion, false, true), node.motion.idle ?? restMotion);
          assert.equal(selectMotion(node.motion, true, false), restMotion);
          if (!node.motion.idle) {
            const [originX, originY] = node.motion.origin;
            for (const frame of selectMotion(node.motion, false, true).frames) {
              assert.equal(frame.rotation, 0);
              assert.equal(frame.scaleX, 1);
              assert.equal(frame.scaleY, 1);
              assert.equal(originX + frame.x - originX * frame.scaleX, 0);
              assert.equal(originY + frame.y - originY * frame.scaleY, 0);
            }
          }
        }
        inspect(node.children);
      });
      inspect(artwork[character][risk]);
    }
  }
});

test('全15状態に描画と有効な待機・タップアニメーションがある', () => {
  for (const character of characterKinds) {
    for (const risk of ['low', 'medium', 'high'] as const) {
      let idleCount = 0;
      let reactionCount = 0;
      const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
        if (node.motion?.idle) idleCount++;
        if (node.motion?.reaction) reactionCount++;
        for (const motion of [node.motion?.idle, node.motion?.reaction]) {
          if (!motion) continue;
          assert.ok(motion.duration > 0);
          assert.equal(motion.frames[0].at, 0);
          assert.equal(motion.frames.at(-1)?.at, 1);
          motion.frames.forEach((frame, index) => {
            assert.ok(Object.values(frame).every(Number.isFinite));
            if (index > 0) assert.ok(frame.at > motion.frames[index - 1].at);
          });
        }
        inspect(node.children);
      });
      inspect(artwork[character][risk]);
      assert.ok(idleCount > 0, `${character}/${risk}: idle`);
      assert.ok(reactionCount > 0, `${character}/${risk}: reaction`);
      assert.notDeepEqual(artwork[character].low, artwork[character].high);
    }
  }
});
