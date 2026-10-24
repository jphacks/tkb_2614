// Geometry used only while compiling SVGs. Unsupported commands fail loudly.
const identity = [1, 0, 0, 1, 0, 0];
const numbers = (text) => (text.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
const point = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function transform(text = '') {
  let matrix = identity;
  for (const [, name, args] of text.matchAll(/(\w+)\(([^)]+)\)/g)) {
    const [a, b, c, d, e, f] = numbers(args);
    let next;
    if (name === 'translate') next = [1, 0, 0, 1, a, b ?? 0];
    else if (name === 'scale') next = [a, 0, 0, b ?? a, 0, 0];
    else if (name === 'matrix') next = [a, b, c, d, e, f];
    else if (name === 'rotate') {
      const angle = a * Math.PI / 180;
      const rotation = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
      next = multiply(multiply([1, 0, 0, 1, b ?? 0, c ?? 0], rotation), [1, 0, 0, 1, -(b ?? 0), -(c ?? 0)]);
    } else throw new Error(`Unsupported bounds transform: ${name}`);
    matrix = multiply(matrix, next);
  }
  return matrix;
}

export function boundsOf(nodes) {
  const points = [];
  function curve(control, matrix) {
    const p = control.map((value) => point(matrix, value));
    const times = new Set([0, 1]);
    for (const axis of [0, 1]) {
      const v = p.map((value) => value[axis]);
      if (v.length === 3) {
        const denominator = v[0] - 2*v[1] + v[2];
        if (denominator) times.add((v[0] - v[1]) / denominator);
      } else {
        const a = -v[0] + 3*v[1] - 3*v[2] + v[3];
        const b = 2*(v[0] - 2*v[1] + v[2]);
        const c = v[1] - v[0];
        if (Math.abs(a) < 1e-12) { if (b) times.add(-c / b); }
        else if (b*b - 4*a*c >= 0) {
          const root = Math.sqrt(b*b - 4*a*c);
          times.add((-b + root) / (2*a)); times.add((-b - root) / (2*a));
        }
      }
    }
    for (const t of times) {
      if (t < 0 || t > 1) continue;
      let work = p;
      while (work.length > 1) work = work.slice(1).map((value, i) => value.map((v, axis) => work[i][axis]*(1-t) + v*t));
      points.push(work[0]);
    }
  }
  function path(data, matrix) {
    const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g) ?? [];
    let index = 0, command, cursor = [0, 0], start = cursor;
    const read = () => {
      const value = Number(tokens[index++]);
      if (!Number.isFinite(value)) throw new Error(`Invalid SVG path: ${data}`);
      return value;
    };
    while (index < tokens.length) {
      if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
      const relative = command === command.toLowerCase();
      const end = () => { const p = [read(), read()]; return relative ? p.map((v, axis) => v + cursor[axis]) : p; };
      switch (command.toUpperCase()) {
        case 'M': cursor = end(); start = cursor; points.push(point(matrix, cursor)); command = relative ? 'l' : 'L'; break;
        case 'L': cursor = end(); points.push(point(matrix, cursor)); break;
        case 'H': cursor = [read() + (relative ? cursor[0] : 0), cursor[1]]; points.push(point(matrix, cursor)); break;
        case 'V': cursor = [cursor[0], read() + (relative ? cursor[1] : 0)]; points.push(point(matrix, cursor)); break;
        case 'Q': { const control = end(), target = end(); curve([cursor, control, target], matrix); cursor = target; break; }
        case 'C': { const a = end(), b = end(), target = end(); curve([cursor, a, b, target], matrix); cursor = target; break; }
        case 'Z': cursor = start; command = undefined; break;
        default: throw new Error(`Unsupported SVG path command for bounds: ${command}`);
      }
    }
  }
  function visit(node, parent) {
    const matrix = multiply(parent, transform(node.props.transform));
    if (node.tag === 'path') path(node.props.d, matrix);
    else if (node.tag === 'ellipse' || node.tag === 'circle') {
      const center = point(matrix, [Number(node.props.cx ?? 0), Number(node.props.cy ?? 0)]);
      const rx = Number(node.props.rx ?? node.props.r), ry = Number(node.props.ry ?? node.props.r);
      const dx = Math.hypot(matrix[0]*rx, matrix[2]*ry), dy = Math.hypot(matrix[1]*rx, matrix[3]*ry);
      points.push([center[0]-dx, center[1]-dy], [center[0]+dx, center[1]+dy]);
    } else if (node.tag !== 'g') throw new Error(`Unsupported bounds element: ${node.tag}`);
    node.children.forEach((child) => visit(child, matrix));
  }
  nodes.forEach((node) => visit(node, identity));
  if (!points.length || !points.flat().every(Number.isFinite)) throw new Error('Cannot compute SVG fill bounds');
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys) };
}

export function resolveOrigin(origin, children) {
  const parts = origin === 'center' ? ['50%', '50%'] : origin.trim().split(/\s+/);
  if (parts.length !== 2) throw new Error(`Unsupported transform-origin: ${origin}`);
  const bounds = parts.some((part) => part.endsWith('%')) ? boundsOf(children) : null;
  return parts.map((part, axis) => {
    if (!/^[-+]?[\d.]+(?:px|%)?$/.test(part)) throw new Error(`Unsupported origin coordinate: ${part}`);
    return part.endsWith('%') ? (axis ? bounds.y : bounds.x) + parseFloat(part)/100 * (axis ? bounds.height : bounds.width) : parseFloat(part);
  });
}
