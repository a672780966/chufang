import { BoardGrid } from '../board/BoardGrid';
import { IngredientDefinition, RecipeDefinition } from '../model/Types';

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
   * Derives the exact set of legal target spawn candidates strictly available in the top Spawn Zone.
   * Shared 100% symmetrically between FlowDirector and DeadlockDetector!
   */
  static getLegalTargetSpawnCandidates(
    grid: BoardGrid,
    availableRecipeIds: string[],
    recipes: Record<string, RecipeDefinition>,
    ingredients: Record<string, IngredientDefinition>
  ): IngredientDefinition[] {
    const candidateSet = new Set<string>();
    for (const recipeId of availableRecipeIds) {
      const recipe = recipes[recipeId];
      if (!recipe) continue;
      for (const req of recipe.requirements) {
        candidateSet.add(req.ingredientId);
      }
    }

    const valid: IngredientDefinition[] = [];
    for (const ingredientId of candidateSet) {
      const def = ingredients[ingredientId];
      if (!def) continue;
      const spawnAnchors = grid.findSpawnAnchorsForFootprint(def.footprint);
      if (spawnAnchors.length > 0) {
        valid.push(def);
      }
    }
    return valid;
  }

  /**
   * Deterministically evaluates whether the board has reached an unrecoverable deadlock (NoLegalBoardContinuation).
   *
   * PRD 3.1 败局只有一种：棋盘彻底堵死（Board Blocked）
   * 1. 棋盘没有任何已完成待消除的目标 (!hasPendingClear)
   * 2. 当前棋盘上没有任何一个散块可以合法拼入任何现有目标 (!hasLegalPiecePlacement)
   * 3. 上方 Spawn Zone 完全无法生成新的合法散块 (!hasSpawnableMissingPiece)
   * 4. 上方 Spawn Zone 完全无法生成新的合法目标 (!hasLegalTargetSpawn)
   * 结论：玩家陷入零合法操作且无法被动触发任何清除的状态。
   */
  static evaluate(
    grid: BoardGrid,
    ingredients: Record<string, IngredientDefinition>,
    targetIngredientQuota: number,
    availableRecipeIds?: string[],
    recipes?: Record<string, RecipeDefinition>
  ): DeadlockCheckResult {
    const targets = grid.getAllTargets();
    const loosePieces = grid.getAllLoosePieces();

    // 1. Check pending clear
    const hasPendingClear = targets.some(t => t.missingSlotIds.length === 0);

    // 2. Track pieces by targetInstanceId and slotId on board
    // Target-first Instance Binding: a piece can ONLY be placed into its bound target instance!
    let hasLegalPiecePlacement = false;
    const piecesByTarget = new Map<string, Set<string>>();

    for (const p of loosePieces) {
      if (!p.targetInstanceId) continue;
      let set = piecesByTarget.get(p.targetInstanceId);
      if (!set) {
        set = new Set();
        piecesByTarget.set(p.targetInstanceId, set);
      }
      set.add(p.slotId);

      const target = grid.getTarget(p.targetInstanceId);
      if (target && target.missingSlotIds.includes(p.slotId)) {
        hasLegalPiecePlacement = true;
      }
    }

    // 3. Can ANY target be completed using exclusively the loose pieces already on the board?
    const hasCompletableTargetOnBoard = targets.some(t => {
      const availableSet = piecesByTarget.get(t.instanceId);
      if (!availableSet) return false;
      return t.missingSlotIds.every(slotId => availableSet.has(slotId));
    });

    // 4. Check spawnable missing pieces (must have unspawned missing slots for active targets AND open cell at top spawn row)
    let hasSpawnableMissingPiece = false;
    const topRow = grid.totalRows - 1;
    let hasOpenTopCell = false;
    for (let c = 0; c < grid.columns; c++) {
      if (grid.isCellEmpty({ col: c, row: topRow })) {
        hasOpenTopCell = true;
        break;
      }
    }

    if (hasOpenTopCell) {
      const hasAnyUnspawnedMissingSlots = targets.some(t => {
        const spawned = piecesByTarget.get(t.instanceId);
        return t.missingSlotIds.some(s => !spawned || !spawned.has(s));
      });
      hasSpawnableMissingPiece = hasAnyUnspawnedMissingSlots;
    }

    // 5. Check legal target spawn (strictly uses top Spawn Zone candidate filter)
    let hasLegalTargetSpawn = false;
    if (targets.length < targetIngredientQuota) {
      if (availableRecipeIds && recipes) {
        const legalCandidates = DeadlockDetector.getLegalTargetSpawnCandidates(
          grid,
          availableRecipeIds,
          recipes,
          ingredients
        );
        hasLegalTargetSpawn = legalCandidates.length > 0;
      } else {
        for (const def of Object.values(ingredients)) {
          const validAnchors = grid.findSpawnAnchorsForFootprint(def.footprint);
          if (validAnchors.length > 0) {
            hasLegalTargetSpawn = true;
            break;
          }
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
