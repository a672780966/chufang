import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GameSession,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  BoardGrid,
  LoosePiece,
  DiscreteGravity
} from '../src/index.js';
import { SimulationRunner } from '../../simulation/src/SimulationRunner.js';

describe('Stage 1 Strong Assertions: Target-First Instance Binding & Zero Orphan Pieces', () => {
  it('should enforce that all LoosePieces on board strictly have non-empty targetInstanceId matching active target', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'test_instance_binding_seed');
    const loosePieces = session.grid.getAllLoosePieces();
    const targets = session.grid.getAllTargets();

    assert.ok(loosePieces.length > 0, 'Must have initial loose pieces');
    for (const piece of loosePieces) {
      assert.ok(piece.targetInstanceId, `Piece ${piece.instanceId} must have non-empty targetInstanceId`);
      const target = session.grid.getTarget(piece.targetInstanceId);
      assert.ok(target, `Piece ${piece.instanceId} targetInstanceId ${piece.targetInstanceId} must exist on board`);
      assert.strictEqual(piece.ingredientId, target.ingredientId, 'Piece ingredient must match target ingredient');
    }
  });

  it('should strictly reject placing a piece into a different target instance even if ingredient and slotId match', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'cross_target_test');
    const grid = session.grid;

    // Clear board and manually occupy two distinct targets of the same ingredient (bread)
    for (const t of grid.getAllTargets()) grid.removeTarget(t.instanceId);
    for (const p of grid.getAllLoosePieces()) grid.removeLoosePiece(p.instanceId);

    const t1: any = {
      instanceId: 'target_bread_T1',
      ingredientId: 'bread',
      anchor: { col: 0, row: 0 },
      occupiedCoords: [
        { col: 0, row: 0 }, { col: 1, row: 0 },
        { col: 0, row: 1 }, { col: 1, row: 1 }
      ],
      placedSlotIds: [] as string[],
      missingSlotIds: ['b_0', 'b_1', 'b_2', 'b_3'],
      pieceReleasePlan: { b_0: 'normal', b_1: 'normal', b_2: 'normal', b_3: 'closure' },
      ageTurns: 0
    };
    const t2: any = {
      instanceId: 'target_bread_T2',
      ingredientId: 'bread',
      anchor: { col: 4, row: 0 },
      occupiedCoords: [
        { col: 4, row: 0 }, { col: 5, row: 0 },
        { col: 4, row: 1 }, { col: 5, row: 1 }
      ],
      placedSlotIds: [] as string[],
      missingSlotIds: ['b_0', 'b_1', 'b_2', 'b_3'],
      pieceReleasePlan: { b_0: 'normal', b_1: 'normal', b_2: 'normal', b_3: 'closure' },
      ageTurns: 0
    };
    grid.occupyTarget(t1);
    grid.occupyTarget(t2);

    // Create a loose piece explicitly bound to T1
    const p1: LoosePiece = {
      instanceId: 'piece_b0_for_T1',
      ingredientId: 'bread',
      targetInstanceId: 'target_bread_T1',
      slotId: 'b_0',
      coord: { col: 2, row: 0 }
    };
    grid.occupyLoosePiece(p1);

    // Attempt to place p1 into T2 (same ingredient 'bread', same slot 'b_0', but wrong targetInstanceId)
    const crossRes = session.placePiece(p1.instanceId, t2.instanceId, 'b_0');
    assert.strictEqual(crossRes.success, false, 'Cross-target placement must be rejected');
    assert.strictEqual(crossRes.reason, 'MISMATCH', 'Failure reason must be MISMATCH');

    // Attempt to place p1 into bound target T1
    const correctRes = session.placePiece(p1.instanceId, t1.instanceId, 'b_0');
    assert.strictEqual(correctRes.success, true, 'Placement into bound target instance must succeed');
    assert.ok(t1.placedSlotIds.includes('b_0'), 'T1 must now contain slot b_0');
  });
});

describe('Stage 1 Strong Assertions: Spatial Pressure Accumulation & Pacing', () => {
  it('consecutive non-clear operations must cause net occupancy or stack height to grow', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'pressure_accum_seed');
    const initialOccupied = session.grid.getOccupiedCellCount();
    const initialHeight = session.grid.getMaxStackHeight();

    // Make consecutive placements that do not complete any ingredient
    let nonClearMoves = 0;
    for (let step = 0; step < 10; step++) {
      const targets = session.grid.getAllTargets();
      const loose = session.grid.getAllLoosePieces();
      let moved = false;

      for (const p of loose) {
        const t = targets.find(target => target.instanceId === p.targetInstanceId);
        // Pick move on target with > 2 missing slots so it won't complete
        if (t && t.missingSlotIds.includes(p.slotId) && t.missingSlotIds.length > 2) {
          const res = session.placePiece(p.instanceId, t.instanceId, p.slotId);
          if (res.success) {
            moved = true;
            nonClearMoves++;
            break;
          }
        }
      }

      if (!moved) break;
      if (nonClearMoves >= 5) break;
    }

    const currentOccupied = session.grid.getOccupiedCellCount();
    const currentHeight = session.grid.getMaxStackHeight();

    assert.ok(
      currentOccupied > initialOccupied || currentHeight > initialHeight,
      `Occupancy (${currentOccupied} vs ${initialOccupied}) or stack height (${currentHeight} vs ${initialHeight}) must grow after ${nonClearMoves} non-clear operations`
    );
  });
});

