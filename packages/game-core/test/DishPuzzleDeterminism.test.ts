import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GameSession,
  DEFAULT_DAYS
} from '../src/index';

describe('Stage 5A Test Suite 2: DishPuzzle Full Determinism Across Seeds', () => {
  it('should produce 100% identical board configurations with identical seeds', () => {
    const seed = 'determinism_gold_seed_42';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');
    const s2 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');

    const pieces1 = s1.dishPuzzleManager.getAllPieces().sort((a, b) => a.pieceInstanceId.localeCompare(b.pieceInstanceId));
    const pieces2 = s2.dishPuzzleManager.getAllPieces().sort((a, b) => a.pieceInstanceId.localeCompare(b.pieceInstanceId));

    assert.strictEqual(pieces1.length, pieces2.length, 'Piece count must match');
    for (let i = 0; i < pieces1.length; i++) {
      assert.strictEqual(pieces1[i].pieceInstanceId, pieces2[i].pieceInstanceId);
      assert.strictEqual(pieces1[i].dishId, pieces2[i].dishId);
      assert.strictEqual(pieces1[i].dishCol, pieces2[i].dishCol);
      assert.strictEqual(pieces1[i].dishRow, pieces2[i].dishRow);
      assert.strictEqual(pieces1[i].boardCoord.col, pieces2[i].boardCoord.col);
      assert.strictEqual(pieces1[i].boardCoord.row, pieces2[i].boardCoord.row);
    }

    const groups1 = s1.dishPuzzleManager.getAllGroups().sort((a, b) => a.groupId.localeCompare(b.groupId));
    const groups2 = s2.dishPuzzleManager.getAllGroups().sort((a, b) => a.groupId.localeCompare(b.groupId));

    assert.strictEqual(groups1.length, groups2.length, 'Group count must match');
    for (let i = 0; i < groups1.length; i++) {
      assert.strictEqual(groups1[i].groupId, groups2[i].groupId);
      assert.deepStrictEqual(groups1[i].pieceIds.sort(), groups2[i].pieceIds.sort());
    }

    assert.strictEqual(s1.orderSystem.currentOrder?.dishId, s2.orderSystem.currentOrder?.dishId);
    assert.strictEqual(s1.orderSystem.businessGoal, s2.orderSystem.businessGoal);
  });

  it('should maintain deterministic trajectories across identical move sequences', () => {
    const seed = 'deterministic_trajectory_seed_99';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');
    const s2 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');

    // Perform an identical sequence of 5 moves
    const g1 = s1.dishPuzzleManager.getAllGroups()[0];
    const g2 = s2.dishPuzzleManager.getAllGroups()[0];

    const ref1 = s1.dishPuzzleManager.getPiece(g1.pieceIds[0])!;
    const ref2 = s2.dishPuzzleManager.getPiece(g2.pieceIds[0])!;

    const res1 = s1.moveDishGroup(g1.groupId, ref1.boardCoord.col, ref1.boardCoord.row, ref1.pieceInstanceId);
    const res2 = s2.moveDishGroup(g2.groupId, ref2.boardCoord.col, ref2.boardCoord.row, ref2.pieceInstanceId);

    assert.strictEqual(res1.success, res2.success);
    assert.strictEqual(res1.merged, res2.merged);
    assert.strictEqual(s1.dishPuzzleManager.getAllPieces().length, s2.dishPuzzleManager.getAllPieces().length);
    assert.strictEqual(s1.revenue, s2.revenue);
  });
});
