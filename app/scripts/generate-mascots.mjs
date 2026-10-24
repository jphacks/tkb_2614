// Compile the bundled SVG artwork and CSS keyframes for react-native-svg.
// Run with: node scripts/generate-mascots.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const characters = ['mimi', 'antenna', 'fin', 'mushroom', 'cloudtail'];
const levels = ['low', 'medium', 'high'];
const output = {};
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const classes = (selector) => [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
const milliseconds = (value) => parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);

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
    const svg = readFileSync(resolve('assets/mascots', character, `${level}.svg`), 'utf8');
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
        if (classes(parts[1]).every((c) => nodeClasses.includes(c))) Object.assign(result, props);
      }
      return result;
    }
    function animation(style) {
      if (!style.animation) return undefined;
      const [name, duration] = style.animation.split(/\s+/);
      if (!keyframes[name]?.length) throw new Error(`Missing keyframes: ${name}`);
      return { frames: keyframes[name], duration: milliseconds(style['animation-duration'] ?? duration), delay: milliseconds(style['animation-delay'] ?? '0s'), easing: style.animation.includes('ease-out') ? 'out' : style.animation.includes('ease-in-out') || style.animation.includes('cubic-bezier') ? 'inOut' : 'linear' };
    }
    const root = { tag: 'g', props: {}, children: [] };
    const stack = [root];
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
      const idleStyle = styleFor(nodeClasses, false);
      const tapStyle = styleFor(nodeClasses, true);
      const idle = animation(idleStyle);
      const reaction = tapStyle.animation !== idleStyle.animation ? animation(tapStyle) : undefined;
      if (idle || reaction) {
        const origin = idleStyle['transform-origin'] ?? '0px 0px';
        let pivot = origin.split(' ').map(parseFloat);
        if (origin === 'center') {
          // Blink groups contain ellipses; resolve their center after parsing below.
          pivot = [160, 200];
        } else if (origin.includes('%')) {
          // Ear hinges, in SVG coordinates (the source uses fill-box percentages).
          pivot = [nodeClasses.includes('ear-left') ? 125 : 195, level === 'low' ? 135 : level === 'medium' ? 180 : 215];
        }
        node.motion = { origin: pivot, ...(idle && { idle }), ...(reaction && { reaction }) };
      }
      stack.at(-1).children.push(node);
      if (!token.endsWith('/>')) stack.push(node);
    }
    function fixBlink(node) {
      if (node.motion && node.children.length && node.children.every((child) => child.tag === 'ellipse')) {
        node.motion.origin = [node.children.reduce((sum, child) => sum + Number(child.props.cx), 0) / node.children.length, Number(node.children[0].props.cy)];
      }
      node.children.forEach(fixBlink);
    }
    fixBlink(root);
    output[character][level] = root.children;
  }
}
writeFileSync(resolve('src/ui/mascot/artwork.ts'), `// Generated by scripts/generate-mascots.mjs. Edit assets/mascots instead.\nimport type { Artwork } from './types';\n\nexport const artwork: Artwork = ${JSON.stringify(output, null, 2)};\n`);
