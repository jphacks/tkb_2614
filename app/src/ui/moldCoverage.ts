/** VTTの段階に合わせて、カビが占める背景の面積を切り替える。 */
export function moldCoverage(index: number | null): number {
  if (index === null || !Number.isFinite(index) || index < 1) return 0;
  return index < 2 ? 0.1 : index < 3 ? 1 / 6 : 0.3;
}

/** 固定シードで位置・大きさ・向きを散らし、複数のコロニーの中心から広げる。 */
export function moldTiles(width: number, height: number, coverage: number) {
  if (width <= 0 || height <= 0 || coverage <= 0) return [];
  let seed = 2614;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  // 上側をやや多めにしつつ、左右・下側にも群生地を分散させる。
  const colonies = [
    [0.08, 0.12, 0.95], [0.48, 0.06, 0.75], [0.8, 0.2, 0.9],
    [0.96, 0.46, 0.9], [0.12, 0.46, 0.85],
    [0.79, 0.84, 1.05], [0.19, 0.9, 1.05],
  ];
  const unit = Math.min(width, height) / 9;
  const count = Math.round(width * height / (unit * unit));
  const tiles: { id: number; x: number; y: number; size: number; rotation: number; order: number }[] = [];
  for (let attempt = 0; attempt < count * 40 && tiles.length < count; attempt++) {
    const x = random() * width;
    const y = random() * height;
    // 最低限の間隔だけ保ち、行・列には揃えない。
    if (tiles.some((tile) => (tile.x - x) ** 2 + (tile.y - y) ** 2 < (unit * 0.68) ** 2)) continue;
    const distance = Math.min(...colonies.map(([cx, cy, spread]) =>
      Math.hypot((x / width - cx) / 0.27, (y / height - cy) / 0.2) / spread));
    tiles.push({
      id: tiles.length, x, y,
      size: unit * (1.15 + random() * 0.65),
      rotation: (random() - 0.5) * 90,
      order: distance + y / height * 0.04 + random() * 0.18,
    });
  }
  return tiles.sort((a, b) => a.order - b.order || a.id - b.id)
    .slice(0, Math.round(tiles.length * Math.min(coverage, 1)));
}
