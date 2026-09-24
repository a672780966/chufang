import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function sha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function getTsFiles(dir: string, baseDir: string = dir): { relPath: string; fullPath: string }[] {
  let results: { relPath: string; fullPath: string }[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getTsFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.ts')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

describe('Single Source of Truth: Core Sync Verification', () => {
  const srcDir = path.resolve('packages/game-core/src');
  const destDir = path.resolve('cocos-app/assets/game-core');

  it('packages/game-core/src must exist and contain core files', () => {
    assert.strictEqual(fs.existsSync(srcDir), true);
    const files = getTsFiles(srcDir);
    assert.ok(files.length >= 10, 'Expected at least 10 core TS files in packages/game-core/src');
  });

  it('cocos-app/assets/game-core must exactly match packages/game-core/src byte-for-byte', () => {
    const srcFiles = getTsFiles(srcDir);
    const destFiles = getTsFiles(destDir);

    const srcMap = new Map(srcFiles.map(f => [f.relPath, sha256(f.fullPath)]));
    const destMap = new Map(destFiles.map(f => [f.relPath, sha256(f.fullPath)]));

    // 1. Check for missing or modified files in cocos-app
    for (const [relPath, srcHash] of srcMap.entries()) {
      assert.ok(
        destMap.has(relPath),
        `Missing file in cocos-app/assets/game-core: ${relPath}. Run "npm run sync:core" to fix.`
      );
      assert.strictEqual(
        destMap.get(relPath),
        srcHash,
        `File hash mismatch for ${relPath}. cocos-app/assets/game-core must mirror packages/game-core/src. Run "npm run sync:core" to fix.`
      );
    }

    // 2. Check for unexpected extraneous .ts files in cocos-app
    for (const [relPath] of destMap.entries()) {
      assert.ok(
        srcMap.has(relPath),
        `Extraneous file found in cocos-app/assets/game-core that does not exist in core: ${relPath}. Run "npm run sync:core" to clean up.`
      );
    }
  });
});
