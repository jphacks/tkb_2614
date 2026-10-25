// Compile the action SVGs (assets/actions) and their CSS keyframes for react-native-svg.
// Run with: node scripts/generate-actions.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveOrigin } from './mascot-geometry.mjs';
import { animationTiming, mergeAnimationStyle } from './mascot-animation.mjs';

const names = ['window-open', 'window-open-brief', 'window-close-rain', 'window-close-wind', 'window-close-pollen', 'aircon-dry'];
const output = {};
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const classes = (selector) => [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
const declarations = (body) => Object.fromEntries(body.split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
  const at = item.indexOf(':');
  return [item.slice(0, at).trim(), item.slice(at + 1).trim()];
}));

function transformValues(transform) {
  const values = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  for (const [, fn, args] of transform.matchAll(/(\w+)\(([^)]+)\)/g)) {
    const [a, b] = args.split(/[,\s]+/).map(parseFloat);
    if (fn === 'translate') { values.x = a; values.y = b ?? 0; }
    else if (fn === 'translateX') values.x = a;
    else if (fn === 'translateY') values.y = a;
    else if (fn === 'rotate') values.rotation = a;
    else if (fn === 'scale') { values.scaleX = a; values.scaleY = b ?? a; }
    else throw new Error(`Unsupported transform: ${fn}`);
  }
  return values;
}

/**
 * CSS と同じく、プロパティごとに、それを指定したキーフレームだけで区間を作る（20%{opacity:.88} は transform の区間に入らない）。
 * 0% や 100% で指定しないプロパティは、要素の元の値（変形なし・不透明度 1）から始まり、そこへ戻る。
 */
function keyframes(body) {
  const transform = [], opacity = [];
  for (const [, stops, block] of body.matchAll(/([\d%,.\s]+)\{([^}]*)\}/g)) {
    const style = declarations(block);
    for (const key of Object.keys(style)) if (key !== 'transform' && key !== 'opacity') throw new Error(`Unsupported keyframe property: ${key}`);
    for (const stop of stops.split(',')) {
      const at = parseFloat(stop) / 100;
      if (style.transform) transform.push({ at, ...transformValues(style.transform) });
      if (style.opacity) opacity.push({ at, value: parseFloat(style.opacity) });
    }
  }
  const complete = (frames, rest) => {
    frames.sort((a, b) => a.at - b.at);
    if (frames.length === 0) return [];
    if (frames[0].at > 0) frames.unshift({ ...rest, at: 0 });
    if (frames.at(-1).at < 1) frames.push({ ...rest, at: 1 });
    return frames;
  };
  return {
    frames: complete(transform, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }),
    opacity: complete(opacity, { value: 1 }),
  };
}

for (const name of names) {
  const svg = readFileSync(new URL(`../assets/actions/${name}.svg`, import.meta.url), 'utf8');
  const css = svg.match(/<style>([\s\S]*?)<\/style>/)[1];
  const animations = {};
  const rulesText = css.replace(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g, (_, keyframesName, body) => {
    animations[keyframesName] = keyframes(body);
    return '';
  // 視差効果を減らす設定には、アプリ側で時計を止めて対応する。
  }).replace(/@media[^{]*\{[^{}]*\{[^{}]*\}\s*\}/g, '');
  const rules = [...rulesText.matchAll(/([^{}]+)\{([^{}]+)\}/g)].flatMap(([, selectors, body]) => selectors.split(',').map((selector) => ({
    selector: selector.trim(),
    props: declarations(body),
  })));
  const root = attrs(svg.match(/<svg\s+([^>]+)/)[1]);
  const rootClasses = root.class.split(/\s+/);
  function styleFor(nodeClasses) {
    const result = {};
    for (const { selector, props } of rules) {
      const parts = selector.split(/\s+/);
      if (parts.length !== 2) throw new Error(`Unsupported selector: ${selector}`);
      if (!classes(parts[0]).every((c) => rootClasses.includes(c))) continue;
      if (classes(parts[1]).every((c) => nodeClasses.includes(c))) mergeAnimationStyle(result, props);
    }
    return result;
  }
  // ルートの fill="none" を引き継ぐ。react-native-svg は fill を書かない図形を黒で塗る。
  const top = { tag: 'g', props: { fill: root.fill ?? 'black' }, children: [] };
  const stack = [top];
  const origins = new Map();
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<\/?svg[^>]*>/g, '');
  for (const [token, closing, tag, raw] of body.matchAll(/<(\/)?([\w]+)([^>]*?)\/?\s*>/g)) {
    if (closing) { stack.pop(); continue; }
    if (!['g', 'path', 'circle'].includes(tag)) throw new Error(`Unsupported SVG tag: ${tag}`);
    const original = attrs(raw);
    const node = { tag, props: {}, children: [] };
    for (const [key, value] of Object.entries(original)) {
      if (key === 'class') continue;
      node.props[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    const style = styleFor((original.class ?? '').split(/\s+/));
    if (style.animation) {
      // ActionAnimation は動く要素を <G> で描くので、path や circle に付けると d などが G に付いて描かれない。
      if (tag !== 'g') throw new Error(`Animation must be on <g>: ${tag}.${original.class}`);
      const [animationName] = style.animation.split(/\s+/);
      if (!animations[animationName]) throw new Error(`Missing keyframes: ${animationName}`);
      const origin = style['transform-origin'] ?? '0px 0px';
      if ((origin.includes('%') || origin === 'center') && style['transform-box'] !== 'fill-box') throw new Error(`Relative origin requires fill-box: ${origin}`);
      origins.set(node, origin);
      node.motion = { origin: [], ...animationTiming(style), ...animations[animationName] };
    } else if (style.transform) {
      // 動かない変形（少しだけ開けた窓の位置など）。
      const { x, y, rotation, scaleX, scaleY } = transformValues(style.transform);
      if (rotation !== 0 || scaleX !== 1 || scaleY !== 1) throw new Error(`Unsupported static transform: ${style.transform}`);
      node.props.transform = `translate(${x} ${y})`;
    }
    stack.at(-1).children.push(node);
    if (!token.endsWith('/>')) stack.push(node);
  }
  for (const [node, origin] of origins) node.motion.origin = resolveOrigin(origin, node.children);
  // aria-label は使わない。読み上げは ventilationMessage のひとことで行う。
  output[name] = { viewBox: root.viewBox, nodes: [top] };
}
writeFileSync(new URL('../src/ui/action/artwork.ts', import.meta.url), `// Generated by scripts/generate-actions.mjs. Edit assets/actions instead.\nimport type { ActionArtwork } from './types';\n\nexport const artwork: ActionArtwork = ${JSON.stringify(output, null, 2)};\n`);
