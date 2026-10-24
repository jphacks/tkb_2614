import assert from 'node:assert/strict';
import { test } from 'node:test';

import { artwork } from '../src/ui/mascot/artwork';
import { characterKinds, nextCharacter, type ArtworkNode } from '../src/ui/mascot/types';
import { easeAt, groupFrame, restMotion, sampleMotion, selectMotion } from '../src/ui/mascot/motionState';
import { MascotClock } from '../src/ui/mascot/MascotClock';
import { RandomIdle } from '../src/ui/mascot/RandomIdle';

test('ランダム待機は直前を除く全候補から選び、同じ周期では選び直さない', () => {
  const choices = Array.from({ length: 5 }, () => ({ ...restMotion, duration: 8000 }));
  for (let first = 0; first < choices.length; first++) {
    const reached = new Set();
    for (let next = 0; next < choices.length - 1; next++) {
      const values = [(first + .5) / choices.length, (next + .5) / (choices.length - 1)];
      let calls = 0;
      const idle = new RandomIdle(choices, () => values[calls++]);
      assert.equal(idle.at(0), choices[first]);
      assert.equal(idle.at(7999), choices[first]);
      assert.equal(calls, 1);
      const selected = idle.at(8000);
      assert.notEqual(selected, choices[first]);
      assert.equal(calls, 2);
      reached.add(selected);
    }
    assert.equal(reached.size, choices.length - 1);
  }
});

test('全15状態に5種類の待機動作があり、静止区間と姿勢の連続性を保つ', () => {
  for (const character of characterKinds) {
    for (const risk of ['low', 'medium', 'high'] as const) {
      const bodies: NonNullable<ArtworkNode['motion']>[] = [];
      const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
        if (node.motion?.idleVariants) bodies.push(node.motion);
        inspect(node.children);
      });
      inspect(artwork[character][risk]);
      assert.equal(bodies.length, 1, `${character}/${risk}`);
      const body = bodies[0];
      const choices = [body.idle!, ...body.idleVariants!];
      assert.equal(choices.length, 5);
      assert.equal(new Set(choices.map((motion) => JSON.stringify(motion.frames))).size, 5);
      for (const motion of choices) {
        assert.ok(motion.duration >= 7600);
        assert.equal(motion.duration, body.idle!.duration);
        assert.equal(motion.delay, 0);
        for (const elapsed of [0, motion.duration * .32, motion.duration * .64, motion.duration]) {
          const { at, ...pose } = sampleMotion(motion, elapsed, false);
          assert.ok(Number.isFinite(at));
          const { at: restAt, ...rest } = restMotion.frames[0];
          assert.equal(restAt, 0);
          assert.deepEqual(pose, rest);
        }
      }
    }
  }
});

test('高リスクの本体は待機・タップとも跳ねず、沈む動きになる', () => {
  for (const character of characterKinds) {
    let bodies = 0;
    let reactions = 0;
    const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
      if (node.motion?.idleVariants) {
        bodies++;
        for (const motion of [node.motion.idle!, ...node.motion.idleVariants]) {
          assert.ok(motion.frames.some((frame) => frame.y > 0), character);
          assert.ok(motion.frames.every((frame) => frame.y >= 0 && frame.scaleY <= 1), character);
        }
      }
      // The tap-body wraps the body gesture; mold reactions are independent.
      if (node.motion?.reaction && node.children.some((child) => child.motion?.idleVariants)) {
        reactions++;
        assert.ok(node.motion.reaction.frames.some((frame) => frame.y > 0), character);
        assert.ok(node.motion.reaction.frames.every((frame) => frame.y >= 0 && frame.scaleY <= 1), character);
      }
      inspect(node.children);
    });
    inspect(artwork[character].high);
    assert.equal(bodies, 1, character);
    assert.equal(reactions, 1, character);
  }
});

