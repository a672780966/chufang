import {
  GameSession,
  DayConfig,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  SeededRandom,
  DeadlockDetector
} from '../../game-core/src/index.js';

export type RunClassification = 'CLEAR' | 'BLOCKED' | 'SAFETY_LIMIT';

export interface SingleGameResult {
  classification: RunClassification;
  cleared: boolean;
  blocked: boolean;
  safetyLimit: boolean;
  session: GameSession;
  steps: number;
  dangerEpisodes: number;
  realRecoveries: number;
  avgOccupiedCells: number;
  peakOccupiedCells: number;
  avgMaxStackHeight: number;
  peakStackHeight: number;
  softlocked: boolean;
}

export interface SimReport {
  dayNumber: number;
  totalRuns: number;
  clearedRuns: number;
  blockedRuns: number;
  safetyLimitRuns: number;
  clearRatePct: number;
  avgPiecesPlaced: number;
  avgIngredientsCompleted: number;
  avgOrdersCompleted: number;
  avgFinalRevenue: number;
  avgOccupiedCells: number;
  peakOccupiedCells: number;
  avgMaxStackHeight: number;
  peakStackHeight: number;
  avgDangerEpisodes: number;
  avgRealRecoveries: number;
  cascadeOccurrenceRatePct: number;
  maxCascadeChain: number;
  avgInventoryWaste: number;
  softlockCount: number;
}

export type BotStrategy = 'novice' | 'targeted' | 'master';

