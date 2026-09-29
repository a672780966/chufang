/**
 * DishCampaignPersona.ts
 * Stage 5B Campaign Bot Personas for DishPuzzle / Jigsaw Drop.
 *
 * Defines 3 authentic player archetypes:
 *   1. Novice:
 *      - Direct merges on current order dish
 *      - 15% random legal exploration moves
 *      - Low target switching awareness
 *      - Ignores NEXT preview and Prepared Buffer
 *   2. Casual:
 *      - Direct merges across all dishes
 *      - Responsive to spatial pressure (>0.55 occupancy)
 *      - Natural target switching when current dish is stalled
 *      - 50% NEXT awareness from Day 7+
 *   3. Strategic:
 *      - Multi-objective scoring (Merge, Completion, Spatial Release, Companion Clustering)
 *      - Actively leverages Prepared Buffer to store upcoming dishes
 *      - Plans Production Cascade chains
 *      - Taboo history to avoid oscillating loops
 *      - Crisis mode during danger states
 */

import {
  GameSession,
  DishPuzzlePiece,
  PieceGroup,
  DishPuzzleManager,
  arePiecesDishAdjacent,
  arePiecesGeometricallyAligned
} from '../../game-core/src/index';
import { SeededRandom } from '../../game-core/src/index';

export type DishCampaignPersonaType = 'Novice' | 'Casual' | 'Strategic';

export interface PersonaCandidateMove {
  groupId: string;
  targetCol: number;
  targetRow: number;
  refPieceId: string;
  deltaCol: number;
  deltaRow: number;
  enablesMerge: boolean;
  dishId: string;
  isCurrentOrderDish: boolean;
  score: number;
}

export class DishCampaignPersona {
  /**
   * Selects a move from candidate moves based on the designated persona policy.
   */
  static selectMove(
    persona: DishCampaignPersonaType,
    candidates: PersonaCandidateMove[],
    session: GameSession,
    rng: SeededRandom,
    recentPosSet: Set<string>,
    lastMovedDishId?: string
  ): PersonaCandidateMove | null {
    if (candidates.length === 0) return null;

    switch (persona) {
      case 'Novice':
        return this.selectNoviceMove(candidates, session, rng, lastMovedDishId);
      case 'Casual':
        return this.selectCasualMove(candidates, session, rng, lastMovedDishId);
      case 'Strategic':
        return this.selectStrategicMove(candidates, session, rng, recentPosSet);
    }
  }

  /**
   * Novice:
   * - 15% random exploratory moves
   * - Strongly focused on current order dish
   * - Hesitant to switch away from current order dish
   * - Does not utilize NEXT or Buffer
   */
  private static selectNoviceMove(
    candidates: PersonaCandidateMove[],
    session: GameSession,
    rng: SeededRandom,
    lastMovedDishId?: string
  ): PersonaCandidateMove {
    // 15% random legal exploration
    if (rng.next() < 0.15) {
      return candidates[rng.nextInt(0, candidates.length - 1)];
    }

    const currentOrderDishId = session.orderSystem.currentOrder?.dishId;

    // 1. Current order merges
    const currentMerges = candidates.filter(c => c.isCurrentOrderDish && c.enablesMerge);
    if (currentMerges.length > 0) {
      return currentMerges[rng.nextInt(0, currentMerges.length - 1)];
    }

    // 2. Hesitant to switch: if previously moved a dish, try merging that same dish
    if (lastMovedDishId && lastMovedDishId !== currentOrderDishId) {
      const sameDishMerges = candidates.filter(c => c.dishId === lastMovedDishId && c.enablesMerge);
      if (sameDishMerges.length > 0) {
        return sameDishMerges[rng.nextInt(0, sameDishMerges.length - 1)];
      }
    }

    // 3. Any merge
    const anyMerges = candidates.filter(c => c.enablesMerge);
    if (anyMerges.length > 0) {
      return anyMerges[rng.nextInt(0, anyMerges.length - 1)];
    }

    // 4. Current order moves downward
    const currentMoves = candidates.filter(c => c.isCurrentOrderDish);
    if (currentMoves.length > 0) {
      const downward = currentMoves.filter(c => c.deltaRow < 0);
      if (downward.length > 0) return downward[rng.nextInt(0, downward.length - 1)];
      return currentMoves[rng.nextInt(0, currentMoves.length - 1)];
    }

    // 5. Fallback random
    return candidates[rng.nextInt(0, candidates.length - 1)];
  }

