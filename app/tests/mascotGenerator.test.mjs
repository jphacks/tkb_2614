import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { boundsOf, resolveOrigin } from '../scripts/mascot-geometry.mjs';
import { animationTiming, mergeAnimationStyle } from '../scripts/mascot-animation.mjs';

const node = (tag, props, children = []) => ({ tag, props, children });

test('animationの一括指定はidleのduration・delay・easingをリセットする', () => {
  const style = { animation: 'float 3.8s ease-in-out infinite', 'animation-duration': '5.1s', 'animation-delay': '-2.3s', 'animation-timing-function': 'linear' };
  mergeAnimationStyle(style, { animation: 'surprise 780ms ease-out 1 both' });
  assert.deepEqual(animationTiming(style), { duration: 780, delay: 0, easing: [0, 0, .58, 1] });
  mergeAnimationStyle(style, { 'animation-duration': '900ms' });
  assert.equal(animationTiming(style).duration, 900);
});

test('CSS既定のease、ease-in、cubic-bezierと負のdelayを維持する', () => {
  assert.deepEqual(animationTiming({ animation: 'blink 6.3s infinite' }).easing, [.25, .1, .25, 1]);
  assert.deepEqual(animationTiming({ animation: 'breath 2s ease-in' }).easing, [.42, 0, 1, 1]);
  assert.deepEqual(animationTiming({ animation: 'happy 720ms cubic-bezier(.2, .8, .2, 1) 1 both' }).easing, [.2, .8, .2, 1]);
  assert.deepEqual(animationTiming({ animation: 'float 3s linear -1.5s infinite' }), { duration: 3000, delay: -1500, easing: [0, 0, 1, 1] });
});

test('曲線の制御点ではなく実際の極値からfill-boxの原点を算出する', () => {
  const curve = node('path', { d: 'M0 0 C0 100 100 100 100 0 Z' });
  assert.deepEqual(boundsOf([curve]), { x: 0, y: 0, width: 100, height: 75 });
  assert.deepEqual(resolveOrigin('80% 90%', [curve]), [80, 67.5]);
  assert.deepEqual(resolveOrigin('center', [curve]), [50, 37.5]);
  assert.deepEqual(boundsOf([node('path', { d: 'M0 0 q50 100 100 0' })]), { x: 0, y: 0, width: 100, height: 50 });
});

test('楕円の大きさ・子グループの変換・形状変更を回転中心へ反映する', () => {
  const shapes = [node('g', { transform: 'translate(10 20) scale(2)' }, [node('ellipse', { cx: '0', cy: '0', rx: '5', ry: '10' })])];
  assert.deepEqual(boundsOf(shapes), { x: 0, y: 0, width: 20, height: 40 });
  assert.deepEqual(resolveOrigin('center', shapes), [10, 20]);
  shapes.push(node('circle', { cx: '50', cy: '20', r: '10' }));
  assert.deepEqual(resolveOrigin('center', shapes), [30, 20]);
  assert.throws(() => boundsOf([node('path', { d: 'M0 0 A10 10 0 0 1 20 20' })]), /Unsupported SVG path command/);
});

test('リポジトリルートからの再生成結果がコミット対象のデータと一致する', () => {
  const artwork = new URL('../src/ui/mascot/artwork.ts', import.meta.url);
  const before = readFileSync(artwork, 'utf8');
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/generate-mascots.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
  });
  assert.equal(readFileSync(artwork, 'utf8'), before);
});
