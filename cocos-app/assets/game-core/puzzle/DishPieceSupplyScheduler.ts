import { DishPuzzleInstance } from './DishPuzzleModel.js';
import { DEFAULT_BASE_NON_ORDER_WEIGHT } from '../model/Types.js';

export interface DishPieceSupplySchedulerWeights {
  currentOrderWeight?: number;
  nearCompleteWeight?: number;
  starvationWeight?: number;
  baseNonOrderWeight?: number;
}

export class DishPieceSupplyScheduler {
  private _starvationCounters = new Map<string, number>();
  private _currentOrderWeight: number = 100;
  private _nearCompleteWeight: number = 25;
  private _starvationWeight: number = 20;
  private _baseNonOrderWeight: number = DEFAULT_BASE_NON_ORDER_WEIGHT;

  configureWeights(weights?: DishPieceSupplySchedulerWeights): void {
    if (!weights) return;
    if (weights.currentOrderWeight !== undefined) this._currentOrderWeight = weights.currentOrderWeight;
    if (weights.nearCompleteWeight !== undefined) this._nearCompleteWeight = weights.nearCompleteWeight;
    if (weights.starvationWeight !== undefined) this._starvationWeight = weights.starvationWeight;
    if (weights.baseNonOrderWeight !== undefined) this._baseNonOrderWeight = weights.baseNonOrderWeight;
  }

  getStateSnapshot(): { starvationCounters: Record<string, number> } {
    const counters: Record<string, number> = {};
    for (const [id, count] of this._starvationCounters.entries()) {
      counters[id] = count;
    }
    return { starvationCounters: counters };
  }

  getStarvationCounter(instanceId: string): number {
    return this._starvationCounters.get(instanceId) || 0;
  }

  resetStarvationCounter(instanceId: string): void {
    this._starvationCounters.set(instanceId, 0);
  }

  incrementStarvationCounters(activeInstanceIds: string[], suppliedInstanceId?: string): void {
    for (const id of activeInstanceIds) {
      if (id !== suppliedInstanceId) {
        const cur = this._starvationCounters.get(id) || 0;
        this._starvationCounters.set(id, cur + 1);
      }
    }
  }

  cleanupInstances(activeInstanceIds: string[]): void {
    const activeSet = new Set(activeInstanceIds);
    for (const id of this._starvationCounters.keys()) {
      if (!activeSet.has(id)) {
        this._starvationCounters.delete(id);
      }
    }
  }

  /**
   * Computes priority weight for an active instance.
   * Day 1 Base Weights:
   * - Current Order Dish: currentOrderWeight (default 100)
   * - Other Active Dish: baseNonOrderWeight (default 40)
   * - Near-complete Dish (>= 6 pieces spawned): +nearCompleteWeight (default 25)
   * - Starved Dish: +starvationWeight * starvationCycles. Escalates aggressively if starvation >= 3.
   */
  calculateInstanceWeight(
    instance: DishPuzzleInstance,
    currentOrderDishId?: string
  ): number {
    const isCurrentOrder = currentOrderDishId
      ? instance.dishId === currentOrderDishId
      : false;

    let weight = isCurrentOrder ? this._currentOrderWeight : this._baseNonOrderWeight;

    // Near-complete bonus: 6, 7, or 8 pieces spawned
    if (instance.spawnedSlots.size >= 6) {
      weight += this._nearCompleteWeight;
    }

    // Starvation protection
    const starvation = this.getStarvationCounter(instance.instanceId);
    if (starvation > 0) {
      weight += starvation * this._starvationWeight;
      if (starvation >= 3) {
        weight += (starvation - 2) * 50; // Escalating surge guarantees supply
      }
    }

    return weight;
  }

  /**
   * Selects the next active instance and slot to spawn.
   */
  selectNextCandidate(
    activeInstances: DishPuzzleInstance[],
    getMissingSlotsFn: (instanceId: string) => { col: number; row: number }[],
    currentOrderDishId?: string
  ): { instance: DishPuzzleInstance; slot: { col: number; row: number } } | null {
    // Candidates: active unfinished instances that still have unspawned slots
    const validInstances = activeInstances.filter(
      inst => !inst.isCompleted && inst.spawnedSlots.size < 9
    );

    if (validInstances.length === 0) return null;

    // Calculate weights
    const scored: { instance: DishPuzzleInstance; weight: number; missing: { col: number; row: number }[] }[] = [];

    for (const inst of validInstances) {
      const missing = getMissingSlotsFn(inst.instanceId);
      if (missing.length === 0) continue;

      const w = this.calculateInstanceWeight(inst, currentOrderDishId);
      scored.push({ instance: inst, weight: w, missing });
    }

    if (scored.length === 0) return null;

    // Deterministic selection: pick instance with highest weight
    scored.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const bStarve = this.getStarvationCounter(b.instance.instanceId);
      const aStarve = this.getStarvationCounter(a.instance.instanceId);
      if (bStarve !== aStarve) return bStarve - aStarve;
      return a.instance.instanceId.localeCompare(b.instance.instanceId);
    });

    const chosen = scored[0];
    const chosenSlot = this.pickBestSlot(chosen.instance, chosen.missing);

    // Update starvation counters
    this.resetStarvationCounter(chosen.instance.instanceId);
    this.incrementStarvationCounters(
      validInstances.map(i => i.instanceId),
      chosen.instance.instanceId
    );

    return {
      instance: chosen.instance,
      slot: chosenSlot
    };
  }

  private pickBestSlot(
    instance: DishPuzzleInstance,
    missing: { col: number; row: number }[]
  ): { col: number; row: number } {
    if (missing.length === 1) return missing[0];

    // Prefer slots adjacent to any already-spawned slot of this dish
    const adjacentSlots = missing.filter(slot => {
      const neighbors = [
        `${slot.col + 1}_${slot.row}`,
        `${slot.col - 1}_${slot.row}`,
        `${slot.col}_${slot.row + 1}`,
        `${slot.col}_${slot.row - 1}`
      ];
      return neighbors.some(n => instance.spawnedSlots.has(n));
    });

    const candidates = adjacentSlots.length > 0 ? adjacentSlots : missing;

    candidates.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    return candidates[0];
  }
}