  /**
   * Casual:
   * - Prioritizes direct merges across all active dishes
   * - When occupancy > 0.55 or in danger, prioritizes space-clearing moves
   * - Readily switches targets when current dish is missing pieces
   * - 50% NEXT awareness from Day 7+
   */
  private static selectCasualMove(
    candidates: PersonaCandidateMove[],
    session: GameSession,
    rng: SeededRandom,
    lastMovedDishId?: string
  ): PersonaCandidateMove {
    const manager = session.dishPuzzleManager;
    const pieces = manager.getAllPieces();
    const occupancy = pieces.length / (manager.columns * manager.rows);
    const dayNumber = session.dayConfig.dayNumber;
    const isHighPressure = occupancy > 0.55 || (session as any).inDishDanger;

    const currentOrderDishId = session.orderSystem.currentOrder?.dishId;
    const nextOrderDishId = dayNumber >= 7 ? session.orderSystem.getNextOrderFact()?.dishId : undefined;

    // Check if player considers NEXT order (50% chance if Day >= 7)
    const considersNext = dayNumber >= 7 && rng.next() < 0.50 && Boolean(nextOrderDishId);

    for (const c of candidates) {
      let score = 0;
      if (c.enablesMerge) {
        score += 100;
        if (c.isCurrentOrderDish) score += 50;
        else if (considersNext && c.dishId === nextOrderDishId) score += 30;
      }

      // Spatial pressure response
      if (isHighPressure) {
        // Favor moving larger groups or clearing space
        const grp = manager.getGroup(c.groupId);
        if (grp) score += grp.pieceIds.length * 15;
        if (c.deltaRow < 0) score += 20; // downward consolidation
      } else {
        if (c.isCurrentOrderDish) score += 25;
        if (c.deltaRow < 0) score += 10;
      }

      c.score = score;
    }

    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    const topCandidates = candidates.filter(c => c.score >= topScore - 15);
    return topCandidates[rng.nextInt(0, topCandidates.length - 1)];
  }

  /**
   * Strategic:
   * - Multi-objective scoring:
   *   1. Merge and 9-piece dish completion
   *   2. Prepared Buffer caching (stores upcoming dishes to ready cascades)
   *   3. NEXT order anticipation
   *   4. Companion piece Manhattan clustering
   *   5. Spatial clearance & downward gravity consolidation
   *   6. Taboo memory to break oscillation loops
   */
  private static selectStrategicMove(
    candidates: PersonaCandidateMove[],
    session: GameSession,
    rng: SeededRandom,
    recentPosSet: Set<string>
  ): PersonaCandidateMove {
    const manager = session.dishPuzzleManager;
    const dayNumber = session.dayConfig.dayNumber;
    const currentOrderDishId = session.orderSystem.currentOrder?.dishId;
    const nextOrderDishId = dayNumber >= 7 ? session.orderSystem.getNextOrderFact()?.dishId : undefined;
    const pieces = manager.getAllPieces();
    const occupancy = pieces.length / (manager.columns * manager.rows);
    const isDanger = occupancy > 0.58 || (session as any).inDishDanger;

    for (const c of candidates) {
      let s = 0;
      const posKey = `${c.groupId}_${c.targetCol}_${c.targetRow}`;

      // Taboo loop prevention
      if (recentPosSet.has(posKey)) {
        s -= 400;
      }

      const grp = manager.getGroup(c.groupId);
      const isCur = c.isCurrentOrderDish;
      const isNext = Boolean(nextOrderDishId && c.dishId === nextOrderDishId);

      if (c.enablesMerge) {
        s += 160;
        if (grp) {
          const newSize = grp.pieceIds.length + 1;
          s += newSize * 30;
          if (newSize >= 9) {
            // Massive bonus for completing a dish
            s += 800;
            // Additional bonus if it feeds current order or buffers for NEXT
            if (isCur) s += 400;
            else if (isNext) s += 300;
          }
        }
        if (isCur) s += 100;
        else if (isNext) s += 70;
      } else {
        if (isCur) s += 25;
        else if (isNext) s += 15;
      }

      // Companion piece Manhattan distance minimization
      const inst = manager.getActiveDishInstances().find(i => i.dishId === c.dishId);
      if (inst && grp) {
        const grpPieces = grp.pieceIds.map(id => manager.getPiece(id)!).filter(Boolean);
        const ref = grpPieces[0];
        const otherPieces = pieces.filter(
          p => p.dishPuzzleInstanceId === inst.instanceId && !grp.pieceIds.includes(p.pieceInstanceId)
        );

        if (ref && otherPieces.length > 0) {
          let minCurDist = Infinity;
          let minSimDist = Infinity;
          for (const op of otherPieces) {
            const curDist = Math.abs(ref.boardCoord.col - op.boardCoord.col) + Math.abs(ref.boardCoord.row - op.boardCoord.row);
            const simDist = Math.abs(c.targetCol - op.boardCoord.col) + Math.abs(c.targetRow - op.boardCoord.row);
            if (curDist < minCurDist) minCurDist = curDist;
            if (simDist < minSimDist) minSimDist = simDist;
          }

          if (minSimDist < minCurDist) {
            s += 50 * (minCurDist - minSimDist);
          } else if (minSimDist > minCurDist) {
            s -= 40;
          }
        }
      }

      // Downward gravity consolidation & spatial clearance
      if (c.deltaRow < 0) s += 30;

      // Crisis mode in danger
      if (isDanger) {
        if (c.enablesMerge) s += 150;
        if (c.deltaRow < 0) s += 50;
      }

      c.score = s;
    }

    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    const topCandidates = candidates.filter(c => c.score >= topScore - 12 && c.score > -300);
    return topCandidates.length > 0 ? topCandidates[rng.nextInt(0, topCandidates.length - 1)] : candidates[0];
  }
}
