/**
 * diagnose-stalled-runs.ts
 * Stage 5A Revision 2: Diagnostic Analyzer for STALLED_NO_PROGRESS simulation states.
 * Collects 20+ STALLED runs across policies and categorizes root causes:
 *   A. Bot repeating ineffective policy, but real path exists
 *   B. Candidate Search range insufficient (requires multi-step lookahead)
 *   C. Supply temporarily blocked, but Board still has Merge opportunities
 *   D. Real Core Softlock (DeadlockDetector missed it)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  GameSession,
  DEFAULT_DAYS,
  DishPuzzleDeadlockDetector,
  DishPuzzleManager
} from '../packages/game-core/src/index.js';
import {
  DishPuzzleSimulationRunner,
  BotPolicyType,
  CandidateMove
} from '../packages/simulation/src/DishPuzzleSimulationRunner.js';

export interface StallDiagnosisEntry {
  seed: string;
  policy: BotPolicyType;
  steps: number;
  revenue: number;
  businessGoal: number;
  occupancyRatio: number;
  maxStackHeight: number;
  availableSpawnCellsCount: number;
  isTopSpawnBlocked: boolean;
  legalCandidateMovesCount: number;
  immediateMergeMovesCount: number;
  deadlockDetectorResult: {
    isDeadlocked: boolean;
    reason?: string;
    legalMovesCount: number;
  };
  canSupplyPieces: boolean;
  category: 'A' | 'B' | 'C' | 'D';
  diagnosisReason: string;
}

export interface StallDiagnosisReport {
  timestamp: string;
  totalDiagnosed: number;
  categoryBreakdown: {
    A: number; // Bot ineffective policy / oscillation
    B: number; // Search range insufficient (multi-step clearance)
    C: number; // Supply blocked, but board has merge
    D: number; // Real softlock missed by detector (MUST BE 0)
  };
  isCoreSound: boolean;
  entries: StallDiagnosisEntry[];
}

export function diagnoseStalledRun(
  seed: string,
  policy: BotPolicyType
): StallDiagnosisEntry | null {
  // 1. Run simulation with captureTrace = true
  const simResult = DishPuzzleSimulationRunner.runSingleSeed(seed, policy, 1, true);
  if (simResult.outcome !== 'STALLED_NO_PROGRESS') {
    return null;
  }

  // 2. Replay the exact action trace onto a fresh GameSession
  const replayed = DishPuzzleSimulationRunner.replayActionTrace(seed, simResult.actionTrace!, 1);
  const session = replayed.session;

  // 3. STRONG INVARIANT ASSERTIONS: Replay MUST be 100% byte-for-byte identical to simulation
  if (session.revenue !== simResult.revenue) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] Revenue mismatch for ${seed}: sim=${simResult.revenue}, replay=${session.revenue}`
    );
  }
  if (session.dayConfig.businessGoal !== simResult.businessGoal) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] businessGoal mismatch for ${seed}: sim=${simResult.businessGoal}, replay=${session.dayConfig.businessGoal}`
    );
  }
  if (replayed.finalStateHash !== simResult.finalStateHash) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] finalStateHash mismatch for ${seed}: sim=${simResult.finalStateHash}, replay=${replayed.finalStateHash}`
    );
  }
  if (replayed.finalSnapshot.pieces.length !== simResult.finalSnapshot!.pieces.length) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] Piece count mismatch for ${seed}: sim=${simResult.finalSnapshot!.pieces.length}, replay=${replayed.finalSnapshot.pieces.length}`
    );
  }
  if (replayed.finalSnapshot.groups.length !== simResult.finalSnapshot!.groups.length) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] Group count mismatch for ${seed}: sim=${simResult.finalSnapshot!.groups.length}, replay=${replayed.finalSnapshot.groups.length}`
    );
  }
  const simCurOrderId = simResult.finalSnapshot?.currentOrder?.orderId;
  const repCurOrderId = session.orderSystem.currentOrder?.orderId;
  if (simCurOrderId !== repCurOrderId) {
    throw new Error(
      `[StallDiagnosis Invariant Breach] Current order mismatch for ${seed}: sim=${simCurOrderId}, replay=${repCurOrderId}`
    );
  }

  // 4. Snapshot directly from the live replayed session
  const mgr = session.dishPuzzleManager;
  const detector = new DishPuzzleDeadlockDetector();
  const occupancyRatio = mgr.getOccupancyRatio();
  const maxStackHeight = mgr.getMaxStackHeight();
  const availableSpawnCells = mgr.getAvailableSpawnCells();
  const isTopSpawnBlocked = availableSpawnCells.length === 0;
  const candidateMoves = DishPuzzleSimulationRunner.findCandidateMoves(session);
  const immediateMergeMoves = candidateMoves.filter(c => c.enablesMerge);
  const deadlockResult = detector.checkDeadlock(mgr);
  const canSupply = mgr.getAllPieces().length < (session.dayConfig.maxPieceCount ?? 24) && !isTopSpawnBlocked;

  let category: 'A' | 'B' | 'C' | 'D';
  let diagnosisReason: string;

  if (candidateMoves.length === 0 && isTopSpawnBlocked && !deadlockResult.isDeadlocked) {
    category = 'D';
    diagnosisReason = 'CRITICAL: No legal moves and top spawn blocked, but DeadlockDetector failed to trigger deadlock!';
  } else if (isTopSpawnBlocked && immediateMergeMoves.length > 0) {
    category = 'C';
    diagnosisReason = 'Supply is temporarily blocked at top row, but the board contains legal merge moves that could relieve space.';
  } else if (immediateMergeMoves.length > 0 || (canSupply && candidateMoves.length > 0)) {
    category = 'A';
    diagnosisReason = `Bot repeating ineffective policy / local oscillation. Legal moves exist (${candidateMoves.length}), immediate merges available (${immediateMergeMoves.length}), supply possible (${canSupply}).`;
  } else if (candidateMoves.length > 0 && !isTopSpawnBlocked) {
    category = 'B';
    diagnosisReason = `No 1-step immediate merges found among ${candidateMoves.length} moves, but board has space (${availableSpawnCells.length} cells). Multi-step clearance / lookahead needed to connect separated groups.`;
  } else {
    category = 'A';
    diagnosisReason = `Session reached step cutoff without completing goal. Legal moves: ${candidateMoves.length}.`;
  }

  return {
    seed,
    policy,
    steps: simResult.steps,
    revenue: session.revenue,
    businessGoal: session.dayConfig.businessGoal,
    occupancyRatio,
    maxStackHeight,
    availableSpawnCellsCount: availableSpawnCells.length,
    isTopSpawnBlocked,
    legalCandidateMovesCount: candidateMoves.length,
    immediateMergeMovesCount: immediateMergeMoves.length,
    deadlockDetectorResult: {
      isDeadlocked: deadlockResult.isDeadlocked,
      reason: deadlockResult.reason,
      legalMovesCount: deadlockResult.legalMovesCount
    },
    canSupplyPieces: canSupply,
    category,
    diagnosisReason
  };
}

export function runFullStallDiagnosis(): StallDiagnosisReport {
  console.log('🔍 Starting Stage 5A STALLED state diagnosis across simulation policies...');
  const entries: StallDiagnosisEntry[] = [];
  const targetCount = 25; // Diagnose at least 25 entries

  // 1. Mandatory regression check for sim_multidish_3005
  console.log('   Checking mandatory regression target: sim_multidish_3005...');
  const entry3005 = diagnoseStalledRun('sim_multidish_3005', 'multi_dish_planner');
  if (entry3005) {
    if (entry3005.revenue >= entry3005.businessGoal) {
      throw new Error(
        `[Regression Failure] sim_multidish_3005 replay revenue (${entry3005.revenue}) >= businessGoal (${entry3005.businessGoal})!`
      );
    }
    entries.push(entry3005);
    console.log(`   ✅ sim_multidish_3005 verified: revenue=${entry3005.revenue} < goal=${entry3005.businessGoal}`);
  }

  // 2. Gather STALLED runs from multi_dish_planner
  for (let i = 1; i <= 350 && entries.length < 10; i++) {
    const seed = `sim_multidish_${3000 + i}`;
    if (seed === 'sim_multidish_3005') continue;
    const entry = diagnoseStalledRun(seed, 'multi_dish_planner');
    if (entry) entries.push(entry);
  }

  // 3. Gather STALLED runs from order_focus
  for (let i = 1; i <= 150 && entries.length < 18; i++) {
    const entry = diagnoseStalledRun(`sim_order_${2000 + i}`, 'order_focus');
    if (entry) entries.push(entry);
  }

  // 4. Gather STALLED runs from random_legal
  for (let i = 1; i <= 150 && entries.length < targetCount; i++) {
    const entry = diagnoseStalledRun(`sim_random_${1000 + i}`, 'random_legal');
    if (entry) entries.push(entry);
  }

  const breakdown = { A: 0, B: 0, C: 0, D: 0 };
  for (const e of entries) {
    breakdown[e.category]++;
  }

  if (breakdown.D > 0) {
    throw new Error(`[CRITICAL] Category D (missed deadlock / true softlock) count is ${breakdown.D}! Must be 0.`);
  }

  const report: StallDiagnosisReport = {
    timestamp: new Date().toISOString(),
    totalDiagnosed: entries.length,
    categoryBreakdown: breakdown,
    isCoreSound: breakdown.D === 0,
    entries
  };

  const reportPath = path.resolve(process.cwd(), 'stage5a_stall_diagnosis.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✅ Diagnosis written to ${reportPath}`);
  console.log(`📊 Category Breakdown: A=${breakdown.A}, B=${breakdown.B}, C=${breakdown.C}, D=${breakdown.D}`);
  console.log(`🛡️ Core Soundness (D === 0): ${report.isCoreSound}`);

  return report;
}

runFullStallDiagnosis();
