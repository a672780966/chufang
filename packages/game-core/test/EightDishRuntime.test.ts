import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DishPuzzleManager,
  DISH_CATALOG,
  OrderBag,
  DishPuzzleDayConfig
} from '../src/index';

describe('EightDishRuntime - Multi-Dish Runtime Authority & Assembly', () => {
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

  it('should instantiate and create pieces for each of the 8 dishes without error', () => {
    const manager = new DishPuzzleManager(8, 12);

    for (const dishId of ALL_8_DISH_IDS) {
      const inst = manager.createDishInstance(dishId);
      assert.ok(inst.instanceId.startsWith(`inst_${dishId}`));
      assert.strictEqual(inst.dishId, dishId);
      assert.strictEqual(inst.totalPieces, 9);
      assert.strictEqual(inst.isCompleted, false);

      // Create a piece for slot (1, 1)
      const piece = manager.createPiece(inst.instanceId, dishId, 1, 1, { col: 3, row: 3 });
      assert.strictEqual(piece.dishId, dishId);
      assert.strictEqual(piece.slotId, 'slot_1_1');
      assert.strictEqual(piece.boardCoord.col, 3);
      assert.strictEqual(piece.boardCoord.row, 3);
    }
  });

  it('should assemble and complete a full 3x3 layout for any new dish (dish_curry_rice)', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_curry_rice');

    let completedEventPayload: any = null;
    manager.events.on('DISH_COMPLETED', payload => {
      completedEventPayload = payload;
    });

    const pieces: any[] = [];
    // Spawn 3x3 pieces adjacent to each other on board at (2, 2) to (4, 4)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const p = manager.createPiece(inst.instanceId, 'dish_curry_rice', c, r, { col: 2 + c, row: 2 + r });
        manager.createGroup([p]);
        pieces.push(p);
      }
    }

    assert.strictEqual(manager.getAllPieces().length, 9);

    // Merge adjacent pieces by triggering adjacency evaluations
    for (const p of pieces) {
      const cur = manager.getPiece(p.pieceInstanceId);
      if (cur) manager.checkAndMergeAdjacency(cur.groupId);
    }

    assert.ok(completedEventPayload, 'Full 3x3 curry rice assembly must trigger DISH_COMPLETED');
    assert.strictEqual(completedEventPayload.dishId, 'dish_curry_rice');
    assert.strictEqual(completedEventPayload.dishPuzzleInstanceId, inst.instanceId);
    assert.strictEqual(completedEventPayload.pieces.length, 9);
  });

  it('should generate orders across all 8 dishes using OrderBag when weights are configured', () => {
    const weights: Record<string, number> = {};
    for (const id of ALL_8_DISH_IDS) {
      weights[id] = 1.0;
    }

    const config = {
      dayNumber: 8,
      businessGoal: 1000,
      activeDishIds: ALL_8_DISH_IDS,
      orderWeights: weights,
      dishCatalog: DISH_CATALOG
    } as unknown as DishPuzzleDayConfig;

    const bag = new OrderBag(config, undefined, 'seed_8_dishes', DISH_CATALOG);
    const generatedDishes = new Set<string>();

    for (let i = 0; i < 32; i++) {
      const order = bag.getCurrentOrder();
      assert.ok(order && order.dishId, `Order ${i} must exist with dishId`);
      assert.ok(ALL_8_DISH_IDS.includes(order.dishId), `Dish ${order.dishId} must be one of the 8 dishes`);
      generatedDishes.add(order.dishId);
      bag.advanceToNextOrder();
    }

    // In 32 uniform draws from 8 items, probability of seeing >= 6 distinct dishes is > 99.9%
    assert.ok(
      generatedDishes.size >= 6,
      `Expected to draw diverse dishes across 8 options (got ${generatedDishes.size})`
    );
  });
});
