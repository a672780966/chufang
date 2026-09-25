import { DayConfig, RecipeDefinition, Order, OrderItemProgress, NextOrderPreviewMode, NextOrderPreview } from '../model/Types';
import { SeededRandom } from '../random/SeededRandom';
import { PrepInventory } from '../inventory/PrepInventory';
import { EventEmitter } from '../model/Events';

export class OrderBag {
  private _rng: SeededRandom;
  private _recipes: Record<string, RecipeDefinition>;
  private _dayConfig: DayConfig;
  private _bagCycleIndex: number = 0;
  private _orderSequence: Order[] = [];
  private _currentIndex: number = 0;
  private _orderCounter: number = 1001;

  constructor(
    dayConfig: DayConfig,
    recipes: Record<string, RecipeDefinition>,
    daySeed: string | number
  ) {
    this._dayConfig = dayConfig;
    this._recipes = recipes;
    this._rng = new SeededRandom(`${daySeed}_orders`);
    this.refillBag();
  }

  private createOrderInstance(recipe: RecipeDefinition): Order {
    const orderId = `#${(this._orderCounter++).toString().padStart(4, '0')}`;
    const items: OrderItemProgress[] = recipe.requirements.map(req => ({
      ingredientId: req.ingredientId,
      needed: req.count,
      reserved: 0,
      consumed: 0
    }));

    return {
      orderId,
      recipeId: recipe.id,
      dishId: recipe.id.startsWith('dish_') ? recipe.id : `dish_${recipe.id}`,
      dishName: recipe.name,
      emoji: recipe.emoji,
      baseRevenue: recipe.baseRevenue,
      items,
      isFulfilled: false
    };
  }

  private refillBag(): void {
    const cycleSeed = `${this._rng.getState()}_cycle_${this._bagCycleIndex++}`;
    const cycleRng = new SeededRandom(cycleSeed);

    const pool: Order[] = [];
    for (const [recipeId, weight] of Object.entries(this._dayConfig.recipeWeights)) {
      const recipe = this._recipes[recipeId];
      if (!recipe) continue;
      for (let i = 0; i < weight; i++) {
        pool.push(this.createOrderInstance(recipe));
      }
    }

    // Constrained shuffle: avoid same recipe appearing consecutively
    const shuffled: Order[] = [];
    cycleRng.shuffle(pool);

    while (pool.length > 0) {
      let pickedIndex = -1;
      const lastDish = shuffled.length > 0 ? shuffled[shuffled.length - 1].recipeId : null;

      // Find an item that does not repeat the last dish if possible
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].recipeId !== lastDish || pool.length === 1) {
          pickedIndex = i;
          break;
        }
      }
      if (pickedIndex === -1) pickedIndex = 0;

      shuffled.push(pool.splice(pickedIndex, 1)[0]);
    }

    this._orderSequence.push(...shuffled);
  }

  getCurrentOrder(): Order | null {
    if (this._currentIndex >= this._orderSequence.length) {
      this.refillBag();
    }
    return this._orderSequence[this._currentIndex] || null;
  }

  peekNextOrder(): Order | null {
    const nextIdx = this._currentIndex + 1;
    if (nextIdx >= this._orderSequence.length) {
      this.refillBag();
    }
    return this._orderSequence[nextIdx] || null;
  }

  advanceToNextOrder(): Order | null {
    this._currentIndex++;
    return this.getCurrentOrder();
  }

  getNextOrderPreview(mode: NextOrderPreviewMode = 'DISH_ONLY'): NextOrderPreview {
    const next = this.peekNextOrder();
    if (!next || mode === 'NONE') {
      return { mode: 'NONE' };
    }
    if (mode === 'DISH_ONLY') {
      return {
        mode: 'DISH_ONLY',
        dishId: next.recipeId,
        dishName: next.dishName,
        emoji: next.emoji
      };
    }
    return {
      mode: 'FULL_RECIPE',
      dishId: next.recipeId,
      dishName: next.dishName,
      emoji: next.emoji,
      requirements: next.items.map(i => ({ ingredientId: i.ingredientId, count: i.needed }))
    };
  }

  getCurrentOrderIndex(): number {
    return this._currentIndex;
  }
}
