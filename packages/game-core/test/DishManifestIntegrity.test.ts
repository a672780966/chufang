import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DISH_MANIFEST, GOLD_SAMPLE_DISH_MANIFEST } from '../src/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('DishManifestIntegrity - 8 Dish Manifest & Hash Verification', () => {
  const EXPECTED_DISH_IDS = [
    'dish_breakfast',
    'dish_salad',
    'dish_ramen',
    'dish_curry_rice',
    'dish_tomato_pasta',
    'dish_avocado_chicken_bowl',
    'dish_shrimp_fried_rice',
    'dish_grilled_steak'
  ];

  it('should register exactly 8 dishes in DISH_MANIFEST with valid specifications', () => {
    const keys = Object.keys(DISH_MANIFEST);
    assert.strictEqual(keys.length, 8, 'DISH_MANIFEST must contain 8 dishes');

    for (const dishId of EXPECTED_DISH_IDS) {
      const entry = DISH_MANIFEST[dishId];
      assert.ok(entry, `Entry ${dishId} must exist`);
      assert.strictEqual(entry.dishId, dishId);
      assert.ok(entry.name && entry.name.length > 0);
      assert.ok(entry.generationPrompt && entry.generationPrompt.length > 50, 'Prompt must be comprehensive');
      assert.ok(entry.constraints && entry.constraints.length >= 4, 'Must list production constraints');
      assert.strictEqual(entry.puzzleRowsCols.rows, 3);
      assert.strictEqual(entry.puzzleRowsCols.cols, 3);
      assert.strictEqual(entry.totalPieces, 9);
      assert.ok(entry.orderRevenue > 0);
      assert.strictEqual(entry.approvedHash.length, 64, 'SHA256 must be 64 characters hex');
      assert.ok(/^[0-9A-F]{64}$/.test(entry.approvedHash), 'SHA256 must be uppercase hex');
      assert.ok(entry.masterAsset.endsWith('.jpg'));
      assert.ok(entry.atlasAsset.endsWith('.png'));
      assert.ok(entry.pieceAssetPrefix.includes(dishId));
    }
  });

  it('should byte-verify that approvedHash matches real master file SHA256 on disk', () => {
    for (const dishId of EXPECTED_DISH_IDS) {
      const entry = DISH_MANIFEST[dishId];
      const masterRel = entry.masterAsset.replace(/^\//, '');
      const filePath = path.join(rootDir, 'packages/web-greybox/public', masterRel);

      assert.ok(fs.existsSync(filePath), `Master image file must exist: ${filePath}`);
      const buffer = fs.readFileSync(filePath);
      const computedHash = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();

      assert.strictEqual(
        computedHash,
        entry.approvedHash,
        `Approved hash mismatch for ${dishId}. Expected: ${entry.approvedHash}, Computed: ${computedHash}`
      );
    }
  });

  it('should maintain backward-compatible GOLD_SAMPLE_DISH_MANIFEST with 3 dishes', () => {
    const goldKeys = Object.keys(GOLD_SAMPLE_DISH_MANIFEST);
    assert.strictEqual(goldKeys.length, 3, 'GOLD_SAMPLE_DISH_MANIFEST must have 3 dishes');
    assert.ok(goldKeys.includes('dish_breakfast'));
    assert.ok(goldKeys.includes('dish_salad'));
    assert.ok(goldKeys.includes('dish_ramen'));
  });
});
