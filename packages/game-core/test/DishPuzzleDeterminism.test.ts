import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import {
  GameSession,
  DEFAULT_DAYS
} from '../src/index';

/**
 * Computes a deterministic SHA-256 state hash across all core gameplay elements:
 * - pieces (id, dishInstance, slot, coord, group)
 * - groups (id, dishId, instanceId, isComplete, sorted member ids)
 * - active dish instances (id, dishId, isCompleted, sorted spawned slots)
 * - current order
 * - next order
 * - prepared buffer
 * - revenue
 * - stats
 * - RNG / scheduler state
 * - game phase
 */
export function computeSessionStateHash(session: GameSession, phase: string = 'PLAYING'): string {
  const pieces = session.dishPuzzleManager.getAllPieces()
    .sort((a, b) => a.pieceInstanceId.localeCompare(b.pieceInstanceId))
    .map(p => ({
      id: p.pieceInstanceId,
      dishInstance: p.dishPuzzleInstanceId,
      slot: p.slotId,
      col: p.boardCoord.col,
      row: p.boardCoord.row,
      group: p.groupId
    }));

  const groups = session.dishPuzzleManager.getAllGroups()
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
    .map(g => ({
      id: g.groupId,
      dishId: g.dishId,
      instanceId: g.dishPuzzleInstanceId,
      isComplete: g.isComplete,
      pieces: [...g.pieceIds].sort()
    }));

  const activeInstances = session.dishPuzzleManager.getAllInstances()
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
    .map(inst => ({
      id: inst.instanceId,
      dishId: inst.dishId,
      isCompleted: inst.isCompleted,
      spawnedSlots: Array.from(inst.spawnedSlots).sort()
    }));

  const currentOrder = session.orderSystem.currentOrder ? {
    orderId: session.orderSystem.currentOrder.orderId,
    dishId: session.orderSystem.currentOrder.dishId,
    isFulfilled: session.orderSystem.currentOrder.isFulfilled
  } : null;

  const nextOrder = session.orderSystem.getNextOrderFact() ? {
    orderId: session.orderSystem.getNextOrderFact()!.orderId,
    dishId: session.orderSystem.getNextOrderFact()!.dishId
  } : null;

  const statePayload = {
    pieces,
    groups,
    activeInstances,
    currentOrder,
    nextOrder,
    preparedBuffer: [...session.orderSystem.preparedDishBuffer],
    revenue: session.revenue,
    stats: session.stats,
    rngState: (session as any)._rng?.getState?.() || '',
    gamePhase: phase
  };

  return crypto.createHash('sha256').update(JSON.stringify(statePayload)).digest('hex');
}

describe('Stage 5A Test Suite 2: DishPuzzle Full Determinism Across Seeds', () => {
  it('should produce identical SHA-256 state hashes for identical seeds', () => {
    const seed = 'determinism_gold_seed_42';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');
    const s2 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');

    const hash1 = computeSessionStateHash(s1);
    const hash2 = computeSessionStateHash(s2);

    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64, 'Must be valid 64-char hex SHA-256');
    assert.strictEqual(hash1, hash2, 'Initial state hashes must match byte-for-byte across identical seeds');

    // Different seed produces different hash
    const sDiff = new GameSession(DEFAULT_DAYS[0], 'different_seed_999', undefined, undefined, 'DISH_PUZZLE');
    const hashDiff = computeSessionStateHash(sDiff);
    assert.notStrictEqual(hash1, hashDiff, 'Different seeds must produce different state hashes');
  });

  it('should maintain 100% identical state hashes at every step across identical action sequences', () => {
    const seed = 'deterministic_trajectory_seed_99';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');
    const s2 = new GameSession(DEFAULT_DAYS[0], seed, undefined, undefined, 'DISH_PUZZLE');

    // Initial state hash check
    const initialHash1 = computeSessionStateHash(s1);
    const initialHash2 = computeSessionStateHash(s2);
    assert.strictEqual(initialHash1, initialHash2, 'Step 0 state hash must match');

    // Sequence of 5 deterministic actions
    const moves = [
      { deltaC: 0, deltaR: 0 },
      { deltaC: 0, deltaR: 0 },
      { deltaC: 0, deltaR: 0 },
      { deltaC: 0, deltaR: 0 },
      { deltaC: 0, deltaR: 0 }
    ];

    for (let step = 0; step < moves.length; step++) {
      const g1 = s1.dishPuzzleManager.getAllGroups()[step % s1.dishPuzzleManager.getAllGroups().length];
      const g2 = s2.dishPuzzleManager.getAllGroups()[step % s2.dishPuzzleManager.getAllGroups().length];

      const ref1 = s1.dishPuzzleManager.getPiece(g1.pieceIds[0])!;
      const ref2 = s2.dishPuzzleManager.getPiece(g2.pieceIds[0])!;

      const res1 = s1.moveDishGroup(g1.groupId, ref1.boardCoord.col + moves[step].deltaC, ref1.boardCoord.row + moves[step].deltaR, ref1.pieceInstanceId);
      const res2 = s2.moveDishGroup(g2.groupId, ref2.boardCoord.col + moves[step].deltaC, ref2.boardCoord.row + moves[step].deltaR, ref2.pieceInstanceId);

      assert.strictEqual(res1.success, res2.success);

      const stepHash1 = computeSessionStateHash(s1);
      const stepHash2 = computeSessionStateHash(s2);

      assert.strictEqual(stepHash1, stepHash2, `Step ${step + 1} state hash must match identically`);
    }
  });
});