describe('Stage 1 Strong Assertions: Measurable Spatial Release on Ingredient Completion', () => {
  it('Ingredient Completion must cause measurable space release on the board', () => {
    const session = new GameSession(DEFAULT_DAYS[0], 'completion_release_seed');
    const grid = session.grid;

    // Find an active target
    const target = grid.getAllTargets()[0];
    assert.ok(target, 'Must have an active target');
    const targetFootprintSize = target.occupiedCoords.length;
    assert.ok(targetFootprintSize >= 4, 'Target footprint must occupy at least 4 cells');

    let removedEventPayload: any = null;
    session.events.on('INGREDIENT_REMOVED', (p) => {
      removedEventPayload = p;
    });

    // Fill all missing slots except the last one
    while (target.missingSlotIds.length > 1) {
      const slotId = target.missingSlotIds[0];
      target.placedSlotIds.push(slotId);
      target.missingSlotIds = target.missingSlotIds.filter(s => s !== slotId);
    }

    const lastSlotId = target.missingSlotIds[0];

    // Spawn a loose piece bound to this target for the last slot
    const closingPiece: LoosePiece = {
      instanceId: 'closing_piece_test',
      ingredientId: target.ingredientId,
      targetInstanceId: target.instanceId,
      slotId: lastSlotId,
      coord: { col: 0, row: grid.totalRows - 1 }
    };
    grid.occupyLoosePiece(closingPiece);
    DiscreteGravity.settle(grid);

    // Place the final piece to trigger completion
    const res = session.placePiece(closingPiece.instanceId, target.instanceId, lastSlotId);
    assert.strictEqual(res.success, true);

    // Verify that INGREDIENT_REMOVED event was emitted with all released coordinates
    assert.ok(removedEventPayload, 'INGREDIENT_REMOVED event must be emitted on completion');
    assert.strictEqual(
      removedEventPayload.releasedCoords.length,
      targetFootprintSize,
      `INGREDIENT_REMOVED must release all ${targetFootprintSize} cells of the target footprint`
    );
    assert.strictEqual(removedEventPayload.targetInstanceId, target.instanceId);
  });
});

describe('Stage 1 Strong Assertions: Full Determinism Across Identical Seeds', () => {
  it('same seed must produce 100% identical trajectory at every step', () => {
    const seed = 'deterministic_run_seed_42';
    const s1 = new GameSession(DEFAULT_DAYS[0], seed);
    const s2 = new GameSession(DEFAULT_DAYS[0], seed);

    for (let step = 0; step < 8; step++) {
      const loose1 = s1.grid.getAllLoosePieces();
      const targets1 = s1.grid.getAllTargets();
      const loose2 = s2.grid.getAllLoosePieces();
      const targets2 = s2.grid.getAllTargets();

      assert.strictEqual(loose1.length, loose2.length, `Loose piece count must match at step ${step}`);
      assert.strictEqual(targets1.length, targets2.length, `Target count must match at step ${step}`);

      // Verify all coords match
      for (let i = 0; i < loose1.length; i++) {
        assert.deepStrictEqual(loose1[i].coord, loose2[i].coord, `Loose piece coord mismatch at step ${step}`);
        assert.strictEqual(loose1[i].targetInstanceId, loose2[i].targetInstanceId);
      }

      // Pick the first legal move available on both
      let move1: { p: LoosePiece; t: any } | null = null;
      for (const p of loose1) {
        const t = targets1.find(target => target.instanceId === p.targetInstanceId);
        if (t && t.missingSlotIds.includes(p.slotId)) {
          move1 = { p, t };
          break;
        }
      }

      if (!move1) break;

      const res1 = s1.placePiece(move1.p.instanceId, move1.t.instanceId, move1.p.slotId);
      const res2 = s2.placePiece(move1.p.instanceId, move1.t.instanceId, move1.p.slotId);

      assert.strictEqual(res1.success, res2.success);
      assert.strictEqual(s1.grid.getOccupiedCellCount(), s2.grid.getOccupiedCellCount());
      assert.strictEqual(s1.grid.getMaxStackHeight(), s2.grid.getMaxStackHeight());
    }
  });
});

describe('Stage 1 Strong Assertions: 300+ Seeds Monte-Carlo Emergence & Real Recovery', () => {
  it('across 300+ seeds BOARD_DANGER and Real Recovery must actually emerge, with zero unclassified runs', () => {
    const days = [DEFAULT_DAYS[0], DEFAULT_DAYS[1], DEFAULT_DAYS[2]];
    const runsPerDay = 100; // 3 * 100 = 300 runs
    const reports = SimulationRunner.runBatch(days, runsPerDay, 'targeted');

    assert.strictEqual(reports.length, 3, 'Must have reports for all 3 days');

    let totalDangerEpisodes = 0;
    let totalRealRecoveries = 0;
    let totalSoftlocks = 0;
    let totalRuns = 0;
    let totalUnclassified = 0;

    for (const r of reports) {
      totalRuns += r.totalRuns;
      totalDangerEpisodes += r.avgDangerEpisodes * r.totalRuns;
      totalRealRecoveries += r.avgRealRecoveries * r.totalRuns;
      totalSoftlocks += r.softlockCount;

      const classifiedCount = r.clearedRuns + r.blockedRuns + r.safetyLimitRuns;
      assert.strictEqual(classifiedCount, r.totalRuns, `Day ${r.dayNumber} must have 100% classified runs`);
    }

    assert.strictEqual(totalRuns, 300, 'Must have executed exactly 300 runs');
    assert.strictEqual(totalSoftlocks, 0, 'Must have zero softlocks across 300 runs');
    assert.strictEqual(totalUnclassified, 0, 'Must have zero unclassified runs');

    assert.ok(totalDangerEpisodes > 0, `BOARD_DANGER must actually emerge (got ${totalDangerEpisodes} total episodes)`);
    assert.ok(totalRealRecoveries > 0, `Danger -> Real Recovery must actually emerge (got ${totalRealRecoveries} total recoveries)`);
  });
});
