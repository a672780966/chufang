import { GameSession, DEFAULT_DAYS, SeededRandom, TelemetryEvent } from '../../game-core/src/index';

export type PlayerPersona = 'novice_first_timer' | 'targeted_casual' | 'strategic_master';

export interface DaySessionSummary {
  dayNumber: number;
  durationMs: number;
  piecesPlaced: number;
  wrongDrops: number;
  targetSwitches: number;
  ingredientsCompleted: number;
  ordersCompleted: number;
  cascades: number;
  dangerEvents: number;
  dangerRecoveries: number;
  finalRevenue: number;
  businessGoal: number;
  isCleared: boolean;
}

export interface PersonaPlaytestResult {
  persona: PlayerPersona;
  daysEvaluated: number[];
  allCleared: boolean;
  summaries: DaySessionSummary[];
  averagePiecesPerDay: number;
  averageWrongDropRate: number;
  cascadeRate: number;
}

export class SimulationTelemetryCollector {
  private static _events: TelemetryEvent[] = [];
  private static _dayStartTimes = new Map<number, number>();

  static log(
    eventType: string,
    dayNumber: number,
    payload?: Record<string, any>
  ): void {
    const timestamp = Date.now();
    const event: TelemetryEvent = {
      source: 'synthetic',
      eventType,
      timestamp,
      dayNumber,
      payload
    };
    this._events.push(event);

    if (eventType === 'day_start') {
      this._dayStartTimes.set(dayNumber, timestamp);
    }
  }

  static getEvents(): TelemetryEvent[] {
    return [...this._events];
  }

  static clear(): void {
    this._events = [];
    this._dayStartTimes.clear();
  }

  static summarizeDay(dayNumber: number, businessGoal: number): DaySessionSummary {
    const dayEvents = this._events.filter(e => e.dayNumber === dayNumber);
    const startEvent = dayEvents.find(e => e.eventType === 'day_start');
    const endEvent = dayEvents.slice().reverse().find(e => e.eventType === 'day_clear' || e.eventType === 'day_fail');

    const durationMs = startEvent && endEvent ? endEvent.timestamp - startEvent.timestamp : 0;

    let piecesPlaced = 0;
    let wrongDrops = 0;
    let targetSwitches = 0;
    let ingredientsCompleted = 0;
    let ordersCompleted = 0;
    let cascades = 0;
    let dangerEvents = 0;
    let dangerRecoveries = 0;
    let finalRevenue = 0;
    let isCleared = false;
    let lastTargetId: string | null = null;

    for (const e of dayEvents) {
      switch (e.eventType) {
        case 'piece_placed':
          piecesPlaced++;
          if (e.payload?.targetInstanceId) {
            if (lastTargetId && lastTargetId !== e.payload.targetInstanceId) {
              targetSwitches++;
            }
            lastTargetId = e.payload.targetInstanceId;
          }
          break;
        case 'wrong_drop':
          wrongDrops++;
          break;
        case 'ingredient_complete':
          ingredientsCompleted++;
          break;
        case 'order_complete':
          ordersCompleted++;
          if (e.payload?.revenue) {
            finalRevenue = e.payload.revenue;
          }
          break;
        case 'cascade':
          cascades++;
          break;
        case 'danger_enter':
          dangerEvents++;
          break;
        case 'danger_recovery':
          dangerRecoveries++;
          break;
        case 'day_clear':
          isCleared = true;
          if (e.payload?.revenue) finalRevenue = e.payload.revenue;
          break;
      }
    }

    return {
      dayNumber,
      durationMs,
      piecesPlaced,
      wrongDrops,
      targetSwitches,
      ingredientsCompleted,
      ordersCompleted,
      cascades,
      dangerEvents,
      dangerRecoveries,
      finalRevenue,
      businessGoal,
      isCleared
    };
  }
}

