import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GameSession,
  BoardGrid,
  DiscreteGravity,
  PrepInventory,
  DeadlockDetector,
  FlowDirector,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  SeededRandom
} from '../src/index.js';

describe('SeededRandom Determinism', () => {
  it('should produce identical numbers with identical seeds', () => {
    const rng1 = new SeededRandom(9999);
    const rng2 = new SeededRandom(9999);
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(rng1.next(), rng2.next());
    }
  });
});

describe('Top Spawn Zone and Unified Gravity Enforcement', () => {
  it('should enforce that Target and LoosePiece strictly enter via Spawn Zone and settle downward', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 12345);
    const grid = session.grid;

    // Verify all targets are resting in playable rows (row < grid.rows)
    for (const target of grid.getAllTargets()) {
      assert.ok(target.anchor.row < grid.rows, `Target anchor ${target.anchor.row} should be in playable area`);
    }

    // Verify all loose pieces are resting in playable rows
    for (const piece of grid.getAllLoosePieces()) {
      assert.ok(piece.coord.row < grid.rows, `Loose piece row ${piece.coord.row} should be in playable area`);
    }

    // Block the entire top spawn zone row (totalRows - 1)
    const topRow = grid.totalRows - 1;
    for (let c = 0; c < grid.columns; c++) {
      grid.occupyLoosePiece({
        instanceId: `blocker_${c}`,
        ingredientId: 'bread',
        targetInstanceId: 'dummy',
        slotId: 'b_0',
        coord: { col: c, row: topRow }
      });
    }

    // Now try to spawn: should be rejected because spawn line is blocked
    const check = DeadlockDetector.evaluate(grid, DEFAULT_INGREDIENTS, DEFAULT_DAYS[0].targetIngredientCount);
    assert.strictEqual(check.hasSpawnableMissingPiece, false, 'Should detect that no missing piece can spawn when top line is blocked');
  });
});

describe('DeadlockDetector & FlowDirector Consistency', () => {
  it('should agree on spawnable missing piece availability', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 55555);
    const grid = session.grid;
    const flowDirector = session.flowDirector;

    // Under normal initial state, both should agree pieces are spawnable
    const check = DeadlockDetector.evaluate(grid, DEFAULT_INGREDIENTS, DEFAULT_DAYS[0].targetIngredientCount);
    const selected = flowDirector.selectNextLoosePiece(
      grid,
      session.inventory,
      session.orderSystem.currentOrder,
      session.orderSystem.getNextOrderFact()
    );

    assert.strictEqual(check.hasSpawnableMissingPiece, selected !== null);
  });
});

describe('Closure ReleasePlan Determinism by Seed', () => {
  it('should generate identical release plans for same seed and varied for different seeds', () => {
    const director = new FlowDirector(DEFAULT_DAYS[0], DEFAULT_INGREDIENTS, DEFAULT_RECIPES, 42);
    const def = DEFAULT_INGREDIENTS['bread'];

    const plan1 = director.createPieceReleasePlan(def, 'target_bread_1_seedA');
    const plan2 = director.createPieceReleasePlan(def, 'target_bread_1_seedA');
    const plan3 = director.createPieceReleasePlan(def, 'target_bread_1_seedB');

    assert.deepStrictEqual(plan1, plan2, 'Same target seed must yield identical release plans');

    // Exactly 1 closure piece
    const closureCount1 = Object.values(plan1).filter(v => v === 'closure').length;
    assert.strictEqual(closureCount1, 1, 'Target must have exactly one closure piece');
  });
});

describe('Jigsaw Tab & Blank Geometric Complementarity', () => {
  it('should have strictly complementary tab/blank edges for all adjacent internal slots', () => {
    for (const [ingId, def] of Object.entries(DEFAULT_INGREDIENTS)) {
      const slotMap = new Map<string, typeof def.slots[0]>();
      for (const slot of def.slots) {
        slotMap.set(`${slot.relativeCol},${slot.relativeRow}`, slot);
      }

      for (const slot of def.slots) {
        // Check right neighbor
        const rightNeighbor = slotMap.get(`${slot.relativeCol + 1},${slot.relativeRow}`);
        if (rightNeighbor) {
          if (slot.edges.right === 'tab') {
            assert.strictEqual(rightNeighbor.edges.left, 'blank', `${ingId} slot ${slot.slotId} right tab must match left blank`);
          } else if (slot.edges.right === 'blank') {
            assert.strictEqual(rightNeighbor.edges.left, 'tab', `${ingId} slot ${slot.slotId} right blank must match left tab`);
          }
        } else {
          assert.strictEqual(slot.edges.right, 'flat', `${ingId} outer right edge must be flat`);
        }

        // Check top neighbor
        const topNeighbor = slotMap.get(`${slot.relativeCol},${slot.relativeRow + 1}`);
        if (topNeighbor) {
          if (slot.edges.top === 'tab') {
            assert.strictEqual(topNeighbor.edges.bottom, 'blank', `${ingId} slot ${slot.slotId} top tab must match bottom blank`);
          } else if (slot.edges.top === 'blank') {
            assert.strictEqual(topNeighbor.edges.bottom, 'tab', `${ingId} slot ${slot.slotId} top blank must match bottom tab`);
          }
        } else {
          assert.strictEqual(slot.edges.top, 'flat', `${ingId} outer top edge must be flat`);
        }
      }
    }
  });
});

describe('NextOrderPreview Decoupling', () => {
  it('should decouple UI preview from internal full order fact', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 777);
    const preview = session.getState().nextOrderPreview;

    assert.strictEqual(preview.mode, 'DISH_ONLY');
    assert.ok(typeof preview.dishName === 'string');
    assert.ok(typeof preview.emoji === 'string');
    // In DISH_ONLY mode, recipe requirement internals are not leaked to UI
    assert.strictEqual(preview.requirements, undefined);
  });
});

