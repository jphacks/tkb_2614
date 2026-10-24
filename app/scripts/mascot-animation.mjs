const presets = {
  linear: [0, 0, 1, 1], ease: [.25, .1, .25, 1], 'ease-in': [.42, 0, 1, 1],
  'ease-out': [0, 0, .58, 1], 'ease-in-out': [.42, 0, .58, 1],
};
const milliseconds = (value) => {
  if (!/^[-+]?(?:\d*\.\d+|\d+)(?:ms|s)$/.test(value)) throw new Error(`Invalid animation time: ${value}`);
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
};

export function mergeAnimationStyle(target, declarations) {
  for (const [key, value] of Object.entries(declarations)) {
    if (key === 'animation') {
      for (const previous of Object.keys(target)) if (previous.startsWith('animation-')) delete target[previous];
    }
    target[key] = value;
  }
}

export function animationTiming(style) {
  const tokens = style.animation.match(/cubic-bezier\([^)]+\)|[^\s]+/g);
  const times = tokens.filter((token) => /^[-+]?(?:\d*\.\d+|\d+)(?:ms|s)$/.test(token));
  const timing = style['animation-timing-function'] ?? tokens.find((token) => token in presets || token.startsWith('cubic-bezier')) ?? 'ease';
  const easing = timing.startsWith('cubic-bezier') ? timing.match(/[-+]?(?:\d*\.\d+|\d+)/g).map(Number) : presets[timing];
  if (!easing || easing.length !== 4 || easing[0] < 0 || easing[0] > 1 || easing[2] < 0 || easing[2] > 1) throw new Error(`Unsupported easing: ${timing}`);
  return {
    duration: milliseconds(style['animation-duration'] ?? times[0] ?? '0s'),
    delay: milliseconds(style['animation-delay'] ?? times[1] ?? '0s'),
    easing,
  };
}
