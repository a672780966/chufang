import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleGeometry } from '../src/pipeline/PuzzleGeometry';
import { IngredientMasterGraphics } from '../src/pipeline/IngredientMasterGraphics';
import { PuzzleCutter } from '../src/pipeline/PuzzleCutter';
import { AssetRegistry } from '../src/pipeline/AssetRegistry';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../src/data/DefaultData';

describe('Stage 3 Procedural Puzzle Pipeline & Asset Registry', () => {
  it('should generate valid Bezier curve commands for jigsaw edges', () => {
    const flatCmds = PuzzleGeometry.generateEdgeCommands(0, 0, 100, 0, 'flat');
    assert.strictEqual(flatCmds.length, 1);
    assert.strictEqual(flatCmds[0].type, 'L');
    assert.strictEqual(flatCmds[0].x, 100);

    const tabCmds = PuzzleGeometry.generateEdgeCommands(0, 0, 100, 0, 'tab');
    assert.ok(tabCmds.length >= 4, 'Tab edge must contain multiple curve commands');
    assert.ok(tabCmds.some(c => c.type === 'C'), 'Tab edge must contain cubic Bezier curves');

    const blankCmds = PuzzleGeometry.generateEdgeCommands(0, 0, 100, 0, 'blank');
    assert.ok(blankCmds.length >= 4, 'Blank edge must contain multiple curve commands');
    assert.ok(blankCmds.some(c => c.type === 'C'), 'Blank edge must contain cubic Bezier curves');

    // Slot path generation
    const slotCmds = PuzzleGeometry.generateSlotPathCommands(
      { x: 0, y: 0, width: 100, height: 100 },
      { top: 'flat', right: 'tab', bottom: 'blank', left: 'flat' }
    );
    assert.strictEqual(slotCmds[0].type, 'M');
    assert.strictEqual(slotCmds[slotCmds.length - 1].type, 'Z');

    const pathD = PuzzleGeometry.commandsToSvgPath(slotCmds);
    assert.ok(pathD.startsWith('M 0.00 0.00'));
    assert.ok(pathD.endsWith('Z'));
  });

  it('should provide complete 1024x1024 master illustrations for all 16 ingredients', () => {
    const ingredientIds = Object.keys(DEFAULT_INGREDIENTS);
    assert.strictEqual(ingredientIds.length, 16, 'Must have 16 official ingredients');

    for (const id of ingredientIds) {
      const svg = IngredientMasterGraphics.getMasterSvg(id);
      assert.ok(svg.includes('viewBox="0 0 1024 1024"'), `${id} master SVG must be 1024x1024`);
      assert.ok(svg.includes('<defs>'), `${id} SVG must include definitions/gradients`);
      assert.ok(svg.length > 500, `${id} master SVG must have rich illustration content`);
    }
  });

  it('should procedurally cut authentic loose pieces and targets for all 16 ingredients', () => {
    for (const [id, def] of Object.entries(DEFAULT_INGREDIENTS)) {
      for (const slot of def.slots) {
        const pieceAsset = PuzzleCutter.generateLoosePieceAsset(def, slot.slotId, 120);
        assert.strictEqual(pieceAsset.slotId, slot.slotId);
        assert.ok(pieceAsset.svgContent.includes('<svg'), `Piece SVG must be valid SVG`);
        assert.ok(pieceAsset.svgContent.includes('clipPath'), `Piece SVG must have clipPath`);
        assert.ok(pieceAsset.svgContent.includes('loose-piece-shadow'), `Piece SVG must have shadow filter`);
      }

      // Test Target presentation SVG
      const allSlotIds = def.slots.map(s => s.slotId);
      const halfMissing = allSlotIds.slice(0, 2);
      const halfPlaced = allSlotIds.slice(2);
      const targetSvg = PuzzleCutter.generateTargetSvg(def, halfMissing, halfPlaced, 240);
      assert.ok(targetSvg.includes('id="missing-sockets"'), 'Target SVG must render missing sockets');
      assert.ok(targetSvg.includes('id="placed-pieces"'), 'Target SVG must render placed pieces');
    }
  });

  it('should access all ingredients and recipes via AssetRegistry without missing entries', () => {
    const all = AssetRegistry.getAllIngredients();
    assert.strictEqual(all.length, 16);

    for (const entry of all) {
      assert.ok(entry.name);
      assert.ok(entry.displayName);
      assert.ok(entry.emoji);
      assert.ok(entry.palette.primary);
      assert.ok(entry.audioCue);

      // Verify piece and target generator functions
      const piece = entry.getPieceAsset(DEFAULT_INGREDIENTS[entry.id].slots[0].slotId);
      assert.ok(piece.svgContent);

      const target = entry.getTargetSvg([], [DEFAULT_INGREDIENTS[entry.id].slots[0].slotId]);
      assert.ok(target);
    }

    for (const recipeId of Object.keys(DEFAULT_RECIPES)) {
      const r = AssetRegistry.getRecipe(recipeId);
      assert.ok(r, `Recipe ${recipeId} must exist in registry`);
      assert.ok(r.requirements.length >= 2, `Recipe ${recipeId} must have at least 2 ingredients`);
    }
  });

  it('should deliver valid raster master dish art, cut pieces, and texture atlases for Gold Sample dishes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const dishes = ['dish_breakfast', 'dish_salad', 'dish_ramen'];
    const webAssetDir = path.resolve(process.cwd(), 'packages/web-greybox/public/assets/dishes');
    const cocosAssetDir = path.resolve(process.cwd(), 'cocos-app/assets/textures/dishes');

    assert.ok(fs.existsSync(webAssetDir), 'Web greybox dishes asset dir must exist');
    assert.ok(fs.existsSync(cocosAssetDir), 'Cocos textures dishes asset dir must exist');

    for (const dishId of dishes) {
      // 1. Verify Master Dish Art image exists and has non-zero size
      const masterWeb = path.join(webAssetDir, `${dishId}_master.jpg`);
      const masterCocos = path.join(cocosAssetDir, `${dishId}_master.jpg`);
      assert.ok(fs.existsSync(masterWeb), `Master image for ${dishId} must exist in web assets`);
      assert.ok(fs.existsSync(masterCocos), `Master image for ${dishId} must exist in cocos assets`);
      assert.ok(fs.statSync(masterWeb).size > 10000, `Master image for ${dishId} must be a valid high-res image`);

      // 2. Verify all 9 cut pieces exist
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const pieceFile = `piece_${dishId}_slot_${c}_${r}.png`;
          const pieceWeb = path.join(webAssetDir, pieceFile);
          const pieceCocos = path.join(cocosAssetDir, pieceFile);
          assert.ok(fs.existsSync(pieceWeb), `Cut piece ${pieceFile} must exist in web assets`);
          assert.ok(fs.existsSync(pieceCocos), `Cut piece ${pieceFile} must exist in cocos assets`);
          assert.ok(fs.statSync(pieceWeb).size > 1000, `Cut piece ${pieceFile} must have non-trivial PNG content`);
        }
      }

      // 3. Verify Atlas PNG and JSON
      const atlasPng = path.join(webAssetDir, `atlas_${dishId}.png`);
      const atlasJson = path.join(webAssetDir, `atlas_${dishId}.json`);
      assert.ok(fs.existsSync(atlasPng), `Atlas PNG for ${dishId} must exist`);
      assert.ok(fs.existsSync(atlasJson), `Atlas JSON for ${dishId} must exist`);

      const atlasData = JSON.parse(fs.readFileSync(atlasJson, 'utf-8'));
      assert.strictEqual(atlasData.dishId, dishId);
      assert.strictEqual(atlasData.pieces.length, 9, 'Atlas must contain 9 pieces for 3x3 dish');
      for (const piece of atlasData.pieces) {
        assert.ok(piece.slotId);
        assert.ok(piece.atlasRect && piece.atlasRect.width > 0 && piece.atlasRect.height > 0);
        assert.ok(piece.edges);
      }
    }
  });
});