test('ランダム待機はタップや一時停止で選び直されず、停止中は原位置になる', () => {
  const choices = [
    { ...restMotion, duration: 8000 },
    { ...restMotion, duration: 8000, frames: restMotion.frames.map((frame) => ({ ...frame, x: 10 })) },
  ];
  const idle = new RandomIdle(choices, () => .99);
  const motion = { origin: [0, 0], idle: choices[0], reaction: { ...restMotion, duration: 780 } };
  assert.equal(idle.at(6000), choices[1]);
  assert.equal(groupFrame(motion, 6000, null, true, idle.at(6000)).x, 10);
  assert.equal(groupFrame(motion, 6100, 6000, true, idle.at(6100)).x, 0);
  assert.equal(groupFrame(motion, 6900, 6000, true, idle.at(6900)).x, 10);
  assert.equal(groupFrame(motion, 6900, null, false, idle.at(6900)).x, 0);
  assert.equal(idle.at(6900), choices[1]);
  assert.equal(idle.at(8000), choices[0]);
});

function fakeClock() {
  const callbacks = new Map<number, (time: number) => void>();
  let id = 0;
  const clock = new MascotClock((callback) => { callbacks.set(++id, callback); return id; }, (frame) => { callbacks.delete(frame); });
  return {
    clock, callbacks,
    tick(time: number) {
      const scheduled = [...callbacks.values()];
      callbacks.clear();
      scheduled.forEach((callback) => callback(time));
    },
  };
}

test('全グループが1つのフレーム予約を共有し、停止時に予約とタップを破棄する', () => {
  const { clock, callbacks, tick } = fakeClock();
  let latest: [number, number | null, boolean] | undefined;
  const unsubscribe = clock.subscribe((...frame) => { latest = frame; });
  const other = clock.subscribe(() => {});
  clock.setActive(true);
  assert.equal(callbacks.size, 1);
  tick(100); tick(300);
  assert.deepEqual(latest, [200, null, true]);
  clock.react();
  assert.deepEqual(latest, [200, 200, true]);
  clock.setActive(false);
  assert.equal(callbacks.size, 0);
  clock.react();
  assert.deepEqual(latest, [200, null, false]);
  clock.setActive(true);
  tick(5000); tick(5100);
  assert.deepEqual(latest, [300, null, true]);
  assert.equal(callbacks.size, 1);
  clock.setActive(false);
  unsubscribe(); other();
});

test('タップ中も呼吸・耳・まばたきの位相は変わらない', () => {
  for (const character of characterKinds) {
    for (const risk of ['low', 'medium', 'high'] as const) {
      const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
        if (node.motion?.idle && !node.motion.reaction) {
          assert.deepEqual(groupFrame(node.motion, 1234, null, true), groupFrame(node.motion, 1234, 1200, true));
          assert.deepEqual(groupFrame(node.motion, 1400, 1350, true), sampleMotion(node.motion.idle, 1400, true));
        }
        inspect(node.children);
      });
      inspect(artwork[character][risk]);
    }
  }
});

test('highのslowカビもタップ反応は780ms、遅延なしで終了する', () => {
  for (const character of characterKinds) {
    const inspect = (nodes: ArtworkNode[]) => nodes.forEach((node) => {
      if (node.motion?.reaction) {
        assert.equal(node.motion.reaction.duration, 780);
        assert.equal(node.motion.reaction.delay, 0);
        assert.deepEqual(groupFrame(node.motion, 1000, 0, true), sampleMotion(node.motion.idle ?? restMotion, 1000, true));
      }
      inspect(node.children);
    });
    inspect(artwork[character].high);
  }
});

test('イージングは全体ではなく各キーフレームの間に適用する', () => {
  const motion = { ...restMotion, duration: 1000, easing: [.25, .1, .25, 1] as [number, number, number, number], frames: [
    { ...restMotion.frames[0], at: 0, x: 0 },
    { ...restMotion.frames[0], at: .5, x: 10 },
    { ...restMotion.frames[0], at: 1, x: 0 },
  ] };
  assert.equal(sampleMotion(motion, 500, false).x, 10);
  assert.ok(Math.abs(sampleMotion(motion, 250, false).x - 10*easeAt(.5, motion.easing)) < 1e-8);
  assert.ok(sampleMotion(motion, 250, false).x > 8);
  assert.equal(sampleMotion(motion, 1000, false).x, 0);
});

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
        for (const motion of [node.motion?.idle, node.motion?.reaction, ...(node.motion?.idleVariants ?? [])]) {
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
