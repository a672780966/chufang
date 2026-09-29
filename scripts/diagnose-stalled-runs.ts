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
  const dayConfig = DEFAULT_DAYS[0];
  const session = new GameSession(dayConfig, seed, undefined, undefined, 'DISH_PUZZLE');
  const detector = new DishPuzzleDeadlockDetector();

  // Run simulation up to 500 steps
  const simResult = DishPuzzleSimulationRunner['runSingleSeed'](seed, policy, 1);
  if (simResult.outcome !== 'STALLED_NO_PROGRESS') {
    return null;
  }

  // Re-run session to step 500 to extract live board snapshot
  // Use simResult data
  const mgr = session.dishPuzzleManager;
  // Step simulation again manually
  const rng = session['_rng'];
  const recentHistory: string[] = [];
  const recentPosSet = new Set<string>();

  for (let step = 0; step < simResult.steps; step++) {
    const candidates = DishPuzzleSimulationRunner.findCandidateMoves(session);
    if (candidates.length === 0) break;

    let chosenMove: CandidateMove | null = null;
    if (policy === 'random_legal') {
      chosenMove = candidates[rng.nextInt(0, candidates.length - 1)];
    } else if (policy === 'order_focus') {
      const orderMerges = candidates.filter(c => c.isCurrentOrderDish && c.enablesMerge);
      if (orderMerges.length > 0) {
        chosenMove = orderMerges[rng.nextInt(0, orderMerges.length - 1)];
      } else {
        const orderMoves = candidates.filter(c => c.isCurrentOrderDish);
        chosenMove = orderMoves.length > 0
          ? orderMoves[rng.nextInt(0, orderMoves.length - 1)]
          : candidates[rng.nextInt(0, candidates.length - 1)];
      }
    } else {
      for (const c of candidates) {
        c.score = DishPuzzleSimulationRunner['scorePlannerCandidate'](c, session, mgr, recentPosSet);
      }
      candidates.sort((a, b) => b.score - a.score);
      const topScore = candidates[0].score;
      const topTiers = candidates.filter(c => c.score >= topScore - 10 && c.score > -1000);
      chosenMove = topTiers.length > 0 ? topTiers[rng.nextInt(0, topTiers.length - 1)] : candidates[0];

      const posKey = `${chosenMove.groupId}_${chosenMove.targetCol}_${chosenMove.targetRow}`;
      recentHistory.push(posKey);
      recentPosSet.add(posKey);
      if (recentHistory.length > 8) {
        const oldest = recentHistory.shift()!;
        recentPosSet.delete(oldest);
      }
    }

    if (!chosenMove) break;
    session.moveDishGroup(chosenMove.groupId, chosenMove.targetCol, chosenMove.targetRow, chosenMove.refPieceId);
  }

  // Snapshot at cutoff
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

  // 1. Gather STALLED runs from random_legal
  for (let i = 1; i <= 150 && entries.length < 10; i++) {
    const entry = diagnoseStalledRun(`sim_random_${1000 + i}`, 'random_legal');
    if (entry) entries.push(entry);
  }

  // 2. Gather STALLED runs from order_focus
  for (let i = 1; i <= 150 && entries.length < 20; i++) {
    const entry = diagnoseStalledRun(`sim_order_${2000 + i}`, 'order_focus');
    if (entry) entries.push(entry);
  }

  // 3. Gather STALLED runs from multi_dish_planner
  for (let i = 1; i <= 350 && entries.length < targetCount; i++) {
    const entry = diagnoseStalledRun(`sim_multidish_${3000 + i}`, 'multi_dish_planner');
    if (entry) entries.push(entry);
  }

  const breakdown = { A: 0, B: 0, C: 0, D: 0 };
  for (const e of entries) {
    breakdown[e.category]++;
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
