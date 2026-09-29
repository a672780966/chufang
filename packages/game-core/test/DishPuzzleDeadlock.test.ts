import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DEFAULT_DAYS,
  DishPuzzleManager,
  DishPuzzleDeadlockDetector
} from '../src/index';

describe('Stage 5A Test Suite 3: DishPuzzle Deadlock & Softlock Immunity', () => {
  it('should never declare deadlock when a completed 9-piece dish exists on board', () => {
    const manager = new DishPuzzleManager(8, 12);
    const detector = new DishPuzzleDeadlockDetector();

    // Fill almost the entire board
    const saladInst = manager.createDishInstance('dish_salad');
    const pieces = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        pieces.push(manager.createPiece(saladInst.instanceId, 'dish_salad', c, r, { col: c, row: r + 5 }));
      }
    }
    const group = manager.createGroup(pieces);
    group.isComplete = true;

    const res = detector.checkDeadlock(manager);
    assert.strictEqual(res.isDeadlocked, false, 'Completed dish releases space upon clear, never deadlock');
  });

  it('should detect true deadlock when top spawn line is blocked and no legal moves exist', () => {
    const manager = new DishPuzzleManager(8, 12);
    const detector = new DishPuzzleDeadlockDetector();

    // Fill all playable cells completely with 1-piece groups of alternating dishes so no cell is empty and no moves/merges are possible
    const dishes = ['dish_salad', 'dish_breakfast', 'dish_ramen'];
    let instIdx = 0;
    const instances = dishes.map(d => manager.createDishInstance(d));

    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        if (!manager.isCellReserved(c, r)) {
          const inst = instances[instIdx % instances.length];
          instIdx++;
          const p = manager.createPiece(inst.instanceId, inst.dishId, 0, 0, { col: c, row: r });
          manager.createGroup([p]);
        }
      }
    }

    assert.strictEqual(manager.getAvailableSpawnCells().length, 0, 'Spawn zone must be completely blocked');
    assert.strictEqual(manager.getOccupancyRatio(), 1.0, 'Occupancy ratio must be 100%');

    const result = detector.checkDeadlock(manager);
    assert.strictEqual(result.isDeadlocked, true, 'Deadlock detector must assert true deadlock');
    assert.strictEqual(result.availableSpawnCount, 0, 'availableSpawnCount must be 0');
    assert.strictEqual(result.legalMovesCount, 0, 'legalMovesCount must be 0');
  });

  it('should accurately emit DISH_BOARD_DEADLOCKED, BOARD_BLOCKED, and DAY_FAILED exactly once on session true deadlock', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'deadlock_emit_seed', undefined, undefined, 'DISH_PUZZLE');
    let deadlockCount = 0;
    let blockedCount = 0;
    let dayFailedCount = 0;

    session.events.on('DISH_BOARD_DEADLOCKED', () => {
      deadlockCount++;
    });
    session.events.on('BOARD_BLOCKED', () => {
      blockedCount++;
    });
    session.events.on('DAY_FAILED', () => {
      dayFailedCount++;
    });

    const manager = session.dishPuzzleManager;
    // Clear initial pieces to construct deterministic deadlocked board
    for (const p of manager.getAllPieces()) {
      (manager as any)._gridCells[p.boardCoord.row][p.boardCoord.col] = null;
    }
    (manager as any)._pieces.clear();
    (manager as any)._groups.clear();

    const dishes = ['dish_salad', 'dish_breakfast', 'dish_ramen'];
    const instances = dishes.map(d => manager.createDishInstance(d));
    let instIdx = 0;

    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        if (!manager.isCellReserved(c, r)) {
          const inst = instances[instIdx % instances.length];
          instIdx++;
          const p = manager.createPiece(inst.instanceId, inst.dishId, 0, 0, { col: c, row: r });
          manager.createGroup([p]);
        }
      }
    }

    // Force deadlock check twice to verify exact-once idempotency
    session.checkBoardDangerAndDeadlock();
    session.checkBoardDangerAndDeadlock();

    assert.strictEqual(deadlockCount, 1, 'DISH_BOARD_DEADLOCKED must be emitted exactly once');
    assert.strictEqual(blockedCount, 1, 'BOARD_BLOCKED must be emitted exactly once');
    assert.strictEqual(dayFailedCount, 1, 'DAY_FAILED must be emitted exactly once');
    assert.strictEqual(session.isGameOver, true, 'session.isGameOver must be true upon deadlock');
  });
});
