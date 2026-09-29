import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISH_CATALOG,
  OrderBag,
  DishPuzzleDayConfig
} from '../src/index';

describe('EightDishOrderability - Deterministic 8/8 Dish Order Generation', () => {
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

  it('should deterministically generate orders for each of the 8 dishes individually', () => {
    for (const targetDish of ALL_8_DISH_IDS) {
      const singleWeightConfig = {
        dayNumber: 8,
        businessGoal: 500,
        activeDishIds: [targetDish],
        orderWeights: { [targetDish]: 1.0 },
        dishCatalog: DISH_CATALOG
      } as unknown as DishPuzzleDayConfig;

      const bag = new OrderBag(singleWeightConfig, undefined, `seed_order_${targetDish}`, DISH_CATALOG);

      // Verify consecutive drawn orders for this target dish
      for (let draw = 0; draw < 5; draw++) {
        const order = bag.getCurrentOrder();
        assert.ok(order, `Order ${draw} must exist for ${targetDish}`);
        assert.strictEqual(
          order.dishId,
          targetDish,
          `Expected order for ${targetDish}, but got ${order.dishId}`
        );
        assert.strictEqual(order.isFulfilled, false, 'New order must not be fulfilled initially');
        assert.ok(order.baseRevenue > 0, 'Order must have positive baseRevenue');
        bag.advanceToNextOrder();
      }
    }
  });

  it('should confirm 8 / 8 authoritative dishes are strictly ORDERABLE', () => {
    const verifiedDishIds = new Set<string>();

    for (const dishId of ALL_8_DISH_IDS) {
      const config = {
        dayNumber: 8,
        businessGoal: 1000,
        activeDishIds: ALL_8_DISH_IDS,
        orderWeights: { [dishId]: 100.0 },
        dishCatalog: DISH_CATALOG
      } as unknown as DishPuzzleDayConfig;
      const bag = new OrderBag(config, undefined, `seed_verify_${dishId}`, DISH_CATALOG);
      const firstOrder = bag.getCurrentOrder();
      if (firstOrder?.dishId === dishId) {
        verifiedDishIds.add(dishId);
      }
    }

    assert.strictEqual(verifiedDishIds.size, 8, 'All 8 dishes must be verifiable as ORDERABLE');
  });
});
