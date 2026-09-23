import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GameSession,
  BoardGrid,
  DiscreteGravity,
  PrepInventory,
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

describe('BoardGrid and DiscreteGravity', () => {
  it('should settle suspended objects down to row 0', () => {
    const grid = new BoardGrid();
    const targetDef = DEFAULT_INGREDIENTS['tomato'];

    const target = {
      instanceId: 't1',
      ingredientId: 'tomato',
      anchor: { col: 2, row: 5 },
      occupiedCoords: targetDef.footprint.map(f => ({ col: 2 + f.col, row: 5 + f.row })),
      placedSlotIds: [],
      missingSlotIds: targetDef.slots.map(s => s.slotId),
      pieceReleasePlan: {},
      ageTurns: 0
    };

    grid.occupyTarget(target);
    assert.strictEqual(target.anchor.row, 5);

    const settleResult = DiscreteGravity.settle(grid);
    assert.strictEqual(settleResult.hasMoved, true);
    assert.strictEqual(target.anchor.row, 0); // Settled to bottom!
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

describe('GameSession Lifecycle & Placement', () => {
  it('should initialize board with targets and loose pieces', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 42);
    const state = session.getState();

    assert.strictEqual(state.dayNumber, 1);
    assert.strictEqual(state.businessGoal, 400);
    assert.strictEqual(state.currentRevenue, 0);
    assert.strictEqual(state.targets.length, DEFAULT_DAYS[0].targetIngredientCount);
    assert.ok(state.loosePieces.length >= DEFAULT_DAYS[0].loosePieceComfortMin);
    assert.ok(state.currentOrder !== null);
  });

  it('should correctly place a matching loose piece and advance progress', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 42);
    const state = session.getState();
    const firstPiece = state.loosePieces[0];

    const result = session.placePiece(
      firstPiece.instanceId,
      firstPiece.targetInstanceId,
      firstPiece.slotId
    );

    assert.strictEqual(result.success, true);
    const updatedTarget = session.grid.getTarget(firstPiece.targetInstanceId);
    assert.ok(updatedTarget?.placedSlotIds.includes(firstPiece.slotId));
  });

  it('should reject invalid / mismatched placement and bounce back', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 42);
    const state = session.getState();
    const firstPiece = state.loosePieces[0];

    const result = session.placePiece(
      firstPiece.instanceId,
      'invalid_target_id',
      'invalid_slot'
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'TARGET_NOT_FOUND');
  });
});
