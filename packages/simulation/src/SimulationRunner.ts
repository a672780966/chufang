import {
  GameSession,
  DayConfig,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES,
  SeededRandom,
  DeadlockDetector,
  FlowDirectorProfile,
  DEFAULT_DIRECTOR_PROFILE,
  DEFAULT_PRESSURE_PROFILE
} from '../../game-core/src/index';

export type RunClassification = 'CLEAR' | 'BLOCKED' | 'SAFETY_LIMIT';

export interface SingleGameResult {
  classification: RunClassification;
  cleared: boolean;
  blocked: boolean;
  safetyLimit: boolean;
  session: GameSession;
  steps: number;

  // Board Health & Spatial Pressure
  dangerEpisodes: number;
  dangerSteps: number;
  dangerTimeRatio: number;
  realRecoveries: number;
  avgOccupiedCells: number;
  peakOccupiedCells: number;
  avgMaxStackHeight: number;
  peakStackHeight: number;

  // Pacing & Core Experience Metrics
  avgNearCompletionDwellTime: number;
  targetSwitchingFrequency: number;
  avgClosureWait: number;

  // Order Fulfillment & Cascade Metrics
  piecesPlaced: number;
  ordersCompleted: number;
  piecesPerOrder: number;
  avgFinalRevenue: number;
  businessGoalEfficiency: number;
  avgOrderAutoFillRate: number;
  instantAutoFillCount: number;
  avgOrderInterval: number;
  inventoryWaste: number;
  maxCascadeChain: number;
  cascadeEventsCount: number;

  softlocked: boolean;
}

export interface SimReport {
  dayNumber: number;
  strategy: BotStrategy;
  totalRuns: number;
  clearedRuns: number;
  blockedRuns: number;
  safetyLimitRuns: number;
  clearRatePct: number;

  // Volume & Efficiency
  avgPiecesPlaced: number;
  avgOrdersCompleted: number;
  avgPiecesPerOrder: number;
  avgFinalRevenue: number;
  businessGoalEfficiency: number; // Revenue per piece placed

  // Order Auto-Fill & Production Cascade
  avgAutoFillRatePct: number; // % of requirements fulfilled at order creation
  instantAutoFillOrdersPerGame: number;
  cascadeOccurrenceRatePct: number;
  maxCascadeChain: number;
  avgInventoryWaste: number;

  // Spatial Pressure & Danger
  avgDangerEpisodes: number;
  dangerTimeRatioPct: number;
  avgRealRecoveries: number;
  peakStackHeight: number;
  avgOccupiedCells: number;
  peakOccupiedCells: number;

  // Core Experience Texture (Anticipation / Forced Switching / Closure)
  avgNearCompletionDwellTime: number; // Moves elapsed from near-completion to finish
  targetSwitchingFrequencyPct: number; // % of moves switching targets
  avgClosureWait: number; // Moves elapsed waiting for closure piece
  avgOrderInterval: number; // Moves elapsed between completed orders
  softlockCount: number;
}

export type BotStrategy = 'novice' | 'targeted' | 'master';

