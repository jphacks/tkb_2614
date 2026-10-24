import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boundsOf } from '../scripts/mascot-geometry.mjs';
import { artwork } from '../src/ui/mascot/artwork.ts';
import { mascotViewport } from '../src/ui/mascot/viewport.ts';

const identity = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

function union(boxes) {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return {
    x, y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
  };
}

function transformBox(box, transform) {
  const { x, y, width, height } = box;
  return boundsOf([{ tag: 'g', props: { transform }, children: [{
    tag: 'path', props: { d: `M${x} ${y}h${width}v${height}h${-width}Z` }, children: [],
  }] }]);
}

// Envelope each group independently: this also covers tapping at any idle phase,
// any random gesture choice, and ears/mold moving on independent clocks.
function envelope(node) {
  if (node.tag !== 'g') {
    const box = boundsOf([node]);
    const stroke = Number(node.props.strokeWidth ?? (node.props.stroke ? 1 : 0));
    const padding = stroke * 2; // Include the default miter limit.
    return { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
  }
  let box = union(node.children.map(envelope));
  if (node.motion) {
    const { origin: [ox, oy], idle, reaction, idleVariants = [] } = node.motion;
    const poses = [identity];
    for (const motion of [idle, reaction, ...idleVariants].filter(Boolean)) {
      for (let i = 1; i < motion.frames.length; i++) {
        const start = motion.frames[i - 1], end = motion.frames[i];
        // Easing changes speed, but the transforms interpolate along this same path.
        for (let step = 0; step <= 32; step++) {
          poses.push(Object.fromEntries(Object.keys(identity).map((key) => [key, start[key] + (end[key] - start[key]) * step / 32])));
        }
      }
    }
    box = union(poses.map((pose) => transformBox(box,
      `translate(${ox + pose.x} ${oy + pose.y}) rotate(${pose.rotation}) scale(${pose.scaleX} ${pose.scaleY}) translate(${-ox} ${-oy})`)));
  }
  return transformBox(box, node.props.transform ?? '');
}

test('全マスコットの待機・タップ・部位動作の組み合わせがSVG表示領域に収まる', () => {
  const view = mascotViewport;
  for (const [character, levels] of Object.entries(artwork)) {
    for (const [level, nodes] of Object.entries(levels)) {
      const box = union(nodes.map(envelope));
      const message = `${character}/${level}: ${JSON.stringify(box)}`;
      // Keep additional margin for interpolation sampling and antialiasing.
      assert.ok(box.x >= view.x + 4, message);
      assert.ok(box.y >= view.y + 4, message);
      assert.ok(box.x + box.width <= view.x + view.width - 4, message);
      assert.ok(box.y + box.height <= view.y + view.height - 4, message);
    }
  }
});
