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
});