export class SimulationRunner {
  /**
   * Simulates a single game session until DAY_CLEARED or DAY_FAILED (or max safety steps).
   * Enforces Target-first Instance Binding and strict run classification (CLEAR / BLOCKED / SAFETY_LIMIT).
   * Gathers comprehensive Stage 2 experience metrics without player future-reading cheats.
   */
  static runSingleGame(
    dayConfig: DayConfig,
    seed: string | number,
    strategy: BotStrategy = 'targeted',
    maxSteps: number = 350
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
    let dangerSteps = 0;
    let completionOccurredInDanger = false;
    let realRecoveries = 0;

    // Experience Metrics Trackers
    const nearCompletionStartStep = new Map<string, number>();
    const dwellTimes: number[] = [];

    let targetSwitches = 0;
    let lastTargetInstanceId: string | null = null;

    const closureSoleMissingStep = new Map<string, number>();
    const closureWaits: number[] = [];

    const orderAutoFillRates: number[] = [];
    let instantAutoFillCount = 0;

    let lastOrderCompletedStep = 0;
    const orderIntervals: number[] = [];

    // Event Bindings
    session.events.on('BOARD_DANGER', () => {
      if (!inDanger) {
        inDanger = true;
        dangerEpisodes++;
      }
    });

    session.events.on('INGREDIENT_COMPLETED', ({ target }) => {
      if (inDanger) {
        completionOccurredInDanger = true;
      }
      if (nearCompletionStartStep.has(target.instanceId)) {
        dwellTimes.push(steps - nearCompletionStartStep.get(target.instanceId)!);
        nearCompletionStartStep.delete(target.instanceId);
      }
      closureSoleMissingStep.delete(target.instanceId);
    });

    session.events.on('PIECE_PLACED', ({ targetInstanceId }) => {
      if (lastTargetInstanceId !== null && lastTargetInstanceId !== targetInstanceId) {
        targetSwitches++;
      }
      lastTargetInstanceId = targetInstanceId;
    });

    session.events.on('PIECE_SPAWNED', ({ piece }) => {
      if (piece.targetInstanceId && closureSoleMissingStep.has(piece.targetInstanceId)) {
        const target = session.grid.getTarget(piece.targetInstanceId);
        if (target) {
          const closureSlot = Object.keys(target.pieceReleasePlan).find(
            s => target.pieceReleasePlan[s] === 'closure'
          );
          if (piece.slotId === closureSlot) {
            closureWaits.push(steps - closureSoleMissingStep.get(piece.targetInstanceId)!);
            closureSoleMissingStep.delete(piece.targetInstanceId);
          }
        }
      }
    });

    session.events.on('ORDER_CREATED', ({ order }) => {
      let reservedInit = 0;
      let neededTotal = 0;
      for (const item of order.items) {
        neededTotal += item.needed;
        const available = session.inventory.getAvailable(item.ingredientId);
        reservedInit += Math.min(item.needed, available);
      }
      const rate = neededTotal > 0 ? reservedInit / neededTotal : 0;
      orderAutoFillRates.push(rate);
      if (neededTotal > 0 && reservedInit >= neededTotal) {
        instantAutoFillCount++;
      }
    });

    session.events.on('ORDER_COMPLETED', () => {
      orderIntervals.push(steps - lastOrderCompletedStep);
      lastOrderCompletedStep = steps;
    });

    // Record initial order auto-fill state if order created at init
    if (session.orderSystem.currentOrder && orderAutoFillRates.length === 0) {
      const initOrder = session.orderSystem.currentOrder;
      let reservedInit = 0;
      let neededTotal = 0;
      for (const item of initOrder.items) {
        neededTotal += item.needed;
        const available = session.inventory.getAvailable(item.ingredientId);
        reservedInit += Math.min(item.needed, available);
      }
      orderAutoFillRates.push(neededTotal > 0 ? reservedInit / neededTotal : 0);
      if (neededTotal > 0 && reservedInit >= neededTotal) {
        instantAutoFillCount++;
      }
    }

    // Step Loop
    while (!session.isGameOver && steps < maxSteps) {
      steps++;

      const currentOccupied = session.grid.getOccupiedCellCount();
      const currentHeight = session.grid.getMaxStackHeight();
      occupiedCellSum += currentOccupied;
      if (currentOccupied > peakOccupiedCells) peakOccupiedCells = currentOccupied;
      stackHeightSum += currentHeight;
      if (currentHeight > peakStackHeight) peakStackHeight = currentHeight;

      const currentDanger = session.isBoardInDanger();
      if (currentDanger) {
        dangerSteps++;
      }

      // Check Real Recovery condition:
      // Entered danger -> ingredient completed while in danger -> board health returns to non-danger
      if (inDanger && completionOccurredInDanger && !currentDanger) {
        realRecoveries++;
        inDanger = false;
        completionOccurredInDanger = false;
      } else if (!currentDanger) {
        inDanger = false;
      }

      // Monitor target near-completion & closure readiness
      for (const target of session.grid.getAllTargets()) {
        const totalSlots = target.placedSlotIds.length + target.missingSlotIds.length;
        const progress = totalSlots > 0 ? target.placedSlotIds.length / totalSlots : 0;

        if ((progress >= 0.70 || target.missingSlotIds.length <= 1) && !nearCompletionStartStep.has(target.instanceId)) {
          nearCompletionStartStep.set(target.instanceId, steps);
        }

        const closureSlot = Object.keys(target.pieceReleasePlan).find(
          s => target.pieceReleasePlan[s] === 'closure'
        );
        if (
          target.missingSlotIds.length === 1 &&
          target.missingSlotIds[0] === closureSlot &&
          !closureSoleMissingStep.has(target.instanceId)
        ) {
          closureSoleMissingStep.set(target.instanceId, steps);
        }
      }

      const state = session.getState();
      const loosePieces = state.loosePieces;

      // Find all legal placements strictly respecting Target-first Instance Binding
      const legalMoves: Array<{ pieceId: string; targetId: string; slotId: string; score: number }> = [];

      for (const piece of loosePieces) {
        const target = session.grid.getTarget(piece.targetInstanceId);
        if (target && target.missingSlotIds.includes(piece.slotId)) {
          let score = 10;
          const totalSlots = target.placedSlotIds.length + target.missingSlotIds.length;
          const progress = totalSlots > 0 ? target.placedSlotIds.length / totalSlots : 0;

          if (strategy === 'novice') {
            // NOVICE: "看到什么就拼什么"
            // Purely local board decisions, zero awareness of current order or next order preview
            score = 10 + botRng.next() * 5;
          } else if (strategy === 'targeted') {
            // TARGETED: "优先完成当前订单需要的食材，完成得更快"
            // Strongly focuses on current order requirements
            if (state.currentOrder) {
              const item = state.currentOrder.items.find(
                (i: any) => i.ingredientId === target.ingredientId
              );
              if (item && item.reserved < item.needed) {
                score += 60;
                // Prefer finishing current order targets that have fewer missing slots
                score += (totalSlots - target.missingSlotIds.length) * 8;
              }
            }
            // General board progress fallback
            score += progress * 15;
          } else if (strategy === 'master') {
            // MASTER: "根据当前订单、下一订单预告、已有库存主动提前备料，制造稳定连锁"
            // 1. Current order demand
            let isCurrentOrderNeed = false;
            if (state.currentOrder) {
              const item = state.currentOrder.items.find(
                (i: any) => i.ingredientId === target.ingredientId
              );
              if (item && item.reserved < item.needed) {
                isCurrentOrderNeed = true;
                score += 70;
                score += (totalSlots - target.missingSlotIds.length) * 10;
              }
            }

            // 2. Proactive Next Order Prep: Reads ONLY legal public UI preview (dishId)
            let isNextOrderNeed = false;
            const previewDishId = state.nextOrderPreview?.dishId;
            if (previewDishId && DEFAULT_RECIPES[previewDishId]) {
              const reqs = DEFAULT_RECIPES[previewDishId].requirements;
              const req = reqs.find((r: any) => r.ingredientId === target.ingredientId);
              if (req) {
                isNextOrderNeed = true;
                const currentStock = state.inventory[target.ingredientId] || 0;
                if (currentStock < req.count) {
                  // If current order is already satisfied or has no moves, prep next order aggressively!
                  if (!isCurrentOrderNeed) {
                    score += 65;
                  } else {
                    score += 35;
                  }
                }
              }
            }

            // 3. Space relief & finisher: finish any target with only 1 slot left to free up 4~9 cells
            if (target.missingSlotIds.length === 1) {
              score += 30;
            }

            // 4. Inventory discipline: Penalize hoarding unneeded ingredients
            if (!isCurrentOrderNeed && !isNextOrderNeed) {
              const currentStock = state.inventory[target.ingredientId] || 0;
              if (currentStock >= 1) {
                score -= 45;
              }
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

      // Pick best move
      legalMoves.sort((a, b) => b.score - a.score);
      const pick = legalMoves[0];
      session.placePiece(pick.pieceId, pick.targetId, pick.slotId);
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

    const piecesPlaced = session.stats.piecesPlaced;
    const ordersCompleted = session.stats.ordersCompleted;
    const totalRevenue = session.stats.totalRevenue;
    const piecesPerOrder = ordersCompleted > 0 ? Math.round((piecesPlaced / ordersCompleted) * 10) / 10 : piecesPlaced;
    const businessGoalEfficiency = piecesPlaced > 0 ? Math.round((totalRevenue / piecesPlaced) * 100) / 100 : 0;

    const avgNearCompletionDwellTime = dwellTimes.length > 0
      ? Math.round((dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length) * 10) / 10
      : 0;

    const targetSwitchingFrequency = piecesPlaced > 1
      ? Math.round((targetSwitches / (piecesPlaced - 1)) * 100) / 100
      : 0;

    const avgClosureWait = closureWaits.length > 0
      ? Math.round((closureWaits.reduce((a, b) => a + b, 0) / closureWaits.length) * 10) / 10
      : 0;

    const avgOrderAutoFillRate = orderAutoFillRates.length > 0
      ? Math.round((orderAutoFillRates.reduce((a, b) => a + b, 0) / orderAutoFillRates.length) * 100) / 100
      : 0;

    const avgOrderInterval = orderIntervals.length > 0
      ? Math.round((orderIntervals.reduce((a, b) => a + b, 0) / orderIntervals.length) * 10) / 10
      : 0;

    const inventoryWaste = Object.values(finalState.inventory).reduce((a, b) => a + b, 0);

    return {
      classification,
      cleared: classification === 'CLEAR',
      blocked: classification === 'BLOCKED',
      safetyLimit: classification === 'SAFETY_LIMIT',
      session,
      steps,

      dangerEpisodes,
      dangerSteps,
      dangerTimeRatio: steps > 0 ? Math.round((dangerSteps / steps) * 100) / 100 : 0,
      realRecoveries,
      avgOccupiedCells: steps > 0 ? Math.round((occupiedCellSum / steps) * 10) / 10 : finalOccupied,
      peakOccupiedCells,
      avgMaxStackHeight: steps > 0 ? Math.round((stackHeightSum / steps) * 10) / 10 : finalHeight,
      peakStackHeight,

      avgNearCompletionDwellTime,
      targetSwitchingFrequency,
      avgClosureWait,

      piecesPlaced,
      ordersCompleted,
      piecesPerOrder,
      avgFinalRevenue: totalRevenue,
      businessGoalEfficiency,
      avgOrderAutoFillRate,
      instantAutoFillCount,
      avgOrderInterval,
      inventoryWaste,
      maxCascadeChain: session.stats.maxCascadeChain,
      cascadeEventsCount: session.stats.cascadeEventsCount,

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
      let totalOrders = 0;
      let totalRevenue = 0;
      let cascadeRunsCount = 0;
      let highestMaxCascadeChain = 0;
      let totalInventoryWaste = 0;

      let totalDangerEpisodes = 0;
      let totalDangerTimeRatio = 0;
      let totalRealRecoveries = 0;
      let totalOccupiedSum = 0;
      let highestPeakOccupied = 0;
      let totalHeightSum = 0;
      let highestPeakHeight = 0;

      let totalDwellTime = 0;
      let totalSwitchingFreq = 0;
      let totalClosureWait = 0;
      let totalAutoFillRate = 0;
      let totalInstantAutoFill = 0;
      let totalOrderInterval = 0;

      for (let i = 0; i < runsPerDay; i++) {
        const seed = `sim_${day.dayNumber}_run_${i}_${strategy}`;
        const result = this.runSingleGame(day, seed, strategy);
        const stats = result.session.stats;

        if (result.classification === 'CLEAR') clearedCount++;
        else if (result.classification === 'BLOCKED') blockedCount++;
        else safetyLimitCount++;

        if (result.softlocked) softlockCount++;

        totalPiecesPlaced += stats.piecesPlaced;
        totalOrders += stats.ordersCompleted;
        totalRevenue += stats.totalRevenue;
        totalDangerEpisodes += result.dangerEpisodes;
        totalDangerTimeRatio += result.dangerTimeRatio;
        totalRealRecoveries += result.realRecoveries;

        totalOccupiedSum += result.avgOccupiedCells;
        if (result.peakOccupiedCells > highestPeakOccupied) highestPeakOccupied = result.peakOccupiedCells;
        totalHeightSum += result.avgMaxStackHeight;
        if (result.peakStackHeight > highestPeakHeight) highestPeakHeight = result.peakStackHeight;

        if (stats.cascadeEventsCount > 0) cascadeRunsCount++;
        if (stats.maxCascadeChain > highestMaxCascadeChain) highestMaxCascadeChain = stats.maxCascadeChain;

        totalInventoryWaste += result.inventoryWaste;

        totalDwellTime += result.avgNearCompletionDwellTime;
        totalSwitchingFreq += result.targetSwitchingFrequency;
        totalClosureWait += result.avgClosureWait;
        totalAutoFillRate += result.avgOrderAutoFillRate;
        totalInstantAutoFill += result.instantAutoFillCount;
        totalOrderInterval += result.avgOrderInterval;
      }

      const avgPieces = Math.round(totalPiecesPlaced / runsPerDay);
      const avgOrders = Math.round((totalOrders / runsPerDay) * 10) / 10;
      const avgRev = Math.round(totalRevenue / runsPerDay);

      reports.push({
        dayNumber: day.dayNumber,
        strategy,
        totalRuns: runsPerDay,
        clearedRuns: clearedCount,
        blockedRuns: blockedCount,
        safetyLimitRuns: safetyLimitCount,
        clearRatePct: Math.round((clearedCount / runsPerDay) * 100),

        avgPiecesPlaced: avgPieces,
        avgOrdersCompleted: avgOrders,
        avgPiecesPerOrder: avgOrders > 0 ? Math.round((avgPieces / avgOrders) * 10) / 10 : avgPieces,
        avgFinalRevenue: avgRev,
        businessGoalEfficiency: avgPieces > 0 ? Math.round((avgRev / avgPieces) * 100) / 100 : 0,

        avgAutoFillRatePct: Math.round((totalAutoFillRate / runsPerDay) * 100),
        instantAutoFillOrdersPerGame: Math.round((totalInstantAutoFill / runsPerDay) * 10) / 10,
        cascadeOccurrenceRatePct: Math.round((cascadeRunsCount / runsPerDay) * 100),
        maxCascadeChain: highestMaxCascadeChain,
        avgInventoryWaste: Math.round((totalInventoryWaste / runsPerDay) * 10) / 10,

        avgDangerEpisodes: Math.round((totalDangerEpisodes / runsPerDay) * 10) / 10,
        dangerTimeRatioPct: Math.round((totalDangerTimeRatio / runsPerDay) * 100),
        avgRealRecoveries: Math.round((totalRealRecoveries / runsPerDay) * 10) / 10,
        peakStackHeight: highestPeakHeight,
        avgOccupiedCells: Math.round((totalOccupiedSum / runsPerDay) * 10) / 10,
        peakOccupiedCells: highestPeakOccupied,

        avgNearCompletionDwellTime: Math.round((totalDwellTime / runsPerDay) * 10) / 10,
        targetSwitchingFrequencyPct: Math.round((totalSwitchingFreq / runsPerDay) * 100),
        avgClosureWait: Math.round((totalClosureWait / runsPerDay) * 10) / 10,
        avgOrderInterval: Math.round((totalOrderInterval / runsPerDay) * 10) / 10,
        softlockCount
      });
    }

    return reports;
  }
}

// CLI execution if executed directly
if (process.argv[1] && process.argv[1].endsWith('SimulationRunner.ts')) {
  console.log('========================================================================');
  console.log('  Running 3-Strategy Monte-Carlo Balance Simulations (Stage 2 Tuning)  ');
  console.log('========================================================================\n');

  for (const strategy of ['novice', 'targeted', 'master'] as BotStrategy[]) {
    console.log(`\n>>> STRATEGY: ${strategy.toUpperCase()} (100 runs per Day) <<<`);
    const reports = SimulationRunner.runBatch([DEFAULT_DAYS[0], DEFAULT_DAYS[1], DEFAULT_DAYS[2]], 100, strategy);
    console.table(reports);
  }
}
