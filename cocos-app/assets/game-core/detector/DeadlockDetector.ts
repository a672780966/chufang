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

    // 3. Check spawnable missing pieces (must have unspawned missing slots AND open top cell)
    let hasSpawnableMissingPiece = false;
    const spawnedSlotsByTarget = new Map<string, Set<string>>();
    for (const p of loosePieces) {
      let set = spawnedSlotsByTarget.get(p.targetInstanceId);
      if (!set) {
        set = new Set();
        spawnedSlotsByTarget.set(p.targetInstanceId, set);
      }
      set.add(p.slotId);
    }

    const hasAnyUnspawnedMissingSlots = targets.some(t => {
      const spawned = spawnedSlotsByTarget.get(t.instanceId);
      return t.missingSlotIds.some(s => !spawned || !spawned.has(s));
    });

    if (hasAnyUnspawnedMissingSlots) {
      const topRow = grid.totalRows - 1;
      for (let c = 0; c < grid.columns; c++) {
        if (grid.isCellEmpty({ col: c, row: topRow })) {
          hasSpawnableMissingPiece = true;
          break;
        }
      }
    }

    // 4. Check legal target spawn (must fit in top Spawn Zone)
    let hasLegalTargetSpawn = false;
    if (targets.length < targetIngredientQuota) {
      for (const def of Object.values(ingredients)) {
        const validAnchors = grid.findSpawnAnchorsForFootprint(def.footprint);
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
