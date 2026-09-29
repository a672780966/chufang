import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DISH_CATALOG,
  DishPuzzleDayConfig
} from '../src/index';

describe('EightDishFullLifecycle - 8/8 Complete, Clear, & Serve Full Runtime Invariant', () => {
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

  it('should execute full Complete -> Clear -> Serve lifecycle for all 8 dishes', () => {
    const completedSet = new Set<string>();
    const clearedSet = new Set<string>();
    const servedSet = new Set<string>();

    for (const targetDish of ALL_8_DISH_IDS) {
      const config = {
        dayNumber: 8,
        businessGoal: 1000,
        activeDishIds: [targetDish],
        orderWeights: { [targetDish]: 1.0 },
        dishCatalog: DISH_CATALOG,
        maxPieceCount: 24,
        supplyPerAction: 1
      } as unknown as DishPuzzleDayConfig;

      const session = new GameSession(config, `seed_lifecycle_${targetDish}`, undefined, undefined, 'DISH_PUZZLE');
      const mgr = session.dishPuzzleManager;

      let completedPayload: any = null;
      let clearedPayload: any = null;
      let servedPayload: any = null;

      session.events.on('DISH_COMPLETED', p => { completedPayload = p; });
      session.events.on('DISH_CLEARED', p => { clearedPayload = p; });
      session.events.on('DISH_SERVED', p => { servedPayload = p; });

      // Clean board state
      for (const piece of mgr.getAllPieces()) {
        mgr.removePiece(piece.pieceInstanceId);
      }

      // Establish active instance
      const inst = mgr.ensureActiveDishInstance(targetDish);

      // Create 9 pieces for targetDish placed adjacent at (0..2, 0..2)
      const pieces: any[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const p = mgr.createPiece(inst.instanceId, targetDish, c, r, { col: c, row: r });
          mgr.createGroup([p]);
          pieces.push(p);
        }
      }

      // Trigger adjacency evaluations to merge all 9 into a complete dish
      for (const p of pieces) {
        const curPiece = mgr.getPiece(p.pieceInstanceId);
        if (curPiece) {
          mgr.checkAndMergeAdjacency(curPiece.groupId);
        }
      }

      // 1. DISH_COMPLETED assertion
      assert.ok(completedPayload, `DISH_COMPLETED must fire for ${targetDish}`);
      assert.strictEqual(completedPayload.dishId, targetDish);
      assert.strictEqual(completedPayload.pieces.length, 9);
      completedSet.add(targetDish);

      // 2. DISH_CLEARED assertion
      assert.ok(clearedPayload, `DISH_CLEARED must fire for ${targetDish}`);
      assert.strictEqual(clearedPayload.dishId, targetDish);
      clearedSet.add(targetDish);

      // 3. DISH_SERVED assertion
      assert.ok(servedPayload, `DISH_SERVED must fire for ${targetDish}`);
      assert.strictEqual(servedPayload.dishId, targetDish);
      servedSet.add(targetDish);

      // Board must be cleared of completed pieces
      const remainingPieces = mgr.getAllPieces().filter(p => p.dishPuzzleInstanceId === inst.instanceId);
      assert.strictEqual(remainingPieces.length, 0, `Board must be cleared of ${targetDish} pieces`);
    }

    assert.strictEqual(completedSet.size, 8, '8 / 8 dishes must be verifiable as COMPLETE');
    assert.strictEqual(clearedSet.size, 8, '8 / 8 dishes must be verifiable as CLEARED');
    assert.strictEqual(servedSet.size, 8, '8 / 8 dishes must be verifiable as SERVED');
  });
});
