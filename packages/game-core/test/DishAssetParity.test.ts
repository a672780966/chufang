import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('DishAssetParity - Web and Cocos 1:1 Asset Parity', () => {
  const ALL_8_DISH_IDS = [
    'dish_breakfast',
    'dish_salad',
    'dish_ramen',
    'dish_curry_rice',
    'dish_tomato_pasta',
    'dish_avocado_chicken_bowl',
    'dish_shrimp_fried_rice',
    'dish_grilled_steak'
  ];

  const webDir = path.join(rootDir, 'packages/web-greybox/public/assets/dishes');
  const cocosDir = path.join(rootDir, 'cocos-app/assets/textures/dishes');

  it('should verify exact byte-for-byte parity across all 96 master, atlas, and piece files', () => {
    let checkedCount = 0;

    for (const dishId of ALL_8_DISH_IDS) {
      // 1. Master image
      const masterFile = `${dishId}_master.jpg`;
      const webMaster = path.join(webDir, masterFile);
      const cocosMaster = path.join(cocosDir, masterFile);
      assert.ok(fs.existsSync(webMaster), `Web master missing: ${masterFile}`);
      assert.ok(fs.existsSync(cocosMaster), `Cocos master missing: ${masterFile}`);
      assert.strictEqual(
        fs.readFileSync(webMaster).compare(fs.readFileSync(cocosMaster)),
        0,
        `Byte mismatch for ${masterFile}`
      );
      checkedCount++;

      // 2. Atlas PNG
      const atlasPng = `atlas_${dishId}.png`;
      const webAtlasPng = path.join(webDir, atlasPng);
      const cocosAtlasPng = path.join(cocosDir, atlasPng);
      assert.ok(fs.existsSync(webAtlasPng), `Web atlas PNG missing: ${atlasPng}`);
      assert.ok(fs.existsSync(cocosAtlasPng), `Cocos atlas PNG missing: ${atlasPng}`);
      assert.strictEqual(
        fs.readFileSync(webAtlasPng).compare(fs.readFileSync(cocosAtlasPng)),
        0,
        `Byte mismatch for ${atlasPng}`
      );
      checkedCount++;

      // 3. Atlas JSON
      const atlasJson = `atlas_${dishId}.json`;
      const webAtlasJson = path.join(webDir, atlasJson);
      const cocosAtlasJson = path.join(cocosDir, atlasJson);
      assert.ok(fs.existsSync(webAtlasJson), `Web atlas JSON missing: ${atlasJson}`);
      assert.ok(fs.existsSync(cocosAtlasJson), `Cocos atlas JSON missing: ${atlasJson}`);
      assert.strictEqual(
        fs.readFileSync(webAtlasJson).compare(fs.readFileSync(cocosAtlasJson)),
        0,
        `Byte mismatch for ${atlasJson}`
      );
      checkedCount++;

      // 4. Nine pieces
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const pieceFile = `piece_${dishId}_slot_${c}_${r}.png`;
          const webPiece = path.join(webDir, pieceFile);
          const cocosPiece = path.join(cocosDir, pieceFile);
          assert.ok(fs.existsSync(webPiece), `Web piece missing: ${pieceFile}`);
          assert.ok(fs.existsSync(cocosPiece), `Cocos piece missing: ${pieceFile}`);
          assert.strictEqual(
            fs.readFileSync(webPiece).compare(fs.readFileSync(cocosPiece)),
            0,
            `Byte mismatch for ${pieceFile}`
          );
          checkedCount++;
        }
      }
    }

    assert.strictEqual(checkedCount, 96, 'Must verify exactly 96 dish asset files for full parity');
  });
});
