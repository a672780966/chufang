import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameFlowManager,
  GameSession,
  DishPuzzleManager,
  DEFAULT_DAYS
} from '../src/index';

describe('Stage 5A Test Suite 1: DishPuzzle Core Authority', () => {
  it('should establish DishPuzzle as sole gameplay authority and route player moves through GameFlowManager', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'authority_seed_1');

    assert.strictEqual(session.gameplayMode, 'DISH_PUZZLE', 'Gameplay mode must be DISH_PUZZLE');
    assert.strictEqual(flow.phase, 'DAY_INTRO');

    // Input must be locked during DAY_INTRO
    const preMove = flow.moveDishGroup('any_group', 0, 0);
    assert.strictEqual(preMove.success, false);
    assert.strictEqual(preMove.reason, 'INPUT_LOCKED');

    // Begin playing
    flow.beginPlaying();
    assert.strictEqual(flow.phase, 'PLAYING');
    assert.strictEqual(flow.isInputLocked, false);

    // Initial state: board has groups, legacy targets must be 0
    assert.strictEqual(session.grid.getAllTargets().length, 0, 'No legacy ingredient targets in DISH_PUZZLE mode');
    assert.strictEqual(session.grid.getAllLoosePieces().length, 0, 'No legacy loose pieces in DISH_PUZZLE mode');

    const groups = session.dishPuzzleManager.getAllGroups();
    assert.ok(groups.length > 0, 'Must have active dish groups');

    // Execute legal group move through Flow
    const saladGroup = groups.find(g => g.dishId === 'dish_salad')!;
    const pieces = saladGroup.pieceIds.map(id => session.dishPuzzleManager.getPiece(id)!);
    const refPiece = pieces[0];

    // Find a legal delta
    const res = flow.moveDishGroup(saladGroup.groupId, refPiece.boardCoord.col, refPiece.boardCoord.row, refPiece.pieceInstanceId);
    assert.strictEqual(res.success, true, 'Moving group in-place must succeed');
    assert.strictEqual(session.stats.groupsMoved, 1);
  });

  it('should synchronously commit dish resolution in core upon completion and lock input without wall-clock timer', () => {
    let resolvingDuration: number | null = null;
    const flow = new GameFlowManager({
      onResolvingRequested: (durationMs) => {
        resolvingDuration = durationMs;
      }
    });
    const session = flow.startDay(1, 'sync_auth_seed');
    flow.beginPlaying();

    const manager = session.dishPuzzleManager;
    // Complete a 9-piece dish by snapping pieces together
    const saladInst = manager.createDishInstance('dish_salad');
    // Group 1: 8 pieces
    const pieces1 = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (c === 2 && r === 2) continue; // leave (2,2) empty
        pieces1.push(manager.createPiece(saladInst.instanceId, 'dish_salad', c, r, { col: c, row: r + 6 }));
      }
    }
    const group1 = manager.createGroup(pieces1);

    // Group 2: remaining 1 piece at (3, 8)
    const p9 = manager.createPiece(saladInst.instanceId, 'dish_salad', 2, 2, { col: 3, row: 8 });
    const group2 = manager.createGroup([p9]);

    // Move group 2 to (2, 8) to snap and complete 9 pieces!
    const moveRes = flow.moveDishGroup(group2.groupId, 2, 8, p9.pieceInstanceId);
    assert.strictEqual(moveRes.success, true);
    assert.strictEqual(moveRes.merged, true);
    assert.ok(moveRes.completedDish, 'Move must complete the dish');

    // Verify Core synchronously and immediately cleared the completed dish from the board!
    assert.strictEqual(manager.getGroup(group1.groupId), undefined, 'Completed group must be cleared immediately from board');
    assert.strictEqual(manager.getGroup(group2.groupId), undefined, 'Merged group must be cleared immediately from board');
    assert.strictEqual(manager.getPiece(p9.pieceInstanceId), undefined, 'Pieces of completed dish must be removed');

    // Revenue and dishes served are immediately recorded by Core
    assert.ok(session.revenue > 0, 'Revenue must be updated synchronously');
    assert.strictEqual(session.stats.dishesCompleted, 1);
    assert.strictEqual(session.stats.dishesServed, 1);

    // Presentation input is locked in RESOLVING phase
    assert.strictEqual(flow.phase, 'RESOLVING', 'Flow must be in RESOLVING phase');
    assert.strictEqual(flow.isInputLocked, true, 'Input must be locked during RESOLVING');
    assert.strictEqual(resolvingDuration, 650, 'Must request 650ms resolving animation window');

    // Presentation notifies flow when animation finishes
    flow.finishResolving();
    assert.strictEqual(flow.phase, 'PLAYING', 'Flow must return to PLAYING after finishResolving');
    assert.strictEqual(flow.isInputLocked, false, 'Input must be unlocked');
  });

  it('should fail-fast and throw Error on unknown dishId in DishPuzzleManager or OrderBag', () => {
    const manager = new DishPuzzleManager(8, 12);
    assert.throws(
      () => manager.createDishInstance('dish_burger'),
      /not found in DISH_MANIFEST/,
      'Must throw Error for non-existent dish_burger'
    );
    assert.throws(
      () => manager.createPiece('inst_1', 'dish_burger', 0, 0, { col: 0, row: 0 }),
      /invalid dishId/,
      'Must throw Error for invalid piece dishId'
    );
  });

  it('should ensure Core authoritatively controls state transitions without relying on UI callbacks', () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'lifecycle_auth_seed');
    flow.beginPlaying();

    assert.strictEqual(flow.phase, 'PLAYING');

    // Pause / Resume
    flow.pauseGame();
    assert.strictEqual(flow.phase, 'PAUSED');
    assert.strictEqual(flow.isInputLocked, true);

    flow.resumeGame();
    assert.strictEqual(flow.phase, 'PLAYING');
    assert.strictEqual(flow.isInputLocked, false);
  });
});
