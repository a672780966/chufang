import { GameSession } from '../session/GameSession';
import { DEFAULT_DAYS } from '../data/DefaultData';
import { TelemetryManager, DaySessionSummary } from './TelemetryManager';
import { SeededRandom } from '../random/SeededRandom';

export type PlayerPersona = 'novice_first_timer' | 'targeted_casual' | 'strategic_master';

export interface PersonaPlaytestResult {
  persona: PlayerPersona;
  daysEvaluated: number[];
  allCleared: boolean;
  summaries: DaySessionSummary[];
  averagePiecesPerDay: number;
  averageWrongDropRate: number;
  cascadeRate: number;
}

export class PlaytestSimulator {
  /**
   * Simulates a single day playthrough with a specified player persona.
   */
  static simulateDayPlaythrough(
    dayNumber: number,
    persona: PlayerPersona,
    seed: string | number
  ): DaySessionSummary {
    const dayConfig = DEFAULT_DAYS[dayNumber - 1];
    const session = new GameSession(dayConfig, seed);
    const rng = new SeededRandom(`sim_${persona}_day_${dayNumber}_${seed}`);

    TelemetryManager.log('day_start', dayNumber);

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
        TelemetryManager.log('danger_enter', dayNumber);
      } else if (!dangerNow && isInDanger) {
        isInDanger = false;
        TelemetryManager.log('danger_recovery', dayNumber);
      }

      // Persona behavior for selecting moves:
      const loose = session.grid.getAllLoosePieces();
      const targets = session.grid.getAllTargets();

      if (loose.length === 0 || targets.length === 0) break;

      // Novice occasional mis-drag (wrong drop)
      if (persona === 'novice_first_timer' && rng.next() < 0.15) {
        TelemetryManager.log('wrong_drop', dayNumber, { reason: 'accidental_mismatch' });
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
        // No legal move; session might be blocked
        break;
      }

      let chosenMove = legalMoves[0];

      if (persona === 'strategic_master') {
        // Master: Prioritize target needed by current order or near-completion (missing <= 1)
        const currentDish = session.orderSystem.currentOrder;
        const currentReqIds = new Set(currentDish ? currentDish.items.map(i => i.ingredientId) : []);

        const orderMove = legalMoves.find(m => currentReqIds.has(m.target.ingredientId));
        const nearCompleteMove = legalMoves.find(m => m.target.missingSlotIds.length <= 1);

        chosenMove = nearCompleteMove || orderMove || legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      } else if (persona === 'targeted_casual') {
        // Casual: Follows current order items if visible, otherwise random legal
        const currentDish = session.orderSystem.currentOrder;
        const currentReqIds = new Set(currentDish ? currentDish.items.map(i => i.ingredientId) : []);
        const orderMove = legalMoves.find(m => currentReqIds.has(m.target.ingredientId));
        chosenMove = orderMove || legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      } else {
        // Novice: Picks any readily recognizable legal piece
        chosenMove = legalMoves[rng.nextInt(0, legalMoves.length - 1)];
      }

      // Execute placement
      const prevRevenue = session.revenue;
      const prevOrders = session.stats.ordersCompleted;
      const prevCascades = session.stats.cascadeCount;

      const res = session.placePiece(chosenMove.piece.instanceId, chosenMove.target.instanceId, chosenMove.slotId);

      if (res.success) {
        TelemetryManager.log('piece_placed', dayNumber, {
          targetInstanceId: chosenMove.target.instanceId,
          ingredientId: chosenMove.target.ingredientId,
          slotId: chosenMove.slotId
        });

        if (chosenMove.target.missingSlotIds.length === 0) {
          TelemetryManager.log('ingredient_complete', dayNumber, {
            ingredientId: chosenMove.target.ingredientId
          });
        }

        if (session.stats.ordersCompleted > prevOrders) {
          TelemetryManager.log('order_complete', dayNumber, {
            revenue: session.revenue
          });
        }

        if (session.stats.cascadeCount > prevCascades) {
          TelemetryManager.log('cascade', dayNumber, {
            count: session.stats.cascadeCount
          });
        }

        if (session.revenue >= dayConfig.businessGoal) {
          TelemetryManager.log('day_clear', dayNumber, { revenue: session.revenue });
          break;
        }
      }
    }

    if (session.revenue >= dayConfig.businessGoal) {
      TelemetryManager.log('day_clear', dayNumber, { revenue: session.revenue });
    } else {
      TelemetryManager.log('day_fail', dayNumber, { reason: 'turns_exceeded_or_blocked' });
    }

    return TelemetryManager.summarizeDay(dayNumber, dayConfig.businessGoal);
  }

  /**
   * Runs the complete multi-persona evaluation across requested days.
   */
  static runCampaignEvaluation(
    persona: PlayerPersona,
    days: number[] = [1, 2, 3],
    seedBase: number = 777
  ): PersonaPlaytestResult {
    TelemetryManager.clear();
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
      averagePiecesPerDay: totalPieces / summaries.length,
      averageWrongDropRate: totalPieces > 0 ? totalWrong / (totalPieces + totalWrong) : 0,
      cascadeRate: totalCascades / summaries.length
    };
  }
}
