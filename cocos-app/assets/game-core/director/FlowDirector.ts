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
   * Strictly filters candidates to only those that can legally fit into the top Spawn Zone!
   */
  selectNextTargetIngredient(
    grid: BoardGrid,
    inventory: PrepInventory,
    currentOrder: Order | null,
    nextOrderFact: Order | null
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

    // CRITICAL: Strictly filter to candidates that can legally spawn in the top Spawn Zone!
    const validDefCandidates: IngredientDefinition[] = [];
    for (const ingredientId of candidateSet) {
      const def = this._ingredients[ingredientId];
      if (!def) continue;
      const spawnAnchors = grid.findSpawnAnchorsForFootprint(def.footprint);
      if (spawnAnchors.length > 0) {
        validDefCandidates.push(def);
      }
    }

    if (validDefCandidates.length === 0) return null;

    const scoredCandidates: Array<{ item: IngredientDefinition; weight: number }> = [];

    for (const def of validDefCandidates) {
      const ingredientId = def.id;
      let score = 50; // Base score

      // 1. Current order need (highest preference, but not guaranteed)
      if (currentOrder) {
        const itemProg = currentOrder.items.find(i => i.ingredientId === ingredientId);
        if (itemProg && itemProg.reserved < itemProg.needed) {
          score += 40;
        }
      }

      // 2. Next order fact boost (internal real fact, completely decoupled from UI preview)
      if (nextOrderFact && nextOrderFact.items) {
        if (nextOrderFact.items.some(i => i.ingredientId === ingredientId)) {
          score += 25;
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
   * Builds the static PieceReleasePlan for a new target instance.
   * Completely determined by targetSeed using SeededRandom.
   */
  createPieceReleasePlan(
    def: IngredientDefinition,
    targetSeed: string | number
  ): Record<string, ReleaseCategory> {
    const plan: Record<string, ReleaseCategory> = {};
    const targetRng = new SeededRandom(targetSeed);
    const slots = [...def.slots];

    // Pick 1 slot to be the closure piece using target seed
    const closureIdx = targetRng.nextInt(0, slots.length - 1);
    const closureSlot = slots[closureIdx];
    plan[closureSlot.slotId] = 'closure';

    // Distribute remaining slots between early and normal
    const remaining = slots.filter((_, idx) => idx !== closureIdx);
    targetRng.shuffle(remaining);
    const half = Math.ceil(remaining.length / 2);

    for (let i = 0; i < remaining.length; i++) {
      const slot = remaining[i];
      if (i < half) {
        plan[slot.slotId] = 'early';
      } else {
        plan[slot.slotId] = 'normal';
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
    nextOrderFact: Order | null
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

      // Next order fact boost (internal real fact)
      if (nextOrderFact && nextOrderFact.items) {
        if (nextOrderFact.items.some(i => i.ingredientId === target.ingredientId)) {
          targetBaseWeight += 15;
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
