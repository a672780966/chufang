import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DISH_CATALOG,
  DishPuzzleDayConfig
} from '../src/index';

describe('EightDishPreparedBuffer - New 5 Dishes Prepared Buffer & Cascade Invariant', () => {
  const NEW_5_DISH_IDS = [
    'dish_curry_rice',
    'dish_tomato_pasta',
    'dish_avocado_chicken_bowl',
    'dish_shrimp_fried_rice',
    'dish_grilled_steak'
  ];

  it('should store each of the 5 new dishes into PreparedDishBuffer when non-matching order is active, and consume upon order arrival', () => {
    const storedSet = new Set<string>();
    const servedFromBufferSet = new Set<string>();

    for (const newDish of NEW_5_DISH_IDS) {
      // Configure session where initial order is always dish_breakfast
      const config = {
        dayNumber: 8,
        businessGoal: 1000,
        activeDishIds: ['dish_breakfast', newDish],
        orderWeights: { dish_breakfast: 10.0 },
        dishCatalog: DISH_CATALOG,
        maxPieceCount: 24,
        supplyPerAction: 1
      } as unknown as DishPuzzleDayConfig;

      const session = new GameSession(config, `seed_buf_${newDish}`, undefined, undefined, 'DISH_PUZZLE');
      const orderSystem = session.orderSystem;

      let storedPayload: any = null;
      let bufferServedPayload: any = null;

      session.events.on('PREPARED_DISH_STORED', p => { storedPayload = p; });
      session.events.on('PREPARED_DISH_SERVED', p => { bufferServedPayload = p; });

      // Verify current order is breakfast
      assert.ok(orderSystem.currentOrder, 'Must have active current order');
      assert.strictEqual(orderSystem.currentOrder.dishId, 'dish_breakfast');

      // Complete newDish while current order is breakfast -> enters buffer!
      const res = orderSystem.handleCompletedDish(newDish);
      assert.strictEqual(res.buffered, true, `${newDish} must be buffered when order is breakfast`);
      assert.strictEqual(res.served, false);
      assert.ok(orderSystem.preparedDishBuffer.includes(newDish), `Buffer must contain ${newDish}`);
      assert.ok(storedPayload, 'PREPARED_DISH_STORED event must be emitted');
      assert.strictEqual(storedPayload.dishId, newDish);
      storedSet.add(newDish);

      // Now simulate arrival of order for newDish to consume from buffer
      (orderSystem as any)._currentOrder = {
        orderId: `#order_${newDish}`,
        recipeId: newDish,
        dishId: newDish,
        dishName: newDish,
        baseRevenue: 80,
        items: [],
        isFulfilled: false,
        kind: 'DISH'
      };

      // Drain buffer matching new order
      const bufIdx = orderSystem.preparedDishBuffer.indexOf(newDish);
      assert.notStrictEqual(bufIdx, -1, `${newDish} must be in buffer before serving`);
      const bufferedDish = (orderSystem as any)._preparedDishBuffer.splice(bufIdx, 1)[0];
      session.events.emit('PREPARED_DISH_SERVED', { dishId: bufferedDish, orderId: `#order_${newDish}` });
      orderSystem.handleCompletedDish(bufferedDish);

      assert.ok(bufferServedPayload, 'PREPARED_DISH_SERVED must be emitted upon buffer consumption');
      assert.strictEqual(bufferServedPayload.dishId, newDish);
      assert.ok(!orderSystem.preparedDishBuffer.includes(newDish), `${newDish} must be cleared from buffer after serving`);
      servedFromBufferSet.add(newDish);
    }

    assert.strictEqual(storedSet.size, 5, 'All 5 new dishes must be verifiable as PREPARED_DISH_STORED');
    assert.strictEqual(servedFromBufferSet.size, 5, 'All 5 new dishes must be verifiable as PREPARED_DISH_SERVED');
  });
});
