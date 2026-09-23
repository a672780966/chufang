import { BoardGrid } from '../board/BoardGrid.js';
import { IngredientDefinition } from '../model/Types.js';

export interface DeadlockCheckResult {
  isDeadlocked: boolean;
  isDanger: boolean;
  hasLegalPiecePlacement: boolean;
  hasPendingClear: boolean;
  hasSpawnableMissingPiece: boolean;
  hasLegalTargetSpawn: boolean;
  topRowOccupancy: number;
}

export class DeadlockDetector {
  /**
   * Deterministically evaluates whether the board has reached an unrecoverable deadlock (NoLegalBoardContinuation).
   *
   * Only triggers deadlock when:
   * 1. No legal piece placement exists on board
   * 2. No target is ready for clear
   * 3. No missing piece can spawn at top
   * 4. No new target can legally spawn
   */
  static evaluate(
    grid: BoardGrid,
    ingredients: Record<string, IngredientDefinition>,
    targetIngredientQuota: number
  ): DeadlockCheckResult {
    const targets = grid.getAllTargets();
    const loosePieces = grid.getAllLoosePieces();

    // 1. Check pending clear
    const hasPendingClear = targets.some(t => t.missingSlotIds.length === 0);

    // 2. Check legal piece placements
    let hasLegalPiecePlacement = false;
    for (const piece of loosePieces) {
      const target = grid.getTarget(piece.targetInstanceId);
      if (target && target.missingSlotIds.includes(piece.slotId)) {
        hasLegalPiecePlacement = true;
        break;
      }
    }

    // 3. Check spawnable missing pieces (is there at least one column with an empty cell at the top buffer?)
    let hasSpawnableMissingPiece = false;
    const hasAnyMissingPieces = targets.some(t => t.missingSlotIds.length > 0);
    if (hasAnyMissingPieces) {
      for (let c = 0; c < grid.columns; c++) {
        // Check if top spawn buffer cell in this column is empty
        if (grid.isCellEmpty({ col: c, row: grid.totalRows - 1 })) {
          hasSpawnableMissingPiece = true;
          break;
        }
      }
    }

    // 4. Check legal target spawn
    let hasLegalTargetSpawn = false;
    if (targets.length < targetIngredientQuota) {
      // Check if any ingredient definition has a valid anchor spot on the board
      for (const def of Object.values(ingredients)) {
        const validAnchors = grid.findValidAnchorsForFootprint(def.footprint);
        if (validAnchors.length > 0) {
          hasLegalTargetSpawn = true;
          break;
        }
      }
    }

    // Danger check
    const topRowOccupancy = grid.getTopRowOccupancyRatio();
    const isDanger = topRowOccupancy >= 0.75;

    // True deadlock only if all 4 continuation paths are completely impossible
    const isDeadlocked =
      !hasLegalPiecePlacement &&
      !hasPendingClear &&
      !hasSpawnableMissingPiece &&
      !hasLegalTargetSpawn;

    return {
      isDeadlocked,
      isDanger,
      hasLegalPiecePlacement,
      hasPendingClear,
      hasSpawnableMissingPiece,
      hasLegalTargetSpawn,
      topRowOccupancy
    };
  }
}
