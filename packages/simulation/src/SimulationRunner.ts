import {
  GameSession,
  DayConfig,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  SeededRandom
} from '../../game-core/src/index.js';

export interface SimReport {
  dayNumber: number;
  totalRuns: number;
  clearedRuns: number;
  blockedRuns: number;
  clearRatePct: number;
  avgPiecesPlaced: number;
  avgIngredientsCompleted: number;
  avgOrdersCompleted: number;
  avgFinalRevenue: number;
  avgDangerEvents: number;
  avgNearDeadRecoveries: number;
  cascadeOccurrenceRatePct: number;
  maxCascadeChain: number;
  avgInventoryWaste: number;
}

export type BotStrategy = 'novice' | 'targeted' | 'master';

export class SimulationRunner {
  /**
   * Simulates a single game session until DAY_CLEARED or DAY_FAILED (or max safety steps).
   */
  static runSingleGame(
    dayConfig: DayConfig,
    seed: string | number,
    strategy: BotStrategy = 'targeted',
    maxSteps: number = 300
  ): {
    cleared: boolean;
    blocked: boolean;
    session: GameSession;
    steps: number;
    dangerEvents: number;
    nearDeadRecoveries: number;
  } {
    const session = new GameSession(dayConfig, seed);
    const botRng = new SeededRandom(`${seed}_bot`);
    let steps = 0;
    let dangerEvents = 0;
    let nearDeadRecoveries = 0;
    let isCurrentlyInDanger = false;

    session.events.on('BOARD_DANGER', () => {
      dangerEvents++;
      isCurrentlyInDanger = true;
    });

    session.events.on('INGREDIENT_COMPLETED', () => {
      if (isCurrentlyInDanger) {
        nearDeadRecoveries++;
        isCurrentlyInDanger = false;
      }
    });

    while (!session.isGameOver && steps < maxSteps) {
      steps++;
      const state = session.getState();
      const loosePieces = state.loosePieces;

      // Find all valid legal placements
      const legalMoves: Array<{ pieceId: string; targetId: string; slotId: string; score: number }> = [];

      const activeTargets = session.grid.getAllTargets();
      for (const piece of loosePieces) {
        for (const target of activeTargets) {
          if (piece.ingredientId === target.ingredientId && target.missingSlotIds.includes(piece.slotId)) {
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
              // Check next order hint for preparation (deduced from dishId recipe)
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
      }

      if (legalMoves.length === 0) {
        break;
      }

      // Pick move based on strategy
      if (strategy === 'novice') {
        // Purely deterministic random pick using botRng
        const pick = legalMoves[botRng.nextInt(0, legalMoves.length - 1)];
        session.placePiece(pick.pieceId, pick.targetId, pick.slotId);
      } else {
        // Best score pick
        legalMoves.sort((a, b) => b.score - a.score);
        const pick = legalMoves[0];
        session.placePiece(pick.pieceId, pick.targetId, pick.slotId);
      }
    }

    const finalState = session.getState();
    return {
      cleared: finalState.isGoalReached,
      blocked: finalState.isDeadlocked,
      session,
      steps,
      dangerEvents,
      nearDeadRecoveries
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
      let totalPiecesPlaced = 0;
      let totalIngredients = 0;
      let totalOrders = 0;
      let totalRevenue = 0;
      let cascadeEventsCount = 0;
      let maxCascadeChain = 0;
      let totalRemainingInventory = 0;
      let totalDeadlockChecks = 0;

      let totalDangerEvents = 0;
      let totalNearDeadRecoveries = 0;

      for (let i = 0; i < runsPerDay; i++) {
        const seed = `sim_${day.dayNumber}_run_${i}_${strategy}`;
        const result = this.runSingleGame(day, seed, strategy);
        const stats = result.session.stats;
        const state = result.session.getState();

        if (result.cleared) clearedCount++;
        if (result.blocked) blockedCount++;

        totalPiecesPlaced += stats.piecesPlaced;
        totalIngredients += stats.ingredientsCompleted;
        totalOrders += stats.ordersCompleted;
        totalRevenue += stats.totalRevenue;
        totalDangerEvents += result.dangerEvents;
        totalNearDeadRecoveries += result.nearDeadRecoveries;

        if (stats.cascadeEventsCount > 0) cascadeEventsCount++;
        if (stats.maxCascadeChain > maxCascadeChain) maxCascadeChain = stats.maxCascadeChain;

        // Inventory waste (unused inventory at end of session)
        const leftStock = Object.values(state.inventory).reduce((a, b) => a + b, 0);
        totalRemainingInventory += leftStock;
        totalDeadlockChecks += stats.deadlockChecks;
      }

      reports.push({
        dayNumber: day.dayNumber,
        totalRuns: runsPerDay,
        clearedRuns: clearedCount,
        blockedRuns: blockedCount,
        clearRatePct: Math.round((clearedCount / runsPerDay) * 100),
        avgPiecesPlaced: Math.round(totalPiecesPlaced / runsPerDay),
        avgIngredientsCompleted: Math.round((totalIngredients / runsPerDay) * 10) / 10,
        avgOrdersCompleted: Math.round((totalOrders / runsPerDay) * 10) / 10,
        avgFinalRevenue: Math.round(totalRevenue / runsPerDay),
        avgDangerEvents: Math.round((totalDangerEvents / runsPerDay) * 10) / 10,
        avgNearDeadRecoveries: Math.round((totalNearDeadRecoveries / runsPerDay) * 10) / 10,
        cascadeOccurrenceRatePct: Math.round((cascadeEventsCount / runsPerDay) * 100),
        maxCascadeChain,
        avgInventoryWaste: Math.round((totalRemainingInventory / runsPerDay) * 10) / 10
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
    console.log(`- Day ${r.dayNumber}: Clear = ${r.clearRatePct}%, Blocked = ${r.blockedRuns}, Danger Events = ${r.avgDangerEvents}, Near-Dead Recoveries = ${r.avgNearDeadRecoveries}, Cascade Rate = ${r.cascadeOccurrenceRatePct}%, Max Chain = ${r.maxCascadeChain}`);
  }
}
