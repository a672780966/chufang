/**
 * DishCampaignSimulator.ts
 * Stage 5B Comprehensive Campaign Simulation Engine for DishPuzzle / Jigsaw Drop.
 *
 * Runs 12 Days × 3 Personas (Novice, Casual, Strategic) × 200 seeds = 7,200 runs.
 *
 * Collects 14 authoritative campaign progression metrics:
 *   1. Clear Rate (%)
 *   2. Median Actions To First Dish
 *   3. Median Actions To Clear Day
 *   4. Merge Rate (merges / actions)
 *   5. Dish Completion Count
 *   6. Switch Frequency (dish switches / moves)
 *   7. Occupancy P50 / P90 / Max
 *   8. Danger Episodes
 *   9. Danger Recoveries
 *   10. Prepared Buffer Uses
 *   11. Cascade Count
 *   12. Average Cascade Length
 *   13. Stall Count
 *   14. True Deadlock Count
 *
 * Generates:
 *   - stage5b_campaign_simulation.json
 *   - stage5b_campaign_matrix.md
 *   - stage5b_progression_analysis.md
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  GameSession,
  DEFAULT_DAYS,
  SeededRandom,
  getDishCampaignDayConfig,
  DISH_CAMPAIGN_CANDIDATE_V1,
  DishCampaignDayConfig
} from '../../game-core/src/index';
import {
  DishPuzzleSimulationRunner,
  CandidateMove
} from './DishPuzzleSimulationRunner';
import {
  DishCampaignPersona,
  DishCampaignPersonaType,
  PersonaCandidateMove
} from './DishCampaignPersona';

export interface SingleRunMetric {
  seed: string;
  dayNumber: number;
  persona: DishCampaignPersonaType;
  outcome: 'CLEARED' | 'DEADLOCKED' | 'STALLED_NO_PROGRESS';
  revenue: number;
  businessGoal: number;
  actions: number;
  actionsToFirstDish: number | null;
  actionsToClear: number | null;
  merges: number;
  dishesCompleted: number;
  targetSwitches: number;
  occupancyP50: number;
  occupancyP90: number;
  occupancyMax: number;
  dangerEpisodes: number;
  dangerRecoveries: number;
  preparedBufferUses: number;
  cascadeCount: number;
  maxCascadeStreak: number;
}

export interface DayPersonaAggregateMetrics {
  dayNumber: number;
  learningGoal: string;
  persona: DishCampaignPersonaType;
  totalRuns: number;
  clearedRuns: number;
  stalledRuns: number;
  deadlockedRuns: number;
  clearRate: number;
  medianActionsToFirstDish: number | null;
  medianActionsToClearDay: number | null;
  mergeRate: number;
  avgDishCompletionCount: number;
  switchFrequency: number;
  occupancyP50: number;
  occupancyP90: number;
  occupancyMax: number;
  avgDangerEpisodes: number;
  avgDangerRecoveries: number;
  avgPreparedBufferUses: number;
  avgCascadeCount: number;
  avgCascadeLength: number;
}

export class DishCampaignSimulator {
  private static readonly MAX_STEPS = 500;
  private static readonly SEEDS_PER_PERSONA = 200;

  /**
   * Runs a single seed simulation.
   */
  static runSingleSession(
    seed: string,
    dayNumber: number,
    persona: DishCampaignPersonaType
  ): SingleRunMetric {
    const dayConfig = DEFAULT_DAYS[dayNumber - 1] || DEFAULT_DAYS[0];
    const session = new GameSession(dayConfig, seed, undefined, undefined, 'DISH_PUZZLE');
    const rng = new SeededRandom(`${seed}_${dayNumber}_${persona}`);

    let steps = 0;
    let actionsToFirstDish: number | null = null;
    let actionsToClear: number | null = null;
    let targetSwitches = 0;
    let lastMovedDishId: string | undefined;

    let dangerEpisodes = 0;
    let dangerRecoveries = 0;
    let preparedBufferUses = 0;
    let cascadeEvents = 0;

    const occupancies: number[] = [];
    const recentHistory: string[] = [];
    const recentPosSet = new Set<string>();
    const totalBoardCells = session.grid.columns * session.grid.rows; // 96

    // Track danger and buffer events
    let wasInDanger = false;
    session.events.on('DISH_BOARD_DANGER', () => {
      dangerEpisodes++;
      wasInDanger = true;
    });
    session.events.on('DISH_BOARD_DANGER_CLEARED', () => {
      if (wasInDanger) {
        dangerRecoveries++;
        wasInDanger = false;
      }
    });
    session.events.on('PREPARED_DISH_STORED', () => {
      preparedBufferUses++;
    });
    session.events.on('PREPARED_DISH_SERVED', () => {
      preparedBufferUses++;
    });
    session.events.on('PRODUCTION_CASCADE_TRIGGERED', () => {
      cascadeEvents++;
    });

    while (steps < this.MAX_STEPS && !session.orderSystem.isGoalReached && !session.isGameOver) {
      steps++;

      // Track occupancy
      const curPieces = session.dishPuzzleManager.getAllPieces().length;
      occupancies.push(curPieces / totalBoardCells);

      // Automatic resolution of completed dishes
      const groups = session.dishPuzzleManager.getAllGroups();
      const readyGroup = groups.find(g => g.isComplete && g.pieceIds.length === 9);
      if (readyGroup) {
        session.resolveCompletedDish(readyGroup.groupId);
        if (actionsToFirstDish === null) {
          actionsToFirstDish = steps;
        }
        if (session.orderSystem.isGoalReached) {
          actionsToClear = steps;
          break;
        }
        continue;
      }

      // Collect legal moves
      const candidates = DishPuzzleSimulationRunner.findCandidateMoves(session) as PersonaCandidateMove[];
      if (candidates.length === 0) {
        break;
      }

      // Select move via persona policy
      const chosen = DishCampaignPersona.selectMove(
        persona,
        candidates,
        session,
        rng,
        recentPosSet,
        lastMovedDishId
      );

      if (!chosen) break;

      // Track target switches
      if (lastMovedDishId && chosen.dishId !== lastMovedDishId) {
        targetSwitches++;
      }
      lastMovedDishId = chosen.dishId;

      // Update taboo history for Strategic bot
      if (persona === 'Strategic') {
        const posKey = `${chosen.groupId}_${chosen.targetCol}_${chosen.targetRow}`;
        recentHistory.push(posKey);
        recentPosSet.add(posKey);
        if (recentHistory.length > 8) {
          const oldest = recentHistory.shift()!;
          recentPosSet.delete(oldest);
        }
      }

      // Execute move
      const moveRes = session.moveDishGroup(
        chosen.groupId,
        chosen.targetCol,
        chosen.targetRow,
        chosen.refPieceId
      );

      // Check first dish completion
      if (moveRes.completedDish && actionsToFirstDish === null) {
        actionsToFirstDish = steps;
      }

      // Check day cleared
      if (session.orderSystem.isGoalReached) {
        actionsToClear = steps;
        break;
      }
    }

    const cleared = session.orderSystem.isGoalReached;
    const deadlocked = session.isGameOver && !cleared;
    const outcome = cleared ? 'CLEARED' : (deadlocked ? 'DEADLOCKED' : 'STALLED_NO_PROGRESS');

    // Calculate percentiles
    occupancies.sort((a, b) => a - b);
    const p50 = occupancies.length > 0 ? occupancies[Math.floor(occupancies.length * 0.5)] : 0;
    const p90 = occupancies.length > 0 ? occupancies[Math.floor(occupancies.length * 0.9)] : 0;
    const maxOcc = occupancies.length > 0 ? occupancies[occupancies.length - 1] : 0;

    return {
      seed,
      dayNumber,
      persona,
      outcome,
      revenue: session.orderSystem.totalRevenue,
      businessGoal: session.dayConfig.businessGoal,
      actions: steps,
      actionsToFirstDish,
      actionsToClear,
      merges: session.stats.piecesMerged,
      dishesCompleted: session.stats.dishesCompleted,
      targetSwitches,
      occupancyP50: Math.round(p50 * 1000) / 1000,
      occupancyP90: Math.round(p90 * 1000) / 1000,
      occupancyMax: Math.round(maxOcc * 1000) / 1000,
      dangerEpisodes: session.stats.dangerEpisodes || dangerEpisodes,
      dangerRecoveries,
      preparedBufferUses,
      cascadeCount: cascadeEvents,
      maxCascadeStreak: session.stats.maxCascadeChain
    };
  }

  /**
   * Computes aggregate metrics from a list of runs.
   */
  static aggregateRuns(
    runs: SingleRunMetric[],
    dayNumber: number,
    learningGoal: string,
    persona: DishCampaignPersonaType
  ): DayPersonaAggregateMetrics {
    const totalRuns = runs.length;
    const cleared = runs.filter(r => r.outcome === 'CLEARED');
    const stalled = runs.filter(r => r.outcome === 'STALLED_NO_PROGRESS');
    const deadlocked = runs.filter(r => r.outcome === 'DEADLOCKED');

    const firstDishActions = runs.map(r => r.actionsToFirstDish).filter((a): a is number => a !== null).sort((a, b) => a - b);
    const medianFirstDish = firstDishActions.length > 0 ? firstDishActions[Math.floor(firstDishActions.length / 2)] : null;

    const clearActions = cleared.map(r => r.actionsToClear).filter((a): a is number => a !== null).sort((a, b) => a - b);
    const medianClear = clearActions.length > 0 ? clearActions[Math.floor(clearActions.length / 2)] : null;

    const totalActions = runs.reduce((acc, r) => acc + r.actions, 0);
    const totalMerges = runs.reduce((acc, r) => acc + r.merges, 0);
    const totalDishes = runs.reduce((acc, r) => acc + r.dishesCompleted, 0);
    const totalSwitches = runs.reduce((acc, r) => acc + r.targetSwitches, 0);

    const avgP50 = runs.reduce((acc, r) => acc + r.occupancyP50, 0) / totalRuns;
    const avgP90 = runs.reduce((acc, r) => acc + r.occupancyP90, 0) / totalRuns;
    const maxOcc = Math.max(...runs.map(r => r.occupancyMax), 0);

    const totalDanger = runs.reduce((acc, r) => acc + r.dangerEpisodes, 0);
    const totalRecoveries = runs.reduce((acc, r) => acc + r.dangerRecoveries, 0);
    const totalBufferUses = runs.reduce((acc, r) => acc + r.preparedBufferUses, 0);
    const totalCascades = runs.reduce((acc, r) => acc + r.cascadeCount, 0);
    const totalStreak = runs.reduce((acc, r) => acc + r.maxCascadeStreak, 0);

    return {
      dayNumber,
      learningGoal,
      persona,
      totalRuns,
      clearedRuns: cleared.length,
      stalledRuns: stalled.length,
      deadlockedRuns: deadlocked.length,
      clearRate: Math.round((cleared.length / totalRuns) * 1000) / 10,
      medianActionsToFirstDish: medianFirstDish,
      medianActionsToClearDay: medianClear,
      mergeRate: totalActions > 0 ? Math.round((totalMerges / totalActions) * 1000) / 1000 : 0,
      avgDishCompletionCount: Math.round((totalDishes / totalRuns) * 10) / 10,
      switchFrequency: totalActions > 0 ? Math.round((totalSwitches / totalActions) * 1000) / 1000 : 0,
      occupancyP50: Math.round(avgP50 * 1000) / 1000,
      occupancyP90: Math.round(avgP90 * 1000) / 1000,
      occupancyMax: Math.round(maxOcc * 1000) / 1000,
      avgDangerEpisodes: Math.round((totalDanger / totalRuns) * 100) / 100,
      avgDangerRecoveries: Math.round((totalRecoveries / totalRuns) * 100) / 100,
      avgPreparedBufferUses: Math.round((totalBufferUses / totalRuns) * 100) / 100,
      avgCascadeCount: Math.round((totalCascades / totalRuns) * 100) / 100,
      avgCascadeLength: totalCascades > 0 ? Math.round((totalStreak / totalCascades) * 10) / 10 : 0
    };
  }

  /**
   * Executes the full 7,200 simulation runs across all 12 days and 3 personas.
   */
  static runCampaignSuite(seedsPerPersona: number = this.SEEDS_PER_PERSONA): {
    aggregates: DayPersonaAggregateMetrics[];
    rawRuns: SingleRunMetric[];
  } {
    const personas: DishCampaignPersonaType[] = ['Novice', 'Casual', 'Strategic'];
    const rawRuns: SingleRunMetric[] = [];
    const aggregates: DayPersonaAggregateMetrics[] = [];

    const startTime = Date.now();
    console.log(`Starting Stage 5B Campaign Simulation: 12 Days × 3 Personas × ${seedsPerPersona} seeds = ${12 * 3 * seedsPerPersona} runs`);

    for (let day = 1; day <= 12; day++) {
      const cfg = getDishCampaignDayConfig(day);
      console.log(`--- Simulating Day ${day}: ${cfg.learningGoal} ---`);

      for (const persona of personas) {
        const dayPersonaRuns: SingleRunMetric[] = [];
        for (let s = 0; s < seedsPerPersona; s++) {
          const seed = `sim_c5b_d${day}_p${persona}_s${1000 + s}`;
          const runRes = this.runSingleSession(seed, day, persona);
          dayPersonaRuns.push(runRes);
          rawRuns.push(runRes);
        }

        const agg = this.aggregateRuns(dayPersonaRuns, day, cfg.learningGoal, persona);
        aggregates.push(agg);
        console.log(`  [${persona.padEnd(9)}] ClearRate: ${agg.clearRate}% | Med1st: ${agg.medianActionsToFirstDish ?? '-'} | MedClear: ${agg.medianActionsToClearDay ?? '-'} | OccMax: ${agg.occupancyMax} | Danger: ${agg.avgDangerEpisodes}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Simulation finished in ${duration}s.`);
    return { aggregates, rawRuns };
  }
}
