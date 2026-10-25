// Compile the bundled SVG artwork and CSS keyframes for react-native-svg.
// Run with: node scripts/generate-mascots.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveOrigin } from './mascot-geometry.mjs';
import { animationTiming, mergeAnimationStyle } from './mascot-animation.mjs';

const characters = ['mimi', 'antenna', 'fin', 'mushroom', 'cloudtail'];
const levels = ['low', 'medium', 'high'];
const output = {};
const companions = {};
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const classes = (selector) => [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);

function frames(body) {
  const points = [];
  for (const [, stops, transform] of body.matchAll(/([\d%,.\s]+)\{transform:([^}]+)\}/g)) {
    const values = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    for (const [, fn, args] of transform.matchAll(/(\w+)\(([^)]+)\)/g)) {
      const [a, b] = args.split(/[,\s]+/).map(parseFloat);
      if (fn === 'translate') { values.x = a; values.y = b ?? 0; }
      else if (fn === 'translateX') values.x = a;
      else if (fn === 'translateY') values.y = a;
      else if (fn === 'rotate') values.rotation = a;
      else if (fn === 'scale') { values.scaleX = a; values.scaleY = b ?? a; }
      else if (fn === 'scaleX') values.scaleX = a;
      else if (fn === 'scaleY') values.scaleY = a;
      else throw new Error(`Unsupported transform: ${fn}`);
    }
    for (const stop of stops.split(',')) points.push({ at: parseFloat(stop) / 100, ...values });
  }
  return points.sort((a, b) => a.at - b.at);
}

for (const character of characters) {
  output[character] = {};
  for (const level of levels) {
    const svg = readFileSync(new URL(`../assets/mascots/${character}/${level}.svg`, import.meta.url), 'utf8');
    const css = svg.match(/<style><!\[CDATA\[([\s\S]*?)\]\]><\/style>/)[1];
    const keyframes = {};
    const rulesText = css.replace(/@keyframes\s+([\w-]+)\{((?:[^{}]*\{[^{}]*\})+)\}/g, (_, name, body) => {
      keyframes[name] = frames(body);
      return '';
    }).replace(/@media[\s\S]*?\}\}/g, '');
    const rules = [...rulesText.matchAll(/([^{}]+)\{([^{}]+)\}/g)].flatMap(([, selectors, body]) => selectors.split(',').map((selector) => ({
      selector: selector.trim(),
      props: Object.fromEntries(body.split(';').filter(Boolean).map((item) => item.split(':').map((part) => part.trim()))),
    })));
    const rootClasses = classes('.' + attrs(svg.match(/<svg\s+([^>]+)/)[1]).class.replaceAll(' ', '.'));
    function styleFor(nodeClasses, tapped) {
      const result = {};
      for (const { selector, props } of rules) {
        const parts = selector.split(/\s+/);
        if (parts.length !== 2) continue;
        const requiredRoot = classes(parts[0]);
        if (requiredRoot.some((c) => c === 'is-tapped' ? !tapped : !rootClasses.includes(c))) continue;
        if (classes(parts[1]).every((c) => nodeClasses.includes(c))) {
          mergeAnimationStyle(result, props);
        }
      }
      return result;
    }
    function animation(style) {
      if (!style.animation) return undefined;
      const [name] = style.animation.split(/\s+/);
      if (!keyframes[name]?.length) throw new Error(`Missing keyframes: ${name}`);
      return { frames: keyframes[name], ...animationTiming(style) };
    }
    const root = { tag: 'g', props: {}, children: [] };
    const stack = [root];
    const origins = new Map();
    const body = svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<title[^>]*>[\s\S]*?<\/title>/, '').replace(/<\/?svg[^>]*>/g, '');
    for (const [token, closing, tag, raw] of body.matchAll(/<(\/)?([\w]+)([^>]*?)\/?\s*>/g)) {
      if (closing) { stack.pop(); continue; }
      if (!['g', 'path', 'ellipse', 'circle'].includes(tag)) throw new Error(`Unsupported SVG tag: ${tag}`);
      const original = attrs(raw);
      const node = { tag, props: {}, children: [] };
      for (const [key, value] of Object.entries(original)) {
        if (key === 'class') continue;
        node.props[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      }
      const nodeClasses = (original.class ?? '').split(/\s+/);
      if (level === 'medium' && nodeClasses.includes('mold-float')) companions[character] = node.children;
      const idleStyle = styleFor(nodeClasses, false);
      const tapStyle = styleFor(nodeClasses, true);
      const idle = animation(idleStyle);
      const reaction = tapStyle.animation !== idleStyle.animation ? animation(tapStyle) : undefined;
      if (idle || reaction) {
        const origin = idleStyle['transform-origin'] ?? '0px 0px';
        if ((origin.includes('%') || origin === 'center') && idleStyle['transform-box'] !== 'fill-box') throw new Error(`Relative origin requires fill-box: ${origin}`);
        origins.set(node, origin);
        node.motion = { origin: [], ...(idle && { idle }), ...(reaction && { reaction }) };
        // Body gestures share timing and a rest interval, allowing seamless random choices.
        if (idle && nodeClasses.includes('breath')) {
          const variants = Object.entries(keyframes).filter(([name]) => name.startsWith(`${character}-idle-`));
          if (variants.length) node.motion.idleVariants = variants.map(([, frames]) => ({ ...idle, frames }));
        }
      }
      stack.at(-1).children.push(node);
      if (!token.endsWith('/>')) stack.push(node);
    }
    for (const [node, origin] of origins) node.motion.origin = resolveOrigin(origin, node.children);
    output[character][level] = root.children;
  }
}
writeFileSync(new URL('../src/ui/mascot/artwork.ts', import.meta.url), `// Generated by scripts/generate-mascots.mjs. Edit assets/mascots instead.\nimport type { Artwork } from './types';\n\nexport const artwork: Artwork = ${JSON.stringify(output, null, 2)};\n`);
writeFileSync(new URL('../src/ui/mascot/companions.ts', import.meta.url), `// Generated by scripts/generate-mascots.mjs. Edit assets/mascots instead.\nimport type { ArtworkNode, CharacterKind } from './types';\n\nexport const companions: Record<CharacterKind, ArtworkNode[]> = ${JSON.stringify(companions, null, 2)};\n`);
