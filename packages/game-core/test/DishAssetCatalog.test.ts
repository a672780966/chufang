import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISH_CATALOG,
  GOLD_SAMPLE_DISH_CATALOG,
  getAuthoritativeDish,
  getAllAuthoritativeDishIds
} from '../src/index';

describe('DishAssetCatalog - 8 Dish Authoritative Catalog', () => {
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

  it('should register exactly 8 authoritative dishes in DISH_CATALOG', () => {
    const dishIds = getAllAuthoritativeDishIds();
    assert.strictEqual(dishIds.length, 8, 'DISH_CATALOG must have exactly 8 dishes');
    for (const expectedId of EXPECTED_DISH_IDS) {
      assert.ok(dishIds.includes(expectedId), `Missing dish: ${expectedId}`);
    }
  });

  it('should validate complete metadata for all 8 dishes', () => {
    for (const dishId of EXPECTED_DISH_IDS) {
      const def = getAuthoritativeDish(dishId);
      assert.ok(def, `Dish ${dishId} must be retrievable via getAuthoritativeDish`);
      assert.strictEqual(def.dishId, dishId);
      assert.ok(def.name && def.name.length > 0, `Dish ${dishId} must have valid name`);
      assert.ok(def.baseRevenue > 0, `Dish ${dishId} baseRevenue must be > 0`);
      assert.ok(def.emoji && def.emoji.length > 0, `Dish ${dishId} must have emoji`);
      assert.ok(def.category && def.category.length > 0, `Dish ${dishId} must have category`);
      assert.ok(
        ['EASY', 'MEDIUM', 'HARD'].includes(def.visualDifficulty || ''),
        `Dish ${dishId} must have visualDifficulty EASY, MEDIUM, or HARD`
      );
    }
  });

  it('should maintain backward-compatible GOLD_SAMPLE_DISH_CATALOG with 3 gold sample dishes', () => {
    const goldIds = Object.keys(GOLD_SAMPLE_DISH_CATALOG);
    assert.strictEqual(goldIds.length, 3, 'GOLD_SAMPLE_DISH_CATALOG must have exactly 3 dishes');
    assert.ok(goldIds.includes('dish_breakfast'));
    assert.ok(goldIds.includes('dish_salad'));
    assert.ok(goldIds.includes('dish_ramen'));
  });
});
