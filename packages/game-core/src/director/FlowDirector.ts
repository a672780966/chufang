import {
  IngredientDefinition,
  IngredientTarget,
  LoosePiece,
  DayConfig,
  RecipeDefinition,
  Order,
  NextOrderPreview,
  GridCoord,
  ReleaseCategory
} from '../model/Types.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { BoardGrid } from '../board/BoardGrid.js';
import { PrepInventory } from '../inventory/PrepInventory.js';

export class FlowDirector {
  private _rng: SeededRandom;
  private _dayConfig: DayConfig;
  private _ingredients: Record<string, IngredientDefinition>;
  private _recipes: Record<string, RecipeDefinition>;

  constructor(
    dayConfig: DayConfig,
    ingredients: Record<string, IngredientDefinition>,
    recipes: Record<string, RecipeDefinition>,
    daySeed: string | number
  ) {
    this._dayConfig = dayConfig;
    this._ingredients = ingredients;
    this._recipes = recipes;
    this._rng = new SeededRandom(`${daySeed}_director`);
  }

  /**
   * Stage A: Target Selector
   * Evaluates which ingredient definition should be spawned next on the board.
   */
  selectNextTargetIngredient(
    grid: BoardGrid,
    inventory: PrepInventory,
    currentOrder: Order | null,
    nextOrderHint: NextOrderPreview | null
  ): IngredientDefinition | null {
    const activeTargets = grid.getAllTargets();
    const activeIngredientIds = new Set(activeTargets.map(t => t.ingredientId));

    // Get all candidate ingredients used in the day's available recipes
    const candidateSet = new Set<string>();
    for (const recipeId of this._dayConfig.availableRecipeIds) {
      const recipe = this._recipes[recipeId];
      if (!recipe) continue;
      for (const req of recipe.requirements) {
        candidateSet.add(req.ingredientId);
      }
    }

    if (candidateSet.size === 0) return null;

    const scoredCandidates: Array<{ item: IngredientDefinition; weight: number }> = [];

    for (const ingredientId of candidateSet) {
      const def = this._ingredients[ingredientId];
      if (!def) continue;

      let score = 50; // Base score

      // 1. Current order need (highest preference, but not guaranteed)
      if (currentOrder) {
        const itemProg = currentOrder.items.find(i => i.ingredientId === ingredientId);
        if (itemProg && itemProg.reserved < itemProg.needed) {
          score += 40;
        }
      }

      // 2. Next order hint (secondary preference)
      if (nextOrderHint && nextOrderHint.requirements) {
        if (nextOrderHint.requirements.some(r => r.ingredientId === ingredientId)) {
          score += 20;
        }
      }

      // 3. Inventory deficit vs overflow penalty
      const availableCount = inventory.getAvailable(ingredientId);
      if (availableCount === 0) {
        score += 15;
      } else if (availableCount >= 2) {
        score -= availableCount * 25; // Suppress hoarding
      }

      // 4. Duplicate target penalty (we want diverse targets on board)
      if (activeIngredientIds.has(ingredientId)) {
        score -= 60;
      }

      // Ensure score is positive
      scoredCandidates.push({ item: def, weight: Math.max(5, score) });
    }

    return this._rng.weightedPick(scoredCandidates);
  }

  /**
   * Builds the static PieceReleasePlan for a new target.
   */
  createPieceReleasePlan(
    def: IngredientDefinition
  ): Record<string, ReleaseCategory> {
    const plan: Record<string, ReleaseCategory> = {};
    const slots = [...def.slots];

    // Check if slot has defined default, otherwise assign early / normal / closure
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.defaultCategory) {
        plan[slot.slotId] = slot.defaultCategory;
      } else {
        if (i === slots.length - 1) {
          plan[slot.slotId] = 'closure';
        } else if (i < Math.floor(slots.length / 2)) {
          plan[slot.slotId] = 'early';
        } else {
          plan[slot.slotId] = 'normal';
        }
      }
    }

    return plan;
  }

  /**
   * Stage B: Piece Scheduler
   * Chooses which missing piece of which active target should be released into the loose piece pool.
   * Crucial: Only chooses slots that have neither been placed nor already spawned on the board!
   */
  selectNextLoosePiece(
    grid: BoardGrid,
    inventory: PrepInventory,
    currentOrder: Order | null,
    nextOrderHint: NextOrderPreview | null
  ): { target: IngredientTarget; slotId: string } | null {
    const activeTargets = grid.getAllTargets();
    if (activeTargets.length === 0) return null;

    // Track which (targetInstanceId, slotId) pairs are currently on board as loose pieces
    const spawnedSlotsByTarget = new Map<string, Set<string>>();
    for (const p of grid.getAllLoosePieces()) {
      let set = spawnedSlotsByTarget.get(p.targetInstanceId);
      if (!set) {
        set = new Set();
        spawnedSlotsByTarget.set(p.targetInstanceId, set);
      }
      set.add(p.slotId);
    }

    interface PieceCandidate {
      target: IngredientTarget;
      slotId: string;
      weight: number;
    }

    const candidates: PieceCandidate[] = [];

    for (const target of activeTargets) {
      const spawnedSet = spawnedSlotsByTarget.get(target.instanceId);
      // Only consider missing slots that are NOT yet on the board as loose pieces
      const availableMissingSlots = target.missingSlotIds.filter(
        slotId => !spawnedSet || !spawnedSet.has(slotId)
      );

      if (availableMissingSlots.length === 0) continue;

      const totalSlots = target.placedSlotIds.length + target.missingSlotIds.length;
      const progress = target.placedSlotIds.length / totalSlots;

      // Base weight from target completion diversity
      let targetBaseWeight = 30;

      // Current order boost
      if (currentOrder) {
        const itemProg = currentOrder.items.find(i => i.ingredientId === target.ingredientId);
        if (itemProg && itemProg.reserved < itemProg.needed) {
          targetBaseWeight += 25;
        }
      }

      // Next order hint boost
      if (nextOrderHint && nextOrderHint.requirements) {
        if (nextOrderHint.requirements.some(r => r.ingredientId === target.ingredientId)) {
          targetBaseWeight += 10;
        }
      }

      for (const slotId of availableMissingSlots) {
        const category = target.pieceReleasePlan[slotId] || 'normal';
        let pieceWeight = targetBaseWeight;

        // Check release eligibility
        if (category === 'early') {
          pieceWeight += 20;
        } else if (category === 'normal') {
          if (progress < 0.15) {
            pieceWeight *= 0.5;
          }
        } else if (category === 'closure') {
          // Closure piece delay!
          // Only release if progress is >= 70% OR starvation guard triggered
          const starvationGuard = target.ageTurns >= 4 || target.missingSlotIds.length <= 1;
          if (progress < 0.70 && !starvationGuard) {
            pieceWeight = 0; // Temporarily withheld
          } else {
            pieceWeight += 35;
          }
        }

        if (pieceWeight > 0) {
          candidates.push({
            target,
            slotId,
            weight: pieceWeight
          });
        }
      }
    }

    if (candidates.length === 0) {
      // Starvation fallback: if all were withheld, take any available unspawned slot
      for (const target of activeTargets) {
        const spawnedSet = spawnedSlotsByTarget.get(target.instanceId);
        const availableMissing = target.missingSlotIds.filter(s => !spawnedSet || !spawnedSet.has(s));
        if (availableMissing.length > 0) {
          return { target, slotId: availableMissing[0] };
        }
      }
      return null;
    }

    const picked = this._rng.weightedPick(candidates.map(c => ({ item: c, weight: c.weight })));
    return picked ? { target: picked.target, slotId: picked.slotId } : null;
  }
}
