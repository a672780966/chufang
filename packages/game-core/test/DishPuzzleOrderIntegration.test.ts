import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DEFAULT_DAYS,
  GOLD_SAMPLE_DISH_CATALOG,
  OrderBag
} from '../src/index';

describe('Stage 5A Test Suite 5: DishPuzzle Order Integration & Buffer Cascade', () => {
  it('should restrict OrderBag strictly to authoritative Gold Sample dish catalog', () => {
    const bag = new OrderBag({
      dayNumber: 1,
      businessGoal: 200,
      activeDishIds: ['dish_salad', 'dish_breakfast'],
      orderWeights: { dish_salad: 1, dish_breakfast: 1 }
    } as any, undefined, 'catalog_test_seed');

    for (let i = 0; i < 10; i++) {
      const order = bag.getCurrentOrder();
      assert.ok(order, 'Order must not be null');
      assert.ok(
        order.dishId === 'dish_salad' || order.dishId === 'dish_breakfast',
        `Order dishId must be in active catalog, got: ${order.dishId}`
      );
      const catalogDef = GOLD_SAMPLE_DISH_CATALOG[order.dishId];
      assert.ok(catalogDef, 'Must exist in GOLD_SAMPLE_DISH_CATALOG');
      assert.strictEqual(order.baseRevenue, catalogDef.baseRevenue);
      bag.advanceToNextOrder();
    }
  });

  it('should buffer non-matching completed dishes in PreparedDishBuffer (max 2)', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'buffer_test_seed', undefined, undefined, 'DISH_PUZZLE');
    assert.strictEqual(session.orderSystem.currentOrder?.dishId, 'dish_salad');
    assert.strictEqual(session.orderSystem.preparedDishBuffer.length, 0);

    // Serve dish_breakfast (does not match current salad order)
    session.orderSystem.handleCompletedDish('dish_breakfast');
    assert.strictEqual(session.orderSystem.preparedDishBuffer.length, 1);
    assert.strictEqual(session.orderSystem.preparedDishBuffer[0], 'dish_breakfast');
    assert.strictEqual(session.revenue, 0, 'No revenue gained for buffered dish yet');

    // Serve dish_ramen (does not match current salad order)
    session.orderSystem.handleCompletedDish('dish_ramen');
    assert.strictEqual(session.orderSystem.preparedDishBuffer.length, 2);
    assert.strictEqual(session.orderSystem.preparedDishBuffer[1], 'dish_ramen');

    // Attempt third dish into full buffer
    session.orderSystem.handleCompletedDish('dish_breakfast');
    assert.strictEqual(session.orderSystem.preparedDishBuffer.length, 2, 'Buffer max capacity is 2');
  });

  it('should cascade serve from PreparedDishBuffer when matching order arrives', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'cascade_test_seed', undefined, undefined, 'DISH_PUZZLE');
    assert.strictEqual(session.orderSystem.currentOrder?.dishId, 'dish_salad');

    // Pre-fill buffer with salad
    session.orderSystem['_preparedDishBuffer'] = ['dish_salad'];

    // Fulfill first salad order directly -> cascades into buffered salad!
    session.orderSystem.handleCompletedDish('dish_salad');
    assert.strictEqual(session.orderSystem.ordersFulfilledCount, 2, 'Direct fulfill + buffered cascade must fulfill 2 orders');
    assert.strictEqual(session.orderSystem.preparedDishBuffer.length, 0, 'Buffer must be consumed by cascade');
  });

  it('should achieve business goal and emit DAY_CLEARED across consecutive dish fulfillments', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'goal_clear_seed', undefined, undefined, 'DISH_PUZZLE');
    let dayClearedFired = false;
    session.events.on('DAY_CLEARED', () => {
      dayClearedFired = true;
    });

    while (!session.orderSystem.isGoalReached) {
      const curDish = session.orderSystem.currentOrder!.dishId!;
      session.orderSystem.handleCompletedDish(curDish);
    }

    assert.strictEqual(dayClearedFired, true, 'DAY_CLEARED must be emitted upon reaching goal');
    assert.ok(session.revenue >= session.dayConfig.businessGoal);
    assert.strictEqual(session.isGameOver, true);
  });
});