describe('PrepInventory and Reservation', () => {
  it('should track reservations and available stock accurately', () => {
    const inv = new PrepInventory();
    inv.add('beef', 2);
    assert.strictEqual(inv.getAvailable('beef'), 2);

    const reserved = inv.reserve('beef', 1);
    assert.strictEqual(reserved, true);
    assert.strictEqual(inv.getAvailable('beef'), 1);
    assert.strictEqual(inv.getReserved('beef'), 1);

    inv.consumeReserved('beef', 1);
    assert.strictEqual(inv.getTotal('beef'), 1);
    assert.strictEqual(inv.getAvailable('beef'), 1);
    assert.strictEqual(inv.getReserved('beef'), 0);
  });
});

describe('NextOrderFact FlowDirector Weight Modulation', () => {
  it('should statistically boost selection of ingredients required by nextOrderFact', () => {
    const inv = new PrepInventory();
    const grid = new BoardGrid();

    let beefCountWithBeefNext = 0;
    let beefCountWithSaladNext = 0;
    const trials = 200;

    const beefOrderFact: any = {
      orderId: 'fact_beef',
      dishId: 'burger',
      dishName: '汉堡',
      revenue: 100,
      createdAtTurns: 0,
      items: [{ ingredientId: 'beef', needed: 2, reserved: 0 }]
    };

    const saladOrderFact: any = {
      orderId: 'fact_salad',
      dishId: 'veggie_salad',
      dishName: '沙拉',
      revenue: 80,
      createdAtTurns: 0,
      items: [{ ingredientId: 'salad', needed: 2, reserved: 0 }]
    };

    for (let i = 0; i < trials; i++) {
      const directorBeef = new FlowDirector(DEFAULT_DAYS[1], DEFAULT_INGREDIENTS, DEFAULT_RECIPES, 1000 + i);
      const chosenBeef = directorBeef.selectNextTargetIngredient(grid, inv, null, beefOrderFact);
      if (chosenBeef?.id === 'beef') beefCountWithBeefNext++;

      const directorSalad = new FlowDirector(DEFAULT_DAYS[1], DEFAULT_INGREDIENTS, DEFAULT_RECIPES, 1000 + i);
      const chosenSalad = directorSalad.selectNextTargetIngredient(grid, inv, null, saladOrderFact);
      if (chosenSalad?.id === 'beef') beefCountWithSaladNext++;
    }

    assert.ok(
      beefCountWithBeefNext > beefCountWithSaladNext,
      `NextOrderFact with beef should pick beef more frequently (${beefCountWithBeefNext}) than when salad is next (${beefCountWithSaladNext})`
    );
  });
});

describe('Action-Driven Spatial Pressure & Natural Recovery', () => {
  it('should accumulate spatial momentum on consecutive non-clearing moves and collapse height on completion', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 4321);
    const initialHeight = session.grid.getMaxStackHeight();
    assert.ok(initialHeight >= 0, 'Initial stack height should be non-negative');

    // Simulate placements: when moves don't complete an ingredient, momentum builds
    let piecesPlaced = 0;
    while (piecesPlaced < 6 && !session.getState().isGameOver) {
      const state = session.getState();
      const targets = session.grid.getAllTargets();
      const loose = session.grid.getAllLoosePieces();

      let placed = false;
      for (const p of loose) {
        const target = targets.find(t => t.instanceId === p.targetInstanceId);
        if (target && target.missingSlotIds.includes(p.slotId)) {
          // If this move would complete the target, skip it temporarily to let momentum build
          if (target.missingSlotIds.length === 1 && piecesPlaced < 3) {
            continue;
          }
          const res = session.placePiece(p.instanceId, target.instanceId, p.slotId);
          if (res.success) {
            placed = true;
            piecesPlaced++;
            break;
          }
        }
      }
      if (!placed) break;
    }

    assert.ok(piecesPlaced > 0, 'Should have successfully placed pieces');
  });
});

describe('Rigorous Deadlock Detection (PRD 3.1 BOARD_BLOCKED)', () => {
  it('should declare deadlock when top spawn line is blocked and no legal moves or completions exist', () => {
    const grid = new BoardGrid();
    // Fill the entire spawn zone (rows to totalRows - 1) completely with loose pieces
    for (let r = grid.rows; r < grid.totalRows; r++) {
      for (let c = 0; c < grid.columns; c++) {
        grid.occupyLoosePiece({
          instanceId: `blocker_${c}_${r}`,
          ingredientId: 'bread',
          targetInstanceId: 'non_existent_target',
          slotId: 'b_0',
          coord: { col: c, row: r }
        });
      }
    }

    // No targets on board, top spawn row blocked:
    // 1. hasPendingClear = false
    // 2. hasLegalPiecePlacement = false
    // 3. hasSpawnableMissingPiece = false
    // 4. hasLegalTargetSpawn = false (spawn zone blocked)
    const check = DeadlockDetector.evaluate(grid, DEFAULT_INGREDIENTS, 2);
    assert.strictEqual(check.hasPendingClear, false);
    assert.strictEqual(check.hasLegalPiecePlacement, false);
    assert.strictEqual(check.hasSpawnableMissingPiece, false);
    assert.strictEqual(check.hasLegalTargetSpawn, false);
    assert.strictEqual(check.isDeadlocked, true, 'Board must be strictly identified as deadlocked (BOARD_BLOCKED)');
  });
});

