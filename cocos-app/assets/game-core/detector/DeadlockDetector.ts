import { BoardGrid } from '../board/BoardGrid.js';
import { IngredientDefinition } from '../model/Types.js';

export interface DeadlockCheckResult {
  isDeadlocked: boolean;
  isDanger: boolean;
  hasLegalPiecePlacement: boolean;
  hasPendingClear: boolean;
  hasCompletableTargetOnBoard: boolean;
  hasSpawnableMissingPiece: boolean;
  hasLegalTargetSpawn: boolean;
  topRowOccupancy: number;
  maxStackHeight: number;
}

export class DeadlockDetector {
  /**
   * Deterministically evaluates whether the board has reached an unrecoverable deadlock (NoLegalBoardContinuation).
   *
   * Rigorous mathematical condition:
   * Only triggers deadlock when:
   * 1. No target is ready for clear (hasPendingClear === false)
   * 2. No target can be completed by placing current on-board loose pieces (hasCompletableTargetOnBoard === false)
   * 3. No missing piece can spawn at top (hasSpawnableMissingPiece === false)
   * 4. No new target can legally spawn (hasLegalTargetSpawn === false)
   *
   * As long as the player can complete at least one target to release space, it is NEVER a deadlock!
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

    // 2. Track which slots are currently present on board as loose pieces
    const looseSlotsByTarget = new Map<string, Set<string>>();
    let hasLegalPiecePlacement = false;

    for (const p of loosePieces) {
      let set = looseSlotsByTarget.get(p.targetInstanceId);
      if (!set) {
        set = new Set();
        looseSlotsByTarget.set(p.targetInstanceId, set);
      }
      set.add(p.slotId);

      const target = grid.getTarget(p.targetInstanceId);
      if (target && target.missingSlotIds.includes(p.slotId)) {
        hasLegalPiecePlacement = true;
      }
    }

    // 3. Can ANY target be completed using exclusively the loose pieces already on the board?
    const hasCompletableTargetOnBoard = targets.some(t => {
      const looseSet = looseSlotsByTarget.get(t.instanceId);
      if (!looseSet) return false;
      return t.missingSlotIds.every(slotId => looseSet.has(slotId));
    });

    // 4. Check spawnable missing pieces (must have unspawned missing slots AND open top cell)
    let hasSpawnableMissingPiece = false;
    const hasAnyUnspawnedMissingSlots = targets.some(t => {
      const spawned = looseSlotsByTarget.get(t.instanceId);
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

    // 5. Check legal target spawn (strictly uses top Spawn Zone)
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

    // Danger check: stack height reaches danger line (rows - 3 or higher) OR top rows occupancy >= 0.20
    const topRowOccupancy = grid.getTopRowOccupancyRatio();
    const maxStackHeight = grid.getMaxStackHeight();
    const isDanger = maxStackHeight >= grid.rows - 3 || topRowOccupancy >= 0.20;

    // True deadlock (PRD 3.1): Zero legal operations and zero passive clears
    const isDeadlocked =
      !hasPendingClear &&
      !hasLegalPiecePlacement &&
      !hasSpawnableMissingPiece &&
      !hasLegalTargetSpawn;

    return {
      isDeadlocked,
      isDanger,
      hasLegalPiecePlacement,
      hasPendingClear,
      hasCompletableTargetOnBoard,
      hasSpawnableMissingPiece,
      hasLegalTargetSpawn,
      topRowOccupancy,
      maxStackHeight
    };
  }
}
