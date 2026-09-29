import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameFlowManager,
  GameSession,
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

  it('should prevent presentation layer from blocking core resolution via authoritative fallback timer', async () => {
    const flow = new GameFlowManager();
    const session = flow.startDay(1, 'fallback_timer_seed');
    flow.beginPlaying();

    const manager = session.dishPuzzleManager;
    // Complete a 9-piece dish by creating all pieces in a group
    const saladInst = manager.createDishInstance('dish_salad');
    const pieces = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        // Place in cols 0..2, rows 6..8
        pieces.push(manager.createPiece(saladInst.instanceId, 'dish_salad', c, r, { col: c, row: r + 6 }));
      }
    }
    const group = manager.createGroup(pieces);

    let resolvingRequested = false;
    flow['handleDishCompletedResolving']({ groupId: group.groupId });
    assert.strictEqual(flow.phase, 'RESOLVING', 'Must transition to RESOLVING');

    // Presentation layer fails to call finishResolving()
    // Authoritative fallback timer should fire and resolve the completed dish
    await new Promise(resolve => setTimeout(resolve, 850));

    assert.ok(flow.phase === 'PLAYING' || flow.phase === 'DAY_CLEAR', 'Must transition out of RESOLVING authoritatively');
    assert.strictEqual(manager.getGroup(group.groupId), undefined, 'Completed group must be authoritatively cleared');
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
