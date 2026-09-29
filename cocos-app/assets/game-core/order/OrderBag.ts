import {
  DayConfig,
  DishPuzzleDayConfig,
  RecipeDefinition,
  Order,
  OrderItemProgress,
  NextOrderPreviewMode,
  NextOrderPreview
} from '../model/Types';
import { SeededRandom } from '../random/SeededRandom';
import { DISH_CATALOG, DishOrderDefinition } from '../data/DishCatalog';

export class OrderBag {
  private _rng: SeededRandom;
  private _recipes?: Record<string, RecipeDefinition>;
  private _dishCatalog: Record<string, DishOrderDefinition>;
  private _dayConfig: DayConfig | DishPuzzleDayConfig;
  private _bagCycleIndex: number = 0;
  private _orderSequence: Order[] = [];
  private _currentIndex: number = 0;
  private _orderCounter: number = 1001;

  constructor(
    dayConfig: DayConfig | DishPuzzleDayConfig,
    recipes?: Record<string, RecipeDefinition>,
    daySeed: string | number = 12345,
    dishCatalog?: Record<string, DishOrderDefinition>
  ) {
    this._dayConfig = dayConfig;
    this._recipes = recipes;
    this._dishCatalog =
      dishCatalog ||
      ('dishCatalog' in dayConfig && dayConfig.dishCatalog
        ? (dayConfig.dishCatalog as Record<string, DishOrderDefinition>)
        : DISH_CATALOG);
    this._rng = new SeededRandom(`${daySeed}_orders`);
    this.refillBag();
  }

  private createDishOrderInstance(dish: DishOrderDefinition): Order {
    const orderId = `#${(this._orderCounter++).toString().padStart(4, '0')}`;
    return {
      orderId,
      recipeId: dish.dishId,
      dishId: dish.dishId,
      dishName: dish.name,
      emoji: dish.emoji || '🍽️',
      baseRevenue: dish.baseRevenue,
      items: [],
      isFulfilled: false,
      kind: 'DISH'
    };
  }

  private createRecipeOrderInstance(recipe: RecipeDefinition): Order {
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
      isFulfilled: false,
      kind: 'RECIPE'
    };
  }

  private refillBag(): void {
    const cycleSeed = `${this._rng.getState()}_cycle_${this._bagCycleIndex++}`;
    const cycleRng = new SeededRandom(cycleSeed);
    const pool: Order[] = [];

    // 1. Check if DishPuzzleDayConfig with orderWeights is present
    if ('orderWeights' in this._dayConfig && this._dayConfig.orderWeights) {
      for (const [dishId, weight] of Object.entries(this._dayConfig.orderWeights)) {
        if (weight <= 0) continue;
        const dishDef = this._dishCatalog[dishId];
        // Strictly forbid dishes that do not exist in the authoritative catalog: Fail-fast!
        if (!dishDef) {
          throw new Error(
            `[OrderBag] Unknown dishId "${dishId}" in orderWeights. Authoritative catalog contains: ${Object.keys(this._dishCatalog).join(', ')}`
          );
        }
        for (let i = 0; i < weight; i++) {
          pool.push(this.createDishOrderInstance(dishDef));
        }
      }
    } else if ('recipeWeights' in this._dayConfig && this._dayConfig.recipeWeights && this._recipes) {
      // 2. Legacy recipe mode
      for (const [recipeId, weight] of Object.entries(this._dayConfig.recipeWeights)) {
        const recipe = this._recipes[recipeId];
        if (!recipe) continue;
        for (let i = 0; i < weight; i++) {
          pool.push(this.createRecipeOrderInstance(recipe));
        }
      }
    }

    // Fail-fast: If pool is empty, throw Error rather than silently falling back
    if (pool.length === 0) {
      throw new Error(
        `[OrderBag] Cannot refill OrderBag: order pool is empty for Day ${(this._dayConfig as any).dayNumber}.`
      );
    }

    // Constrained shuffle: avoid same dish appearing consecutively
    const shuffled: Order[] = [];
    cycleRng.shuffle(pool);

    while (pool.length > 0) {
      let pickedIndex = -1;
      const lastDish = shuffled.length > 0 ? shuffled[shuffled.length - 1].dishId : null;

      for (let i = 0; i < pool.length; i++) {
        if (pool[i].dishId !== lastDish || pool.length === 1) {
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
        dishId: next.dishId,
        dishName: next.dishName,
        emoji: next.emoji
      };
    }
    return {
      mode: 'FULL_RECIPE',
      dishId: next.dishId,
      dishName: next.dishName,
      emoji: next.emoji,
      requirements: next.items.map(i => ({ ingredientId: i.ingredientId, count: i.needed }))
    };
  }

  getCurrentOrderIndex(): number {
    return this._currentIndex;
  }

  getStateSnapshot(): {
    currentIndex: number;
    bagCycleIndex: number;
    orderSequence: { orderId: string; dishId?: string; recipeId: string }[];
    rngState: number;
  } {
    return {
      currentIndex: this._currentIndex,
      bagCycleIndex: this._bagCycleIndex,
      orderSequence: this._orderSequence.map(o => ({
        orderId: o.orderId,
        dishId: o.dishId,
        recipeId: o.recipeId
      })),
      rngState: this._rng.getState()
    };
  }
}
