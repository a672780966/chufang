import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('DishAtlasIntegrity - Texture Atlas & Piece Slicing Integrity', () => {
  const DISH_IDS = [
    'dish_breakfast',
    'dish_salad',
    'dish_ramen',
    'dish_curry_rice',
    'dish_tomato_pasta',
    'dish_avocado_chicken_bowl',
    'dish_shrimp_fried_rice',
    'dish_grilled_steak'
  ];

  it('should verify atlas PNG and JSON files exist and have valid structure for all 8 dishes', () => {
    const assetsDir = path.join(rootDir, 'packages/web-greybox/public/assets/dishes');

    for (const dishId of DISH_IDS) {
      const atlasPngPath = path.join(assetsDir, `atlas_${dishId}.png`);
      const atlasJsonPath = path.join(assetsDir, `atlas_${dishId}.json`);

      assert.ok(fs.existsSync(atlasPngPath), `Atlas PNG must exist: ${atlasPngPath}`);
      const pngStat = fs.statSync(atlasPngPath);
      assert.ok(pngStat.size > 50000, `Atlas PNG ${dishId} should be > 50KB (actual: ${pngStat.size})`);

      assert.ok(fs.existsSync(atlasJsonPath), `Atlas JSON must exist: ${atlasJsonPath}`);
      const jsonContent = fs.readFileSync(atlasJsonPath, 'utf-8');
      const atlasData = JSON.parse(jsonContent);

      assert.strictEqual(atlasData.dishId, dishId);
      assert.strictEqual(atlasData.cols, 3);
      assert.strictEqual(atlasData.rows, 3);
      assert.ok(atlasData.pieceWidth > 0);
      assert.ok(atlasData.pieceHeight > 0);
      assert.ok(atlasData.padding > 0);
      assert.strictEqual(atlasData.pieces.length, 9, `Dish ${dishId} must have 9 pieces in atlas metadata`);

      // Verify each piece entry
      const slotSet = new Set<string>();
      for (const piece of atlasData.pieces) {
        assert.ok(piece.slotId);
        assert.ok(!slotSet.has(piece.slotId), `Duplicate slot ${piece.slotId} in ${dishId}`);
        slotSet.add(piece.slotId);

        assert.ok(piece.col >= 0 && piece.col < 3);
        assert.ok(piece.row >= 0 && piece.row < 3);

        const edges = piece.edges;
        assert.ok(edges, `Piece ${piece.slotId} must have edges`);
        if (piece.row === 2) assert.strictEqual(edges.top, 'flat');
        if (piece.row === 0) assert.strictEqual(edges.bottom, 'flat');
        if (piece.col === 0) assert.strictEqual(edges.left, 'flat');
        if (piece.col === 2) assert.strictEqual(edges.right, 'flat');

        const rect = piece.atlasRect;
        assert.ok(rect.width > 0);
        assert.ok(rect.height > 0);
        assert.ok(rect.x >= 0);
        assert.ok(rect.y >= 0);

        // Verify individual piece image file on disk
        const pieceFilePath = path.join(assetsDir, piece.imageFile);
        assert.ok(fs.existsSync(pieceFilePath), `Piece image file must exist: ${pieceFilePath}`);
        const pieceStat = fs.statSync(pieceFilePath);
        assert.ok(pieceStat.size > 10000, `Piece file ${piece.imageFile} must have content (>10KB)`);
      }
    }
  });
});
