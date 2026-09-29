import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  GameFlowManager,
  DEFAULT_DAYS,
  DishPuzzleManager,
  DishPieceSupplyScheduler,
  DishPuzzleDayConfig,
  getProvisionalDishConfig
} from '../src/index.js';
import { computeSessionStateHash } from './DishPuzzleDeterminism.test.js';

describe('Stage 5A Revision 2: Final Core Closure & Invariant Assertions', () => {
  // Invariant 1: Day 1 Gold Sample Layout is initialized only once
  it('1. should initialize Day 1 Gold Sample Layout only once on session startup', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'day1_once_seed');
    flow.beginPlaying();

    const manager = session.dishPuzzleManager;
    const piecesInit = manager.getAllPieces();
    assert.strictEqual(piecesInit.length, 17, 'Day 1 Gold Sample layout initializes exactly 17 pieces across 3 dishes');

    const saladPieces = piecesInit.filter(p => p.dishId === 'dish_salad');
    assert.strictEqual(saladPieces.length, 9, 'Initial layout contains exactly 9 salad pieces');

    // Triggering ensureActiveDishInstance must not re-initialize or duplicate the layout
    manager.ensureActiveDishInstance('dish_salad');
    const piecesAfter = manager.getAllPieces().filter(p => p.dishId === 'dish_salad');
    assert.strictEqual(piecesAfter.length, 9, 'Must not duplicate or re-spawn Day 1 salad layout on ensureActiveDishInstance');
  });

  // Invariant 2: After Salad completion, newly created Salad instance must NOT spawn Day 1 layout
  it('2. should create fresh, empty Salad instance without spawning Day 1 layout after previous Salad completes', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'salad_recreate_seed');
    flow.beginPlaying();

    const manager = session.dishPuzzleManager;
    const salad1 = manager.getActiveDishInstances().find(i => i.dishId === 'dish_salad')!;
    assert.ok(salad1);

    // Solve Salad 1 in 4 moves
    const saladPieces = manager.getAllPieces().filter(p => p.dishPuzzleInstanceId === salad1.instanceId);
    const p20 = saladPieces.find(p => p.dishCol === 2 && p.dishRow === 0)!;
    const g20 = manager.getGroupByPieceId(p20.pieceInstanceId)!;
    manager.tryMoveGroup(g20.groupId, 2, 0, p20.pieceInstanceId);

    const p02 = saladPieces.find(p => p.dishCol === 0 && p.dishRow === 2)!;
    const g02 = manager.getGroupByPieceId(p02.pieceInstanceId)!;
    manager.tryMoveGroup(g02.groupId, 0, 2, p02.pieceInstanceId);

    const p12 = saladPieces.find(p => p.dishCol === 1 && p.dishRow === 2)!;
    const g12 = manager.getGroupByPieceId(p12.pieceInstanceId)!;
    manager.tryMoveGroup(g12.groupId, 1, 2, p12.pieceInstanceId);

    const p22 = saladPieces.find(p => p.dishCol === 2 && p.dishRow === 2)!;
    const g22 = manager.getGroupByPieceId(p22.pieceInstanceId)!;
    const res = manager.tryMoveGroup(g22.groupId, 2, 2, p22.pieceInstanceId);
    assert.ok(res.completedDish, 'Move 4 completes Salad 1');

    // Salad 1 is now cleared and served
    assert.strictEqual(salad1.isCompleted, true);

    // Query active salad instance now
    const salad2 = manager.getActiveDishInstances().find(i => i.dishId === 'dish_salad');
    assert.ok(salad2, 'New salad instance must be present in active pool');
    assert.notStrictEqual(salad2.instanceId, salad1.instanceId, 'Must be distinct instance');

    // CRITICAL: salad2 must NOT have the 9-piece Day 1 layout re-spawned!
    const salad2Pieces = manager.getAllPieces().filter(p => p.dishPuzzleInstanceId === salad2.instanceId);
    assert.ok(
      salad2Pieces.length < 9,
      `New Salad instance must start empty/supplied via scheduler, not Day 1 layout (got ${salad2Pieces.length} pieces)`
    );
    // Specifically verify it does not have the pre-connected 4-piece base group at (0,0)
    const baseGroup = manager.getAllGroups().find(
      g => g.dishPuzzleInstanceId === salad2.instanceId && g.pieceIds.length === 4
    );
    assert.strictEqual(baseGroup, undefined, 'Must not spawn 4-piece base group for subsequent salad instance');
  });

  // Invariant 3: maintainActiveDishPool strictly obeys activeDishIds from config
  it('3. should strictly restrict active dish pool to activeDishIds defined in config', () => {
    const customConfig: DishPuzzleDayConfig = {
      dayNumber: 99,
      activeDishIds: ['dish_breakfast', 'dish_ramen'], // No salad!
      businessGoal: 500,
      orderWeights: { dish_breakfast: 1, dish_ramen: 1 },
      initialPieceCount: 6,
      comfortablePieceCount: 12,
      maxPieceCount: 20,
      supplyPerAction: 1,
      currentOrderWeight: 100,
      nearCompleteWeight: 25,
      starvationWeight: 20,
      dangerThreshold: 0.65
    };

    const manager = new DishPuzzleManager(8, 12, undefined, customConfig);
    manager.createDishInstance('dish_breakfast');
    const pool = manager.maintainActiveDishPool();

    assert.strictEqual(pool.length, 2, 'Must maintain exactly 2 active dishes');
    assert.ok(pool.some(i => i.dishId === 'dish_breakfast'), 'Must contain breakfast');
    assert.ok(pool.some(i => i.dishId === 'dish_ramen'), 'Must contain ramen');
    assert.strictEqual(
      pool.some(i => i.dishId === 'dish_salad'),
      false,
      'Must NOT contain dish_salad when excluded from activeDishIds'
    );
  });

  // Invariant 4: Modifying maxPieceCount in config alters runtime piece cap
  it('4. should dynamically enforce maxPieceCount cap from runtime config', () => {
    // Session A: maxPieceCount = 10 on Day 2 with initialPieceCount = 6
    const configA = { ...DEFAULT_DAYS[1], dayNumber: 2, initialPieceCount: 6, maxPieceCount: 10, targetIngredientCount: 0 };
    const sessionA = new GameSession(configA, 'cap_10_seed', undefined, undefined, 'DISH_PUZZLE');

    // Fill to 10
    while (sessionA.dishPuzzleManager.getAllPieces().length < 10) {
      sessionA.dishPuzzleManager.schedulePieceAcrossActiveDishes(1);
    }
    assert.strictEqual(sessionA.dishPuzzleManager.getAllPieces().length, 10);

    // Call private handleActionSupply via moveDishGroup
    const piecesA = sessionA.dishPuzzleManager.getAllPieces();
    const gA = sessionA.dishPuzzleManager.getGroupByPieceId(piecesA[0].pieceInstanceId)!;
    sessionA.moveDishGroup(gA.groupId, piecesA[0].boardCoord.col, piecesA[0].boardCoord.row, piecesA[0].pieceInstanceId);

    // Should NOT supply more pieces because length >= maxPieceCount (10)
    assert.strictEqual(
      sessionA.dishPuzzleManager.getAllPieces().length,
      10,
      'Session A must not exceed maxPieceCount 10'
    );

    // Session B: maxPieceCount = 30 on Day 2 with initialPieceCount = 6
    const configB = { ...DEFAULT_DAYS[1], dayNumber: 2, initialPieceCount: 6, maxPieceCount: 30, targetIngredientCount: 0 };
    const sessionB = new GameSession(configB, 'cap_30_seed', undefined, undefined, 'DISH_PUZZLE');

    const piecesB = sessionB.dishPuzzleManager.getAllPieces();
    const initialCount = piecesB.length;
    const gB = sessionB.dishPuzzleManager.getGroupByPieceId(piecesB[0].pieceInstanceId)!;
    sessionB.moveDishGroup(gB.groupId, piecesB[0].boardCoord.col, piecesB[0].boardCoord.row, piecesB[0].pieceInstanceId);

    assert.ok(
      sessionB.dishPuzzleManager.getAllPieces().length > initialCount,
      'Session B with maxPieceCount 30 must continue supplying pieces'
    );
  });

  // Invariant 5: Modifying supplyPerAction in config alters drop batch size
  it('5. should respect supplyPerAction parameter from config upon player action', () => {
    const config = { ...DEFAULT_DAYS[0], supplyPerAction: 3, maxPieceCount: 40, targetIngredientCount: 0 };
    const session = new GameSession(config, 'supply_action_seed', undefined, undefined, 'DISH_PUZZLE');

    const initialCount = session.dishPuzzleManager.getAllPieces().length;
    const piece = session.dishPuzzleManager.getAllPieces()[0];
    const group = session.dishPuzzleManager.getGroupByPieceId(piece.pieceInstanceId)!;

    // Execute 1 legal in-place action (does not merge)
    session.moveDishGroup(group.groupId, piece.boardCoord.col, piece.boardCoord.row, piece.pieceInstanceId);

    const newCount = session.dishPuzzleManager.getAllPieces().length;
    assert.strictEqual(
      newCount - initialCount,
      3,
      'Must supply exactly 3 pieces when supplyPerAction = 3'
    );
  });

  // Invariant 6: Modifying Scheduler weight parameters causes expected change in selection
  it('6. should direct scheduler candidate selection based on configured weights', () => {
    const scheduler = new DishPieceSupplyScheduler();
    const manager = new DishPuzzleManager(8, 12);
    const instSalad = manager.createDishInstance('dish_salad');
    const instRamen = manager.createDishInstance('dish_ramen');

    // Default weights: current order (salad) weight 100, other (ramen) weight 40
    scheduler.configureWeights({ currentOrderWeight: 100, baseNonOrderWeight: 40 });
    const choice1 = scheduler.selectNextCandidate(
      [instSalad, instRamen],
      id => manager.getMissingSlots(id),
      'dish_salad'
    );
    assert.strictEqual(choice1?.instance.dishId, 'dish_salad', 'Default weights must select current order dish');

    // Invert weights: current order weight 10, other weight 200
    scheduler.configureWeights({ currentOrderWeight: 10, baseNonOrderWeight: 200 });
    const choice2 = scheduler.selectNextCandidate(
      [instSalad, instRamen],
      id => manager.getMissingSlots(id),
      'dish_salad'
    );
    assert.strictEqual(choice2?.instance.dishId, 'dish_ramen', 'Inverted weights must select highest weighted dish (ramen)');
  });

  // Invariant 7: Dish Order initial isFulfilled === false
  it('7. should ensure Dish orders initialize strictly with isFulfilled === false', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'unfulfilled_init_seed');

    const order = session.orderSystem.currentOrder;
    assert.ok(order, 'Current order must exist');
    assert.strictEqual(order.kind, 'DISH', 'Order kind must be DISH');
    assert.strictEqual(order.items.length, 0, 'Dish orders have no ingredient items');
    assert.strictEqual(
      order.isFulfilled,
      false,
      'CRITICAL: Dish order must NOT auto-fulfill on creation despite empty items array'
    );
  });

  // Invariant 8: Only matching DISH_SERVED completes the order
  it('8. should fulfill Dish order strictly upon receiving matching DISH_SERVED', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'matching_dish_seed');
    const currentDish = session.orderSystem.currentOrder?.dishId || 'dish_salad';

    // 1. Send mismatched dish (breakfast)
    const mismatchedDish = currentDish === 'dish_salad' ? 'dish_breakfast' : 'dish_salad';
    const resMismatched = session.orderSystem.handleCompletedDish(mismatchedDish);
    assert.strictEqual(resMismatched.served, false, 'Non-matching dish must not be served immediately');
    assert.strictEqual(resMismatched.buffered, true, 'Non-matching dish must be buffered');
    assert.strictEqual(session.orderSystem.currentOrder?.isFulfilled, false, 'Current order remains unfulfilled');
    assert.strictEqual(session.revenue, 0, 'No revenue for mismatched dish');

    // 2. Send matching dish
    const resMatching = session.orderSystem.handleCompletedDish(currentDish);
    assert.strictEqual(resMatching.served, true, 'Matching dish must be served');
    assert.strictEqual(session.orderSystem.ordersFulfilledCount, 1);
    assert.ok(session.revenue > 0, 'Revenue awarded upon matching dish completion');
  });

  // Invariant 9: nextOrderPreviewDay gating
  it('9. should hide next order preview on Day 2 and reveal on Day 3 when nextOrderPreviewDay = 3', () => {
    const configDay2 = {
      ...DEFAULT_DAYS[1],
      dayNumber: 2,
      nextOrderPreviewDay: 3,
      targetIngredientCount: 0
    };
    const sessionDay2 = new GameSession(configDay2, 'preview_d2_seed', undefined, undefined, 'DISH_PUZZLE');
    assert.strictEqual(sessionDay2.isNextOrderPreviewUnlocked, false);
    assert.strictEqual(sessionDay2.nextOrderPreview.mode, 'NONE');
    assert.strictEqual(sessionDay2.getNextOrderPreview().mode, 'NONE');

    const configDay3 = {
      ...DEFAULT_DAYS[2],
      dayNumber: 3,
      nextOrderPreviewDay: 3,
      targetIngredientCount: 0
    };
    const sessionDay3 = new GameSession(configDay3, 'preview_d3_seed', undefined, undefined, 'DISH_PUZZLE');
    assert.strictEqual(sessionDay3.isNextOrderPreviewUnlocked, true);
    assert.notStrictEqual(sessionDay3.nextOrderPreview.mode, 'NONE');
    assert.ok(sessionDay3.nextOrderPreview.dishName, 'Preview must expose dishName on Day 3');
  });

  // Invariant 10: Full determinism including scheduler state and order bag state
  it('10. should produce 100% identical state hashes including scheduler and order bag states for same seed and actions', () => {
    const seed = 'determinism_rev2_invariant_seed';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');
    const s2 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');

    // Check initial full hash
    const hash1 = computeSessionStateHash(s1);
    const hash2 = computeSessionStateHash(s2);
    assert.strictEqual(hash1, hash2, 'Initial full state hash must match byte-for-byte');

    // Execute 5 identical moves
    for (let step = 0; step < 5; step++) {
      const p1 = s1.dishPuzzleManager.getAllPieces()[0];
      const g1 = s1.dishPuzzleManager.getGroupByPieceId(p1.pieceInstanceId)!;
      s1.moveDishGroup(g1.groupId, p1.boardCoord.col, p1.boardCoord.row, p1.pieceInstanceId);

      const p2 = s2.dishPuzzleManager.getAllPieces()[0];
      const g2 = s2.dishPuzzleManager.getGroupByPieceId(p2.pieceInstanceId)!;
      s2.moveDishGroup(g2.groupId, p2.boardCoord.col, p2.boardCoord.row, p2.pieceInstanceId);

      const hStep1 = computeSessionStateHash(s1);
      const hStep2 = computeSessionStateHash(s2);
      assert.strictEqual(hStep1, hStep2, `State hash mismatch at step ${step}`);

      // Verify scheduler and orderBag snapshots
      const snap1 = s1.getFullStateSnapshot();
      const snap2 = s2.getFullStateSnapshot();
      assert.deepStrictEqual(snap1.schedulerState, snap2.schedulerState);
      assert.deepStrictEqual(snap1.orderBagState, snap2.orderBagState);
    }
  });
});
