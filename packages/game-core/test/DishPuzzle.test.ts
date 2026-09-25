import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DishPuzzleManager,
  arePiecesDishAdjacent,
  arePiecesGeometricallyAligned,
  generateDishSlotEdges,
  GOLD_SAMPLE_DISH_MANIFEST
} from '../src/index';

describe('DishPuzzle Domain Model & Adjacency Engine', () => {
  it('should verify Gold Sample Dish Manifest integrity and SHA256 hashes', () => {
    const dishIds = Object.keys(GOLD_SAMPLE_DISH_MANIFEST);
    assert.strictEqual(dishIds.length, 3, 'Must have exactly 3 Gold Sample dishes');
    assert.ok(dishIds.includes('dish_breakfast'));
    assert.ok(dishIds.includes('dish_salad'));
    assert.ok(dishIds.includes('dish_ramen'));

    for (const [id, entry] of Object.entries(GOLD_SAMPLE_DISH_MANIFEST)) {
      assert.strictEqual(entry.dishId, id);
      assert.ok(entry.name);
      assert.ok(entry.generationPrompt.length > 50, 'Prompt must be comprehensive');
      assert.ok(entry.constraints.length >= 4, 'Must list production constraints');
      assert.strictEqual(entry.puzzleRowsCols.rows, 3);
      assert.strictEqual(entry.puzzleRowsCols.cols, 3);
      assert.strictEqual(entry.totalPieces, 9);
      assert.ok(entry.approvedHash, 'Must have approved SHA256 hash');
      assert.strictEqual(entry.approvedHash.length, 64, 'SHA256 hash must be 64 characters');
    }
  });

  it('should calculate orthogonal dish adjacency and geometric board alignment correctly', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_salad');

    const p00 = manager.createPiece(inst.instanceId, 'dish_salad', 0, 0, { col: 2, row: 2 });
    const p10 = manager.createPiece(inst.instanceId, 'dish_salad', 1, 0, { col: 3, row: 2 });
    const p01 = manager.createPiece(inst.instanceId, 'dish_salad', 0, 1, { col: 2, row: 3 });
    const p11 = manager.createPiece(inst.instanceId, 'dish_salad', 1, 1, { col: 3, row: 3 });
    const p22 = manager.createPiece(inst.instanceId, 'dish_salad', 2, 2, { col: 4, row: 4 });

    // Orthogonal dish adjacency
    assert.ok(arePiecesDishAdjacent(p00, p10), '(0,0) and (1,0) are dish adjacent horizontally');
    assert.ok(arePiecesDishAdjacent(p00, p01), '(0,0) and (0,1) are dish adjacent vertically');
    assert.ok(!arePiecesDishAdjacent(p00, p11), '(0,0) and (1,1) are diagonal, not dish adjacent');
    assert.ok(!arePiecesDishAdjacent(p00, p22), '(0,0) and (2,2) are distant');

    // Geometric alignment on board
    assert.ok(arePiecesGeometricallyAligned(p00, p10), 'p10 is at board delta (+1, 0) matching dish delta (+1, 0)');
    assert.ok(arePiecesGeometricallyAligned(p00, p01), 'p01 is at board delta (0, +1) matching dish delta (0, +1)');

    // Shift p10 to wrong offset
    p10.boardCoord = { col: 5, row: 5 };
    assert.ok(!arePiecesGeometricallyAligned(p00, p10), 'p10 at wrong board delta is not geometrically aligned');
  });

  it('should generate complementary jigsaw edges for interior and exterior slots', () => {
    const e00 = generateDishSlotEdges(0, 0, 3, 3);
    assert.strictEqual(e00.bottom, 'flat', 'Bottom of (0,0) is outer edge');
    assert.strictEqual(e00.left, 'flat', 'Left of (0,0) is outer edge');

    const e10 = generateDishSlotEdges(1, 0, 3, 3);
    assert.strictEqual(e10.bottom, 'flat', 'Bottom of (1,0) is outer edge');

    // Edge complementarity across (0,0) right and (1,0) left
    assert.notStrictEqual(e00.right, e10.left, 'Right of (0,0) and left of (1,0) must be complementary (tab vs blank)');
    assert.ok(
      (e00.right === 'tab' && e10.left === 'blank') || (e00.right === 'blank' && e10.left === 'tab'),
      'Must have complementary tab/blank pair'
    );
  });

  it('should initialize Day 1 board layout with all 3 dishes and connected groups', () => {
    const manager = new DishPuzzleManager(8, 12);
    manager.initDay1Layout();

    const pieces = manager.getAllPieces();
    assert.ok(pieces.length >= 10, 'Must have active pieces from all 3 dishes');

    const saladPieces = pieces.filter(p => p.dishId === 'dish_salad');
    const breakfastPieces = pieces.filter(p => p.dishId === 'dish_breakfast');
    const ramenPieces = pieces.filter(p => p.dishId === 'dish_ramen');

    assert.ok(saladPieces.length > 0, 'Must contain Salad pieces');
    assert.ok(breakfastPieces.length > 0, 'Must contain Breakfast pieces');
    assert.ok(ramenPieces.length > 0, 'Must contain Ramen pieces');

    const groups = manager.getAllGroups();
    const multiPieceGroups = groups.filter(g => g.pieceIds.length > 1);
    assert.ok(multiPieceGroups.length >= 2, 'Day 1 layout must include pre-connected groups');
  });

  it('should rigidly move a multi-piece group and snap to matching adjacent piece', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_salad');

    // Place p(0,0) at (0,0) in group 1
    const p00 = manager.createPiece(inst.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const g1 = manager.createGroup([p00]);

    // Place p(1,0) at (5,5) in group 2
    const p10 = manager.createPiece(inst.instanceId, 'dish_salad', 1, 0, { col: 5, row: 5 });
    const g2 = manager.createGroup([p10]);

    assert.strictEqual(manager.getAllGroups().length, 2);

    // Move g2 to (1,0) - directly adjacent to p00 at (0,0)
    const moveResult = manager.tryMoveGroup(g2.groupId, 1, 0, p10.pieceInstanceId);
    assert.ok(moveResult.success, 'Move should succeed');
    assert.ok(moveResult.merged, 'Group should merge with p00 on adjacency snap');

    // Now there should only be 1 group containing 2 pieces
    const remainingGroups = manager.getAllGroups();
    assert.strictEqual(remainingGroups.length, 1);
    assert.strictEqual(remainingGroups[0].pieceIds.length, 2);
    assert.strictEqual(p00.groupId, p10.groupId);
  });

  it('should prevent pieces from different dishes from snapping together', () => {
    const manager = new DishPuzzleManager(8, 12);
    const salad = manager.createDishInstance('dish_salad');
    const ramen = manager.createDishInstance('dish_ramen');

    const s00 = manager.createPiece(salad.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const r10 = manager.createPiece(ramen.instanceId, 'dish_ramen', 1, 0, { col: 5, row: 5 });

    manager.createGroup([s00]);
    const rGroup = manager.createGroup([r10]);

    // Move Ramen piece right next to Salad piece at (1,0)
    const moveResult = manager.tryMoveGroup(rGroup.groupId, 1, 0);
    assert.ok(moveResult.success);
    assert.ok(!moveResult.merged, 'Salad and Ramen pieces must NEVER merge');
    assert.strictEqual(manager.getAllGroups().length, 2);
  });

  it('should detect 9-piece dish completion, emit event, and clear board', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_breakfast');

    let completedEventFired = false;
    manager.events.on('DISH_COMPLETED', (payload: any) => {
      completedEventFired = true;
      assert.strictEqual(payload.dishId, 'dish_breakfast');
      assert.strictEqual(payload.pieces.length, 9);
    });

    let clearedEventFired = false;
    manager.events.on('DISH_CLEARED', (payload: any) => {
      clearedEventFired = true;
      assert.strictEqual(payload.dishId, 'dish_breakfast');
    });

    // Create 8 pieces already together
    const pieces: any[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (c === 2 && r === 2) continue; // Leave (2,2) missing
        const p = manager.createPiece(inst.instanceId, 'dish_breakfast', c, r, { col: c, row: r });
        pieces.push(p);
      }
    }
    const mainGroup = manager.createGroup(pieces);

    // Place the 9th piece at (5,5)
    const p22 = manager.createPiece(inst.instanceId, 'dish_breakfast', 2, 2, { col: 5, row: 5 });
    const g9 = manager.createGroup([p22]);

    // Move 9th piece to (2,2) completing the 3x3 dish
    const res = manager.tryMoveGroup(g9.groupId, 2, 2);
    assert.ok(res.success);
    assert.ok(res.merged);
    assert.ok(res.completedDish);
    assert.ok(completedEventFired, 'DISH_COMPLETED event must fire');

    // Clear the completed dish
    manager.clearCompletedGroup(p22.groupId);
    assert.ok(clearedEventFired, 'DISH_CLEARED event must fire');
    assert.strictEqual(manager.getAllPieces().length, 0, 'Board should have all 9 pieces cleared');
  });
});
