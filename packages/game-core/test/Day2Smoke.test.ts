import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameFlowManager,
  GOLD_SAMPLE_DISH_CATALOG,
  GOLD_SAMPLE_DISH_MANIFEST,
  getProvisionalDishConfig
} from '../src/index';

describe('Stage 5A Revision 1: Day 2 Configuration Smoke Test', () => {
  it('should verify Day 2 loads exclusively with Gold Sample dishes, manifests, valid assets, and zero legacy objects', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(2, 'day2_smoke_test_seed');
    flow.beginPlaying();

    const provisional = getProvisionalDishConfig(2);
    assert.strictEqual(session.gameplayMode, 'DISH_PUZZLE', 'Must be in DISH_PUZZLE mode');
    assert.strictEqual(session.dayConfig.dayNumber, 2);
    assert.strictEqual(session.dayConfig.businessGoal, provisional.businessGoal, 'Must use provisional businessGoal (250), not legacy DEFAULT_DAYS');
    assert.strictEqual(session.orderSystem.businessGoal, 250);

    const goldDishIds = Object.keys(GOLD_SAMPLE_DISH_CATALOG);

    // 1. Verify current and queued orders strictly contain Gold Sample dishes, NO dish_burger
    assert.ok(session.orderSystem.currentOrder, 'Current order must exist');
    assert.ok(goldDishIds.includes(session.orderSystem.currentOrder!.dishId!), `Order dishId "${session.orderSystem.currentOrder!.dishId}" must be in Gold Sample catalog`);
    assert.notStrictEqual(session.orderSystem.currentOrder!.dishId, 'dish_burger', 'dish_burger must NEVER appear');

    for (let i = 0; i < 20; i++) {
      const order = session.orderSystem.getNextOrderFact();
      if (order) {
        assert.ok(goldDishIds.includes(order.dishId!), `Upcoming order "${order.dishId}" must be in Gold Sample catalog`);
        assert.notStrictEqual(order.dishId, 'dish_burger', 'dish_burger must NEVER appear in upcoming orders');
      }
    }

    // 2. Verify all active dishes have manifests
    const instances = session.dishPuzzleManager.getActiveDishInstances();
    assert.ok(instances.length > 0, 'Must have active dish instances');
    for (const inst of instances) {
      assert.ok(GOLD_SAMPLE_DISH_MANIFEST[inst.dishId], `Dish instance ${inst.dishId} must have an authoritative manifest`);
      assert.notStrictEqual(inst.name, inst.dishId, `Dish name must not fallback to raw id ${inst.dishId}`);
    }

    // 3. Verify all pieces on board have valid asset paths and valid manifests
    const pieces = session.dishPuzzleManager.getAllPieces();
    assert.ok(pieces.length > 0, 'Board must contain pieces');
    for (const piece of pieces) {
      assert.ok(goldDishIds.includes(piece.dishId), `Piece dishId "${piece.dishId}" must be in Gold Sample catalog`);
      assert.ok(piece.imagePath.startsWith('/assets/dishes/piece_'), `Piece imagePath "${piece.imagePath}" must be valid`);
      assert.ok(piece.imagePath.endsWith('.png'), `Piece imagePath must end with .png`);
      assert.strictEqual(piece.slotId, `slot_${piece.dishCol}_${piece.dishRow}`);
    }

    // 4. Verify zero legacy ingredient targets and loose pieces
    assert.strictEqual(session.grid.getAllTargets().length, 0, 'Must have zero legacy ingredient targets');
    assert.strictEqual(session.grid.getAllLoosePieces().length, 0, 'Must have zero legacy loose pieces');
  });
});
