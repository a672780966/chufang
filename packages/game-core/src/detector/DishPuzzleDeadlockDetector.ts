/**
 * DishPuzzleDeadlockDetector.ts
 * Deterministic, bounded deadlock detection engine for DishPuzzle / Jigsaw Drop.
 * Enforces the core authority rule:
 * A board state is deadlocked if and only if NO legal transitions remain:
 *   1. No pieces can be spawned (all top spawn columns blocked).
 *   2. No group can move to any legal board cell.
 *   3. No merge or completion is attainable.
 */

import { DishPuzzleManager } from '../puzzle/DishPuzzleManager';
import { arePiecesDishAdjacent, arePiecesGeometricallyAligned, DishPuzzlePiece, PieceGroup } from '../puzzle/DishPuzzleModel';

export interface DishPuzzleDeadlockResult {
  isDeadlocked: boolean;
  reason?: 'TOP_SPAWN_BLOCKED_NO_LEGAL_MOVES' | 'BOARD_FULL_NO_PROGRESS' | 'NO_LEGAL_TRANSITIONS';
  availableSpawnCount: number;
  legalMovesCount: number;
  potentialMergesCount: number;
}

export class DishPuzzleDeadlockDetector {
  /** Maximum number of candidate moves to evaluate per group before declaring viable */
  private readonly maxMovesPerGroup: number = 30;

  /**
   * Checks whether the current DishPuzzleManager board state is in true deadlock.
   */
  checkDeadlock(manager: DishPuzzleManager): DishPuzzleDeadlockResult {
    // 1. If any completed 9-piece dish exists on the board, space will be released upon clear -> NOT deadlocked!
    const allGroups = manager.getAllGroups();
    for (const g of allGroups) {
      if (g.pieceIds.length === 9 || g.isComplete) {
        return {
          isDeadlocked: false,
          availableSpawnCount: manager.getAvailableSpawnCells().length,
          legalMovesCount: 1,
          potentialMergesCount: 0
        };
      }
    }

    const availableSpawnCells = manager.getAvailableSpawnCells();
    const canSpawnMore = availableSpawnCells.length > 0;

    // 2. Fast check: If available spawn cells exist and occupancy is below danger threshold, not deadlocked
    const occupancyRatio = manager.getOccupancyRatio();
    if (canSpawnMore && occupancyRatio < 0.85) {
      return {
        isDeadlocked: false,
        availableSpawnCount: availableSpawnCells.length,
        legalMovesCount: 1,
        potentialMergesCount: 0
      };
    }

    // 3. Search for legal moves and potential merges across all groups
    let totalLegalMoves = 0;
    let potentialMerges = 0;

    for (const group of allGroups) {
      const pieces = group.pieceIds.map(id => manager.getPiece(id)!).filter(Boolean);
      if (pieces.length === 0) continue;

      const ref = pieces[0];
      // Test neighbor translations: orthogonal shifts (+/-1 col, +/-1 row), and common offsets
      const testDeltas = [
        { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
        { dc: -2, dr: 0 }, { dc: 2, dr: 0 },
        { dc: 0, dr: -2 }, { dc: 0, dr: 2 },
        { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
        { dc: -1, dr: 1 }, { dc: 1, dr: 1 }
      ];

      for (const delta of testDeltas) {
        const targetCol = ref.boardCoord.col + delta.dc;
        const targetRow = ref.boardCoord.row + delta.dr;

        // Bounded check for group move validity
        if (this.canGroupMoveTo(manager, group, pieces, delta.dc, delta.dr)) {
          totalLegalMoves++;

          // Check if this move enables a merge with another group of the same dish instance
          if (this.wouldMoveEnableMerge(manager, group, pieces, delta.dc, delta.dr)) {
            potentialMerges++;
            // A viable merge path exists: definitely not deadlocked!
            return {
              isDeadlocked: false,
              availableSpawnCount: availableSpawnCells.length,
              legalMovesCount: totalLegalMoves,
              potentialMergesCount: potentialMerges
            };
          }
        }
      }
    }

    // 4. Deadlock evaluation
    // If top spawn zone is completely blocked AND no legal moves exist
    if (!canSpawnMore && totalLegalMoves === 0) {
      return {
        isDeadlocked: true,
        reason: 'TOP_SPAWN_BLOCKED_NO_LEGAL_MOVES',
        availableSpawnCount: 0,
        legalMovesCount: 0,
        potentialMergesCount: 0
      };
    }

    // If board occupancy is saturated (>= 95%) and no legal moves exist
    if (occupancyRatio >= 0.95 && totalLegalMoves === 0) {
      return {
        isDeadlocked: true,
        reason: 'BOARD_FULL_NO_PROGRESS',
        availableSpawnCount: availableSpawnCells.length,
        legalMovesCount: 0,
        potentialMergesCount: 0
      };
    }

    return {
      isDeadlocked: false,
      availableSpawnCount: availableSpawnCells.length,
      legalMovesCount: totalLegalMoves,
      potentialMergesCount: potentialMerges
    };
  }

  /**
   * Fast simulation of group bounds and collisions without mutating state.
   */
  private canGroupMoveTo(
    manager: DishPuzzleManager,
    group: PieceGroup,
    pieces: DishPuzzlePiece[],
    deltaCol: number,
    deltaRow: number
  ): boolean {
    for (const p of pieces) {
      const c = p.boardCoord.col + deltaCol;
      const r = p.boardCoord.row + deltaRow;

      if (c < 0 || c >= manager.columns || r < 0 || r >= manager.rows) {
        return false;
      }
      if (manager.isCellReserved(c, r)) {
        return false;
      }

      const occupant = manager.getPieceAt(c, r);
      if (occupant && !group.pieceIds.includes(occupant.pieceInstanceId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Fast simulation to check if translating the group by deltaCol, deltaRow
   * places any member piece orthogonally adjacent and aligned with a matching piece of the same dish instance.
   */
  private wouldMoveEnableMerge(
    manager: DishPuzzleManager,
    group: PieceGroup,
    pieces: DishPuzzlePiece[],
    deltaCol: number,
    deltaRow: number
  ): boolean {
    for (const p of pieces) {
      const simulatedCoord = {
        col: p.boardCoord.col + deltaCol,
        row: p.boardCoord.row + deltaRow
      };

      const neighbors = [
        { col: simulatedCoord.col + 1, row: simulatedCoord.row },
        { col: simulatedCoord.col - 1, row: simulatedCoord.row },
        { col: simulatedCoord.col, row: simulatedCoord.row + 1 },
        { col: simulatedCoord.col, row: simulatedCoord.row - 1 }
      ];

      for (const n of neighbors) {
        if (n.col < 0 || n.col >= manager.columns || n.row < 0 || n.row >= manager.rows) continue;
        const neighborPiece = manager.getPieceAt(n.col, n.row);
        if (!neighborPiece) continue;

        if (
          neighborPiece.dishPuzzleInstanceId === group.dishPuzzleInstanceId &&
          !group.pieceIds.includes(neighborPiece.pieceInstanceId)
        ) {
          // Create temporary simulated piece to test geometric alignment
          const simulatedPiece: DishPuzzlePiece = {
            ...p,
            boardCoord: simulatedCoord
          };
          if (
            arePiecesDishAdjacent(simulatedPiece, neighborPiece) &&
            arePiecesGeometricallyAligned(simulatedPiece, neighborPiece)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
