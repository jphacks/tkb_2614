import assert from 'node:assert/strict';
import { test } from 'node:test';

import { companions } from '../src/ui/mascot/companions';
import { characterKinds } from '../src/ui/mascot/types';
import { moldCoverage, moldTiles } from '../src/ui/moldCoverage';

test('VTTの境界で低・中の2段階・高の面積に切り替わる', () => {
  for (const value of [null, NaN, Infinity, -1, 0, 0.999]) assert.equal(moldCoverage(value), 0);
  assert.equal(moldCoverage(1), 0.1);
  assert.equal(moldCoverage(1.999), 0.1);
  assert.equal(moldCoverage(2), 1 / 6);
  assert.equal(moldCoverage(2.999), 1 / 6);
  assert.equal(moldCoverage(3), 0.3);
  assert.equal(moldCoverage(6), 0.3);
});

test('画面の縦横が変わっても面積比を保ち、成長時は既存のカビを残す', () => {
  for (const [width, height] of [[390, 844], [844, 390], [320, 568]]) {
    assert.deepEqual(moldTiles(width, height, 0), []);
    const full = moldTiles(width, height, 1);
    let previous: ReturnType<typeof moldTiles> = [];
    for (const coverage of [0.1, 1 / 6, 0.3]) {
      const tiles = moldTiles(width, height, coverage);
      assert.ok(Math.abs(tiles.length / full.length - coverage) <= 1 / full.length);
      assert.deepEqual(tiles.slice(0, previous.length), previous);
      previous = tiles;
    }
  }
});

test('コロニーの配置は固定で、行・列に整列せず大きさもばらつく', () => {
  const tiles = moldTiles(390, 844, moldCoverage(3));
  assert.deepEqual(moldTiles(390, 844, moldCoverage(3)), tiles);
  assert.equal(new Set(tiles.map((tile) => tile.x)).size, tiles.length);
  assert.equal(new Set(tiles.map((tile) => tile.y)).size, tiles.length);
  assert.ok(Math.max(...tiles.map((tile) => tile.size)) / Math.min(...tiles.map((tile) => tile.size)) > 1.4);
});

test('各段階で上側に偏りすぎず、左右と下側にも分散する', () => {
  for (const [width, height] of [[390, 844], [844, 390], [320, 568]]) {
    for (const index of [1, 2, 3]) {
      const tiles = moldTiles(width, height, moldCoverage(index));
      const upperRatio = tiles.filter((tile) => tile.y < height / 2).length / tiles.length;
      assert.ok(upperRatio >= 0.4 && upperRatio <= 0.8);
      assert.ok(tiles.some((tile) => tile.y > height * 0.75));
      assert.ok(tiles.some((tile) => tile.x < width / 2));
      assert.ok(tiles.some((tile) => tile.x > width / 2));
    }
  }
});

test('すべてのマスコットに原本から取り出したカビの形と顔がある', () => {
  for (const character of characterKinds) {
    assert.ok(companions[character].some((node) => node.tag === 'path'));
    assert.equal(companions[character].filter((node) => node.tag === 'circle').length, 2);
  }
});