export class SimulationRunner {
  /**
   * Simulates a single game session until DAY_CLEARED or DAY_FAILED (or max safety steps).
   * Enforces Target-first Instance Binding and strict run classification (CLEAR / BLOCKED / SAFETY_LIMIT).
   */
  static runSingleGame(
    dayConfig: DayConfig,
    seed: string | number,
    strategy: BotStrategy = 'targeted',
    maxSteps: number = 300
  ): SingleGameResult {
    const session = new GameSession(dayConfig, seed);
    const botRng = new SeededRandom(`${seed}_bot`);
    let steps = 0;

    let occupiedCellSum = 0;
    let peakOccupiedCells = 0;
    let stackHeightSum = 0;
    let peakStackHeight = 0;

    let inDanger = false;
    let dangerEpisodes = 0;
    let completionOccurredInDanger = false;
    let realRecoveries = 0;

    session.events.on('BOARD_DANGER', () => {
      if (!inDanger) {
        inDanger = true;
        dangerEpisodes++;
      }
    });

    session.events.on('INGREDIENT_COMPLETED', () => {
      if (inDanger) {
        completionOccurredInDanger = true;
      }
    });

    while (!session.isGameOver && steps < maxSteps) {
      steps++;
      const currentOccupied = session.grid.getOccupiedCellCount();
      const currentHeight = session.grid.getMaxStackHeight();
      occupiedCellSum += currentOccupied;
      if (currentOccupied > peakOccupiedCells) peakOccupiedCells = currentOccupied;
      stackHeightSum += currentHeight;
      if (currentHeight > peakStackHeight) peakStackHeight = currentHeight;

      // Check Real Recovery condition:
      // Entered danger -> ingredient completed while in danger -> board health returns to non-danger
      const currentDanger = session.isBoardInDanger();
      if (inDanger && completionOccurredInDanger && !currentDanger) {
        realRecoveries++;
        inDanger = false;
        completionOccurredInDanger = false;
      } else if (!currentDanger) {
        inDanger = false;
      }

      const state = session.getState();
      const loosePieces = state.loosePieces;

      // Find all valid legal placements strictly respecting Target-first Instance Binding
      const legalMoves: Array<{ pieceId: string; targetId: string; slotId: string; score: number }> = [];

      for (const piece of loosePieces) {
        const target = session.grid.getTarget(piece.targetInstanceId);
        if (target && target.missingSlotIds.includes(piece.slotId)) {
          let score = 10;

          if (strategy === 'targeted' || strategy === 'master') {
            // Prioritize current order need
            if (state.currentOrder) {
              const item = state.currentOrder.items.find(
                (i: any) => i.ingredientId === target.ingredientId
              );
              if (item && item.reserved < item.needed) {
                score += 50;
              }
            }

            // Prioritize near completion (fewest missing pieces)
            score += (10 - target.missingSlotIds.length) * 5;
          }

          if (strategy === 'master') {
            // Check next order hint for preparation
            const dishId = state.nextOrderPreview?.dishId;
            if (dishId && DEFAULT_RECIPES[dishId]) {
              const reqs = DEFAULT_RECIPES[dishId].requirements;
              if (reqs.some((r: any) => r.ingredientId === target.ingredientId)) {
                score += 25;
              }
            }

            // Penalize overstocking inventory
            const currentStock = state.inventory[target.ingredientId] || 0;
            if (currentStock >= 2) {
              score -= 30;
            }
          }

          legalMoves.push({
            pieceId: piece.instanceId,
            targetId: target.instanceId,
            slotId: piece.slotId,
            score
          });
        }
      }

      if (legalMoves.length === 0) {
        // Execute deadlock / continuation evaluation explicitly
        (session as any).checkDeadlockAndDanger();
        break;
      }

      // Pick move based on strategy
      if (strategy === 'novice') {
        const pick = legalMoves[botRng.nextInt(0, legalMoves.length - 1)];
        session.placePiece(pick.pieceId, pick.targetId, pick.slotId);
      } else {
        legalMoves.sort((a, b) => b.score - a.score);
        const pick = legalMoves[0];
        session.placePiece(pick.pieceId, pick.targetId, pick.slotId);
      }
    }

    // Final board metrics sampling
    const finalOccupied = session.grid.getOccupiedCellCount();
    const finalHeight = session.grid.getMaxStackHeight();
    if (finalOccupied > peakOccupiedCells) peakOccupiedCells = finalOccupied;
    if (finalHeight > peakStackHeight) peakStackHeight = finalHeight;

    const finalState = session.getState();
    let softlocked = false;
    let classification: RunClassification;

    if (finalState.isGoalReached) {
      classification = 'CLEAR';
    } else if (finalState.isDeadlocked || session.isGameOver) {
      classification = 'BLOCKED';
    } else if (steps >= maxSteps) {
      classification = 'SAFETY_LIMIT';
    } else {
      // Re-evaluate deadlock
      const check = DeadlockDetector.evaluate(
        session.grid,
        (session as any)._ingredients,
        dayConfig.targetIngredientCount,
        dayConfig.availableRecipeIds,
        (session as any)._recipes
      );
      if (check.isDeadlocked) {
        classification = 'BLOCKED';
      } else {
        softlocked = true;
        classification = 'SAFETY_LIMIT';
      }
    }

    return {
      classification,
      cleared: classification === 'CLEAR',
      blocked: classification === 'BLOCKED',
      safetyLimit: classification === 'SAFETY_LIMIT',
      session,
      steps,
      dangerEpisodes,
      realRecoveries,
      avgOccupiedCells: steps > 0 ? Math.round((occupiedCellSum / steps) * 10) / 10 : finalOccupied,
      peakOccupiedCells,
      avgMaxStackHeight: steps > 0 ? Math.round((stackHeightSum / steps) * 10) / 10 : finalHeight,
      peakStackHeight,
      softlocked
    };
  }