export class PlaytestSimulator {
  /**
   * Simulates a single day playthrough with a specified player persona bot.
   */
  static simulateDayPlaythrough(
    dayNumber: number,
    persona: PlayerPersona,
    seed: string | number
  ): DaySessionSummary {
    const dayConfig = DEFAULT_DAYS[dayNumber - 1];
    const session = new GameSession(dayConfig, seed);
    const rng = new SeededRandom(`sim_${persona}_day_${dayNumber}_${seed}`);

    SimulationTelemetryCollector.log('day_start', dayNumber);

    let turns = 0;
    const maxTurns = Math.max(350, Math.ceil(dayConfig.businessGoal * 0.45));
    let isInDanger = false;

    // Simulation loop
    while (!session.isGameOver && turns < maxTurns) {
      turns++;

      // Check danger state transition
      const dangerNow = session.isBoardInDanger();
      if (dangerNow && !isInDanger) {
        isInDanger = true;
        SimulationTelemetryCollector.log('danger_enter', dayNumber);
      } else if (!dangerNow && isInDanger) {
        isInDanger = false;
        SimulationTelemetryCollector.log('danger_recovery', dayNumber);
      }

      // Persona behavior for selecting moves:
      const loose = session.grid.getAllLoosePieces();
      const targets = session.grid.getAllTargets();

      if (loose.length === 0 || targets.length === 0) break;

      // Novice occasional mis-drag (wrong drop)
      if (persona === 'novice_first_timer' && rng.next() < 0.15) {
        SimulationTelemetryCollector.log('wrong_drop', dayNumber, { reason: 'accidental_mismatch' });
      }

      // Find valid placements
      const legalMoves: { piece: any; target: any; slotId: string }[] = [];
      for (const p of loose) {
        const t = targets.find(target => target.instanceId === p.targetInstanceId);
        if (t && t.missingSlotIds.includes(p.slotId)) {
          legalMoves.push({ piece: p, target: t, slotId: p.slotId });
        }
      }

      if (legalMoves.length === 0) {
        break;
      }

      let chosenMove = legalMoves[0];

      if (persona === 'strategic_master') {
        const currentDish = session.orderSystem.currentOrder;
        const currentReqIds = new Set(currentDish ? currentDish.items.map(i => i.ingredientId) : []);
        const orderMove = legalMoves.find(m => currentReqIds.has(m.target.ingredientId));
        const nearCompleteMove = legalMoves.find(m => m.target.missingSlotIds.length <= 1);
        chosenMove = nearCompleteMove || orderMove || legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      } else if (persona === 'targeted_casual') {
        const currentDish = session.orderSystem.currentOrder;
        const currentReqIds = new Set(currentDish ? currentDish.items.map(i => i.ingredientId) : []);
        const orderMove = legalMoves.find(m => currentReqIds.has(m.target.ingredientId));
        chosenMove = orderMove || legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      } else {
        chosenMove = legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      }

      // Execute placement
      const prevOrders = session.stats.ordersCompleted;
      const prevCascades = session.stats.cascadeEventsCount;

      const res = session.placePiece(chosenMove.piece.instanceId, chosenMove.target.instanceId, chosenMove.slotId);

      if (res.success) {
        SimulationTelemetryCollector.log('piece_placed', dayNumber, {
          targetInstanceId: chosenMove.target.instanceId,
          ingredientId: chosenMove.target.ingredientId,
          slotId: chosenMove.slotId
        });

        if (chosenMove.target.missingSlotIds.length === 0) {
          SimulationTelemetryCollector.log('ingredient_complete', dayNumber, {
            ingredientId: chosenMove.target.ingredientId
          });
        }

        if (session.stats.ordersCompleted > prevOrders) {
          SimulationTelemetryCollector.log('order_complete', dayNumber, {
            revenue: session.revenue
          });
        }

        if (session.stats.cascadeEventsCount > prevCascades) {
          SimulationTelemetryCollector.log('cascade', dayNumber, {
            count: session.stats.cascadeEventsCount
          });
        }

        if (session.revenue >= dayConfig.businessGoal) {
          SimulationTelemetryCollector.log('day_clear', dayNumber, { revenue: session.revenue });
          break;
        }
      }
    }

    if (session.revenue >= dayConfig.businessGoal) {
      SimulationTelemetryCollector.log('day_clear', dayNumber, { revenue: session.revenue });
    } else {
      SimulationTelemetryCollector.log('day_fail', dayNumber, { reason: 'turns_exceeded_or_blocked' });
    }

    return SimulationTelemetryCollector.summarizeDay(dayNumber, dayConfig.businessGoal);
  }

  /**
   * Runs the complete multi-persona synthetic evaluation across requested days.
   */
  static runCampaignEvaluation(
    persona: PlayerPersona,
    days: number[] = [1, 2, 3],
    seedBase: string | number = 777
  ): PersonaPlaytestResult {
    SimulationTelemetryCollector.clear();
    const summaries: DaySessionSummary[] = [];
    let allCleared = true;

    for (const day of days) {
      const summary = this.simulateDayPlaythrough(day, persona, `${seedBase}_day_${day}`);
      summaries.push(summary);
      if (!summary.isCleared) {
        allCleared = false;
      }
    }

    const totalPieces = summaries.reduce((acc, s) => acc + s.piecesPlaced, 0);
    const totalWrong = summaries.reduce((acc, s) => acc + s.wrongDrops, 0);
    const totalCascades = summaries.reduce((acc, s) => acc + s.cascades, 0);

    return {
      persona,
      daysEvaluated: days,
      allCleared,
      summaries,
      averagePiecesPerDay: summaries.length > 0 ? totalPieces / summaries.length : 0,
      averageWrongDropRate: totalPieces > 0 ? totalWrong / (totalPieces + totalWrong) : 0,
      cascadeRate: summaries.length > 0 ? totalCascades / summaries.length : 0
    };
  }
}
