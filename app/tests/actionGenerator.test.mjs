import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('アクションの絵の再生成結果がコミット対象のデータと一致する', () => {
  const artwork = new URL('../src/ui/action/artwork.ts', import.meta.url);
  const before = readFileSync(artwork, 'utf8');
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/generate-actions.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
  });
  assert.equal(readFileSync(artwork, 'utf8'), before);
});
