// ウィジェット用の PNG を assets/widgets/ に書き出す。マスコットの SVG を変えたら `pnpm render:widget-images` で作り直す。
// ウィジェットは SVG を描けないので、assets/mascots の原本を PNG にしておき、アプリがウィジェットに渡す。
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

import { characterKinds } from '../src/ui/mascot/types';

const mascotDir = path.resolve(__dirname, '../assets/mascots');
const outDir = path.resolve(__dirname, '../assets/widgets');
// 小ウィジェットで 170pt 前後の幅に表示するので、3x でも粗くならない幅にする。
const CHARACTER_PX = 512;
const ICON_PX = 96;
const levels = ['low', 'medium', 'high'] as const;

// Material Symbols（Figma のウィジェットと同じ）。Android で tint するので黒で描く。
const icons = {
  humidity: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z',
  temperature:
    'M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2V5z',
  sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
};

function writePng(name: string, svg: string, width: number) {
  // CSS のアニメーションは無視され、待機動作の最初の姿勢で描かれる。
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(path.join(outDir, name), png);
  console.log(`${name} (${png.byteLength} bytes)`);
}

mkdirSync(outDir, { recursive: true });
// マスコットを減らしたときに古い画像が残らないよう、書き出す前に消す。
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.png')) rmSync(path.join(outDir, file));
}
for (const kind of characterKinds) {
  for (const level of levels) {
    writePng(`${kind}-${level}.png`, readFileSync(path.join(mascotDir, kind, `${level}.svg`), 'utf8'), CHARACTER_PX);
  }
}
for (const [name, d] of Object.entries(icons)) {
  writePng(`icon-${name}.png`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${d}" fill="#000"/></svg>`, ICON_PX);
}
