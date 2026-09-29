import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DEFAULT_DAYS
} from '../src/index';

describe('Stage 5A Test Suite 4: DishPuzzle Action Cadence, Pressure, Danger & Recovery', () => {
  it('should enforce 1 legal move = 1 action drop supply cadence', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'cadence_seed', undefined, undefined, 'DISH_PUZZLE');
    const initialPieceCount = session.dishPuzzleManager.getAllPieces().length;
    assert.ok(initialPieceCount > 0);

    const group = session.dishPuzzleManager.getAllGroups()[0];
    const pieces = group.pieceIds.map(id => session.dishPuzzleManager.getPiece(id)!);
    const ref = pieces[0];

    // Legal move in-place
    const res = session.moveDishGroup(group.groupId, ref.boardCoord.col, ref.boardCoord.row, ref.pieceInstanceId);
    assert.strictEqual(res.success, true);

    // If move didn't merge or complete, piece supply cadence must trigger
    const postPieceCount = session.dishPuzzleManager.getAllPieces().length;
    assert.ok(postPieceCount >= initialPieceCount, 'Action cadence must replenish or maintain pieces');
    assert.strictEqual(session.stats.groupsMoved, 1);
  });

  it('should emit DISH_BOARD_DANGER when occupancy exceeds 0.65 or stack height >= 9', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'danger_threshold_seed', undefined, undefined, 'DISH_PUZZLE');
    let dangerFired = false;
    session.events.on('DISH_BOARD_DANGER', () => {
      dangerFired = true;
    });

    // Artificially stack pieces up to row 10 in col 0
    const inst = session.dishPuzzleManager.createDishInstance('dish_breakfast');
    for (let r = 0; r <= 10; r++) {
      if (!session.dishPuzzleManager.getPieceAt(0, r)) {
        session.dishPuzzleManager.createPiece(inst.instanceId, 'dish_breakfast', 0, 0, { col: 0, row: r });
      }
    }

    assert.ok(session.dishPuzzleManager.getMaxStackHeight() >= 9, 'Stack height must be >= 9');
    session.checkBoardDangerAndDeadlock();
    assert.strictEqual(dangerFired, true, 'DISH_BOARD_DANGER must be emitted when stack height >= 9');
    assert.strictEqual(session.stats.dangerEpisodes, 1);
  });

  it('should clear danger state (DISH_BOARD_DANGER_CLEARED) upon dish completion and reflow', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'recovery_seed', undefined, undefined, 'DISH_PUZZLE');
    const manager = session.dishPuzzleManager;

    // Trigger danger state
    const bInst = manager.createDishInstance('dish_breakfast');
    const dangerPieces = [];
    for (let r = 0; r <= 10; r++) {
      if (!manager.getPieceAt(0, r)) {
        dangerPieces.push(manager.createPiece(bInst.instanceId, 'dish_breakfast', 0, 0, { col: 0, row: r }));
      }
    }
    session.checkBoardDangerAndDeadlock();
    assert.strictEqual(session.isBoardInDanger(), true);

    let dangerClearedFired = false;
    session.events.on('DISH_BOARD_DANGER_CLEARED', () => {
      dangerClearedFired = true;
    });

    // Remove the high stack
    for (const p of dangerPieces) {
      manager['_pieces'].delete(p.pieceInstanceId);
      manager['_gridCells'][p.boardCoord.row][p.boardCoord.col] = null;
    }

    // Now complete and resolve a dish
    const sInst = manager.createDishInstance('dish_salad');
    const completePieces = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        completePieces.push(manager.createPiece(sInst.instanceId, 'dish_salad', c, r, { col: c + 1, row: r + 3 }));
      }
    }
    const compGroup = manager.createGroup(completePieces);
    compGroup.isComplete = true;

    session.resolveCompletedDish(compGroup.groupId);

    assert.strictEqual(dangerClearedFired, true, 'DISH_BOARD_DANGER_CLEARED must be emitted on recovery');
    assert.strictEqual(session.isBoardInDanger(), false);
  });
});
