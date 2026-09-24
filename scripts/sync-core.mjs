import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const srcDir = path.resolve('packages/game-core/src');
const destDir = path.resolve('cocos-app/assets/game-core');

function getFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.ts')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

console.log('🔄 Synchronizing packages/game-core/src -> cocos-app/assets/game-core ...');

if (!fs.existsSync(srcDir)) {
  console.error(`❌ Source directory ${srcDir} does not exist!`);
  process.exit(1);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const srcFiles = getFiles(srcDir);
const destFiles = getFiles(destDir);

let copiedCount = 0;
let updatedCount = 0;

for (const { relPath, fullPath } of srcFiles) {
  const targetPath = path.join(destDir, relPath);
  const targetSubDir = path.dirname(targetPath);
  if (!fs.existsSync(targetSubDir)) {
    fs.mkdirSync(targetSubDir, { recursive: true });
  }

  const srcContent = fs.readFileSync(fullPath);
  if (fs.existsSync(targetPath)) {
    const destContent = fs.readFileSync(targetPath);
    if (!srcContent.equals(destContent)) {
      fs.writeFileSync(targetPath, srcContent);
      updatedCount++;
    }
  } else {
    fs.writeFileSync(targetPath, srcContent);
    copiedCount++;
  }
}

// Remove any orphan .ts files in dest that no longer exist in src
const srcRelSet = new Set(srcFiles.map(f => f.relPath));
let deletedCount = 0;
for (const { relPath, fullPath } of destFiles) {
  if (!srcRelSet.has(relPath)) {
    fs.unlinkSync(fullPath);
    const metaPath = fullPath + '.meta';
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    deletedCount++;
  }
}

console.log(`✅ Game Core Sync Complete: ${srcFiles.length} files tracked (${copiedCount} copied, ${updatedCount} updated, ${deletedCount} deleted).`);