  /**
   * Runs batch Monte-Carlo simulations across given days and outputs a structured report.
   */
  static runBatch(
    days: DayConfig[] = [DEFAULT_DAYS[0], DEFAULT_DAYS[1]],
    runsPerDay: number = 100,
    strategy: BotStrategy = 'targeted'
  ): SimReport[] {
    const reports: SimReport[] = [];

    for (const day of days) {
      let clearedCount = 0;
      let blockedCount = 0;
      let safetyLimitCount = 0;
      let softlockCount = 0;

      let totalPiecesPlaced = 0;
      let totalIngredients = 0;
      let totalOrders = 0;
      let totalRevenue = 0;
      let cascadeEventsCount = 0;
      let maxCascadeChain = 0;
      let totalRemainingInventory = 0;

      let totalDangerEpisodes = 0;
      let totalRealRecoveries = 0;
      let totalOccupiedSum = 0;
      let highestPeakOccupied = 0;
      let totalHeightSum = 0;
      let highestPeakHeight = 0;

      for (let i = 0; i < runsPerDay; i++) {
        const seed = `sim_${day.dayNumber}_run_${i}_${strategy}`;
        const result = this.runSingleGame(day, seed, strategy);
        const stats = result.session.stats;
        const state = result.session.getState();

        if (result.classification === 'CLEAR') clearedCount++;
        else if (result.classification === 'BLOCKED') blockedCount++;
        else safetyLimitCount++;

        if (result.softlocked) softlockCount++;

        totalPiecesPlaced += stats.piecesPlaced;
        totalIngredients += stats.ingredientsCompleted;
        totalOrders += stats.ordersCompleted;
        totalRevenue += stats.totalRevenue;
        totalDangerEpisodes += result.dangerEpisodes;
        totalRealRecoveries += result.realRecoveries;

        totalOccupiedSum += result.avgOccupiedCells;
        if (result.peakOccupiedCells > highestPeakOccupied) highestPeakOccupied = result.peakOccupiedCells;
        totalHeightSum += result.avgMaxStackHeight;
        if (result.peakStackHeight > highestPeakHeight) highestPeakHeight = result.peakStackHeight;

        if (stats.cascadeEventsCount > 0) cascadeEventsCount++;
        if (stats.maxCascadeChain > maxCascadeChain) maxCascadeChain = stats.maxCascadeChain;

        // Inventory waste (unused inventory at end of session)
        const leftStock = Object.values(state.inventory).reduce((a, b) => a + b, 0);
        totalRemainingInventory += leftStock;
      }

      reports.push({
        dayNumber: day.dayNumber,
        totalRuns: runsPerDay,
        clearedRuns: clearedCount,
        blockedRuns: blockedCount,
        safetyLimitRuns: safetyLimitCount,
        clearRatePct: Math.round((clearedCount / runsPerDay) * 100),
        avgPiecesPlaced: Math.round(totalPiecesPlaced / runsPerDay),
        avgIngredientsCompleted: Math.round((totalIngredients / runsPerDay) * 10) / 10,
        avgOrdersCompleted: Math.round((totalOrders / runsPerDay) * 10) / 10,
        avgFinalRevenue: Math.round(totalRevenue / runsPerDay),
        avgOccupiedCells: Math.round((totalOccupiedSum / runsPerDay) * 10) / 10,
        peakOccupiedCells: highestPeakOccupied,
        avgMaxStackHeight: Math.round((totalHeightSum / runsPerDay) * 10) / 10,
        peakStackHeight: highestPeakHeight,
        avgDangerEpisodes: Math.round((totalDangerEpisodes / runsPerDay) * 10) / 10,
        avgRealRecoveries: Math.round((totalRealRecoveries / runsPerDay) * 10) / 10,
        cascadeOccurrenceRatePct: Math.round((cascadeEventsCount / runsPerDay) * 100),
        maxCascadeChain,
        avgInventoryWaste: Math.round((totalRemainingInventory / runsPerDay) * 10) / 10,
        softlockCount
      });
    }

    return reports;
  }
}

// CLI execution if executed directly
if (process.argv[1] && process.argv[1].endsWith('SimulationRunner.ts')) {
  console.log('====================================================');
  console.log('  Running Batch Monte-Carlo Balance Simulations...  ');
  console.log('====================================================\n');

  const strategy: BotStrategy = 'targeted';
  const runs = 100;
  const reports = SimulationRunner.runBatch([DEFAULT_DAYS[0], DEFAULT_DAYS[1], DEFAULT_DAYS[2]], runs, strategy);

  console.table(reports);

  console.log('\nSimulation Validation Highlights:');
  for (const r of reports) {
    console.log(`- Day ${r.dayNumber}: Clear = ${r.clearRatePct}%, Blocked = ${r.blockedRuns}, SafetyLimit = ${r.safetyLimitRuns}, AvgOccupied = ${r.avgOccupiedCells} (Peak ${r.peakOccupiedCells}), DangerEpisodes = ${r.avgDangerEpisodes}, RealRecoveries = ${r.avgRealRecoveries}, Cascade Rate = ${r.cascadeOccurrenceRatePct}%, Max Chain = ${r.maxCascadeChain}`);
  }
}
