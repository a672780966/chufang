import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DishPuzzleManager
} from '../src/index';

describe('Stage 5A Test Suite 6: DishPuzzle Cat 3x3 Reserved Region Geometry & Immunity', () => {
  it('should verify exact reserved region geometry: 87 playable cells out of 96', () => {
    const manager = new DishPuzzleManager(8, 12);
    assert.strictEqual(manager.columns, 8);
    assert.strictEqual(manager.rows, 12);
    assert.strictEqual(manager.getPlayableCellCount(), 87, 'Must have 87 playable cells (96 - 9)');

    let reservedCount = 0;
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        if (manager.isCellReserved(c, r)) {
          reservedCount++;
          assert.ok(c >= 5 && c <= 7, `Reserved col must be 5..7, got ${c}`);
          assert.ok(r >= 0 && r <= 2, `Reserved row must be 0..2, got ${r}`);
        }
      }
    }
    assert.strictEqual(reservedCount, 9, 'Must have exactly 9 reserved cells');
  });

  it('should strictly reject player group moves that intersect the 3x3 reserved region', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_salad');

    // Create a 2x2 group at (0, 0)
    const p0 = manager.createPiece(inst.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const p1 = manager.createPiece(inst.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
    const p2 = manager.createPiece(inst.instanceId, 'dish_salad', 0, 1, { col: 0, row: 1 });
    const p3 = manager.createPiece(inst.instanceId, 'dish_salad', 1, 1, { col: 1, row: 1 });
    const group = manager.createGroup([p0, p1, p2, p3]);

    // Attempt to move to col 5, row 0 (intersecting cat reserved region)
    const res = manager.tryMoveGroup(group.groupId, 5, 0, p0.pieceInstanceId);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'CELL_RESERVED', 'Must reject move into reserved cells');

    // Board coord must remain unchanged
    assert.strictEqual(p0.boardCoord.col, 0);
    assert.strictEqual(p0.boardCoord.row, 0);
  });

  it('should block downward gravity settling from entering the 3x3 reserved region', () => {
    const manager = new DishPuzzleManager(8, 12);
    const inst = manager.createDishInstance('dish_breakfast');

    // Place a piece at col 6, row 5 (above the reserved region)
    const p = manager.createPiece(inst.instanceId, 'dish_breakfast', 0, 0, { col: 6, row: 5 });
    const group = manager.createGroup([p]);

    // Apply gravity
    manager.applyGravity();

    // Piece must rest on row 3 (just above the reserved region row 0..2)
    assert.strictEqual(p.boardCoord.col, 6);
    assert.strictEqual(p.boardCoord.row, 3, 'Gravity must halt at row 3 above reserved region');
    assert.strictEqual(manager.isCellReserved(p.boardCoord.col, p.boardCoord.row), false);
  });
});
