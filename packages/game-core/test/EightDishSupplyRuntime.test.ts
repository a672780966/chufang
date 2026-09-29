import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DishPuzzleManager,
  DISH_CATALOG,
  DishPuzzleDayConfig
} from '../src/index';

describe('EightDishSupplyRuntime - Formal Scheduler Supply for 8/8 Dishes', () => {
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

  it('should supply pieces for every single dish via formal DishPieceSupplyScheduler without manual createPiece calls', () => {
    for (const targetDish of ALL_8_DISH_IDS) {
      const config = {
        dayNumber: 8,
        businessGoal: 1000,
        activeDishIds: [targetDish],
        orderWeights: { [targetDish]: 1.0 },
        dishCatalog: DISH_CATALOG,
        maxPieceCount: 20
      } as unknown as DishPuzzleDayConfig;

      const manager = new DishPuzzleManager(8, 12, undefined, config);
      manager.ensureActiveDishInstance(targetDish);

      const suppliedSlots = new Set<string>();

      // Supply pieces batch by batch strictly through formal scheduler
      for (let batch = 0; batch < 9; batch++) {
        const spawned = manager.schedulePieceAcrossActiveDishes(1, targetDish);
        assert.ok(spawned.length > 0, `Scheduler must spawn at least 1 piece for ${targetDish}`);
        for (const p of spawned) {
          assert.strictEqual(
            p.dishId,
            targetDish,
            `Spawned piece must belong to active dish ${targetDish}`
          );
          suppliedSlots.add(`${p.dishCol}_${p.dishRow}`);
        }
      }

      // Assert that scheduler supplied pieces for this dish
      assert.ok(
        suppliedSlots.size >= 5,
        `Expected at least 5 distinct slots supplied for ${targetDish} in 9 draws (got ${suppliedSlots.size})`
      );
    }
  });

  it('should confirm 8 / 8 authoritative dishes are strictly SUPPLYABLE through the formal pipeline', () => {
    const supplyableDishes = new Set<string>();

    for (const targetDish of ALL_8_DISH_IDS) {
      const config = {
        dayNumber: 8,
        businessGoal: 1000,
        activeDishIds: [targetDish],
        orderWeights: { [targetDish]: 1.0 },
        dishCatalog: DISH_CATALOG,
        maxPieceCount: 24
      } as unknown as DishPuzzleDayConfig;

      const manager = new DishPuzzleManager(8, 12, undefined, config);
      manager.ensureActiveDishInstance(targetDish);

      const pieces = manager.refillAllMissingPieces(targetDish);
      assert.ok(pieces.length > 0, `refillAllMissingPieces must supply pieces for ${targetDish}`);

      const dishPieces = manager.getAllPieces().filter(p => p.dishId === targetDish);
      assert.strictEqual(dishPieces.length, 9, `All 9 pieces must be supplied for ${targetDish}`);

      // Verify all 9 slots (0..2, 0..2) are covered
      const coveredSlots = new Set(dishPieces.map(p => `${p.dishCol}_${p.dishRow}`));
      assert.strictEqual(coveredSlots.size, 9, `All 9 unique slots must be covered for ${targetDish}`);

      supplyableDishes.add(targetDish);
    }

    assert.strictEqual(supplyableDishes.size, 8, '8 / 8 dishes must be proven SUPPLYABLE');
  });
});
