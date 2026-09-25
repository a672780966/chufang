import { Order, DayConfig, RecipeDefinition, NextOrderPreviewMode, NextOrderPreview } from '../model/Types';
import { EventEmitter } from '../model/Events';
import { PrepInventory } from '../inventory/PrepInventory';
import { OrderBag } from './OrderBag';

export class OrderSystem {
  private _orderBag: OrderBag;
  private _inventory: PrepInventory;
  private _events: EventEmitter;
  private _currentOrder: Order | null = null;
  private _previewMode: NextOrderPreviewMode = 'DISH_ONLY';
  private _totalRevenue: number = 0;
  private _businessGoal: number;
  private _cascadeChain: number = 0;
  private _ordersFulfilledCount: number = 0;
  private _preparedDishBuffer: string[] = [];
  readonly maxPreparedBuffer: number = 2;

  constructor(
    dayConfig: DayConfig,
    recipes: Record<string, RecipeDefinition>,
    daySeed: string | number,
    inventory: PrepInventory,
    events: EventEmitter,
    previewMode: NextOrderPreviewMode = 'DISH_ONLY'
  ) {
    this._orderBag = new OrderBag(dayConfig, recipes, daySeed);
    this._inventory = inventory;
    this._events = events;
    this._businessGoal = dayConfig.businessGoal;
    this._previewMode = previewMode;

    this.spawnNextOrder();
  }

  get currentOrder(): Order | null {
    return this._currentOrder;
  }

  get totalRevenue(): number {
    return this._totalRevenue;
  }

  get businessGoal(): number {
    return this._businessGoal;
  }

  get ordersFulfilledCount(): number {
    return this._ordersFulfilledCount;
  }

  get preparedDishBuffer(): readonly string[] {
    return this._preparedDishBuffer;
  }

  get isGoalReached(): boolean {
    return this._totalRevenue >= this._businessGoal;
  }

  getNextOrderPreview(): NextOrderPreview {
    return this._orderBag.getNextOrderPreview(this._previewMode);
  }

  /**
   * Internal truth: Returns the full real next order fact (not filtered by UI mode).
   * Used exclusively by FlowDirector for intelligent anticipation.
   */
  getNextOrderFact(): Order | null {
    return this._orderBag.peekNextOrder();
  }

  /**
   * Spawns the next order and attempts immediate reservation from inventory.
   */
  private spawnNextOrder(): Order | null {
    this._currentOrder = this._orderBag.getCurrentOrder();
    if (this._currentOrder) {
      this._events.emit('ORDER_CREATED', {
        order: this._currentOrder,
        orderIndex: this._orderBag.getCurrentOrderIndex()
      });
      this.syncInventoryWithCurrentOrder();
    }
    return this._currentOrder;
  }

  /**
   * Reserves available inventory for unsatisfied items in the current order.
   * Returns true if any reservation changed.
   */
  syncInventoryWithCurrentOrder(): boolean {
    if (!this._currentOrder || this._currentOrder.isFulfilled) return false;

    let changed = false;
    for (const item of this._currentOrder.items) {
      const neededUnreserved = item.needed - item.reserved;
      if (neededUnreserved > 0) {
        const available = this._inventory.getAvailable(item.ingredientId);
        const toReserve = Math.min(neededUnreserved, available);
        if (toReserve > 0) {
          if (this._inventory.reserve(item.ingredientId, toReserve)) {
            item.reserved += toReserve;
            changed = true;
            this._events.emit('INVENTORY_RESERVED', {
              ingredientId: item.ingredientId,
              orderId: this._currentOrder.orderId,
              reservedCount: toReserve
            });
            this._events.emit('ORDER_PROGRESS', {
              order: this._currentOrder,
              updatedIngredientId: item.ingredientId
            });
          }
        }
      }
    }

    // Check if current order is now fully satisfied
    this.checkCurrentOrderFulfillment();
    return changed;
  }

  private checkCurrentOrderFulfillment(): boolean {
    if (!this._currentOrder || this._currentOrder.isFulfilled) return false;

    const allSatisfied = this._currentOrder.items.every(
      item => item.reserved >= item.needed
    );

    if (allSatisfied) {
      this._currentOrder.isFulfilled = true;
      return true;
    }
    return false;
  }

  /**
   * Processes fulfillment and triggers Production Cascade if next orders
   * can be fulfilled immediately from remaining inventory!
   */
  resolveOrderFulfillment(): { completedOrders: Order[]; finalChain: number } {
    const completedOrders: Order[] = [];
    if (!this._currentOrder || !this._currentOrder.isFulfilled) {
      return { completedOrders, finalChain: this._cascadeChain };
    }

    let isCascade = false;

    while (this._currentOrder && this._currentOrder.isFulfilled) {
      this._cascadeChain++;
      if (this._cascadeChain === 2) {
        isCascade = true;
        this._events.emit('CASCADE_STARTED', { startOrder: this._currentOrder });
      }

      // Calculate revenue with cascade multiplier
      const multiplier = this.getCascadeMultiplier(this._cascadeChain);
      const earned = Math.round(this._currentOrder.baseRevenue * multiplier);

      // Consume reserved inventory
      for (const item of this._currentOrder.items) {
        this._inventory.consumeReserved(item.ingredientId, item.reserved);
        item.consumed += item.reserved;
        item.reserved = 0;
        this._events.emit('INVENTORY_CONSUMED', {
          ingredientId: item.ingredientId,
          orderId: this._currentOrder.orderId,
          count: item.needed
        });
      }

      this._totalRevenue += earned;
      this._ordersFulfilledCount++;
      completedOrders.push(this._currentOrder);

      this._events.emit('ORDER_COMPLETED', {
        order: this._currentOrder,
        revenueAwarded: earned,
        chainIndex: this._cascadeChain
      });

      if (this._cascadeChain >= 2) {
        this._events.emit('CASCADE_STEP', {
          chainIndex: this._cascadeChain,
          completedOrder: this._currentOrder,
          multiplier,
          revenue: earned
        });
      }

      this._events.emit('REVENUE_CHANGED', {
        currentRevenue: this._totalRevenue,
        businessGoal: this._businessGoal,
        delta: earned
      });

      // Stop printing new orders if goal reached (per GDD section 20)
      if (this.isGoalReached) {
        this._events.emit('BUSINESS_GOAL_REACHED', {
          finalRevenue: this._totalRevenue,
          businessGoal: this._businessGoal
        });
        break;
      }

      // Pull next order from order bag
      this._currentOrder = this._orderBag.advanceToNextOrder();
      if (this._currentOrder) {
        this._events.emit('ORDER_CREATED', {
          order: this._currentOrder,
          orderIndex: this._orderBag.getCurrentOrderIndex()
        });
        // Check if next order can also be immediately fulfilled!
        this.syncInventoryWithCurrentOrder();
      }
    }

    const finalChain = this._cascadeChain;
    if (isCascade) {
      this._events.emit('CASCADE_ENDED', {
        finalChain,
        totalCascadeRevenue: completedOrders.reduce((sum, o) => sum + o.baseRevenue, 0)
      });
    }

    // Reset chain counter for next manual completion cycle
    this._cascadeChain = 0;

    return { completedOrders, finalChain };
  }

  private getCascadeMultiplier(chain: number): number {
    if (chain <= 1) return 1.0;
    if (chain === 2) return 1.1;
    if (chain === 3) return 1.2;
    return 1.3;
  }

  /**
   * Helper to normalize recipeId and dishId.
   * e.g. 'salad' <-> 'dish_salad', 'breakfast' <-> 'dish_breakfast', 'ramen' <-> 'dish_ramen'
   */
  private matchesDish(orderRecipeId: string, completedDishId: string): boolean {
    if (orderRecipeId === completedDishId) return true;
    const strippedRecipe = orderRecipeId.replace(/^dish_/, '');
    const strippedCompleted = completedDishId.replace(/^dish_/, '');
    return strippedRecipe === strippedCompleted;
  }

  /**
   * Processes a completed dish through the official OrderSystem flow:
   * DISH_COMPLETED -> serve/reserve -> ORDER_COMPLETED -> REVENUE_CHANGED -> next order / cascade
   */
  handleCompletedDish(dishId: string): { served: boolean; buffered: boolean; order?: Order } {
    if (!this._currentOrder) {
      if (this._preparedDishBuffer.length < this.maxPreparedBuffer) {
        this._preparedDishBuffer.push(dishId);
        return { served: false, buffered: true };
      }
      return { served: false, buffered: false };
    }

    // Check if matching current order
    if (this.matchesDish(this._currentOrder.recipeId, dishId)) {
      const order = this._currentOrder;
      order.isFulfilled = true;

      this._cascadeChain++;
      if (this._cascadeChain === 2) {
        this._events.emit('CASCADE_STARTED', { startOrder: order });
      }

      const multiplier = this.getCascadeMultiplier(this._cascadeChain);
      const earned = Math.round(order.baseRevenue * multiplier);

      this._totalRevenue += earned;
      this._ordersFulfilledCount++;

      this._events.emit('ORDER_COMPLETED', {
        order,
        revenueAwarded: earned,
        chainIndex: this._cascadeChain
      });

      if (this._cascadeChain >= 2) {
        this._events.emit('CASCADE_STEP', {
          chainIndex: this._cascadeChain,
          completedOrder: order,
          multiplier,
          revenue: earned
        });
      }

      this._events.emit('REVENUE_CHANGED', {
        currentRevenue: this._totalRevenue,
        businessGoal: this._businessGoal,
        delta: earned
      });

      if (this.isGoalReached) {
        this._events.emit('BUSINESS_GOAL_REACHED', {
          finalRevenue: this._totalRevenue,
          businessGoal: this._businessGoal
        });
      }

      // Advance to next order
      this._currentOrder = this._orderBag.advanceToNextOrder();
      if (this._currentOrder) {
        this._events.emit('ORDER_CREATED', {
          order: this._currentOrder,
          orderIndex: this._orderBag.getCurrentOrderIndex()
        });

        // Check if next order can immediately be fulfilled from PreparedDishBuffer!
        const bufIdx = this._preparedDishBuffer.findIndex(d => this.matchesDish(this._currentOrder!.recipeId, d));
        if (bufIdx !== -1) {
          const bufferedDish = this._preparedDishBuffer.splice(bufIdx, 1)[0];
          this.handleCompletedDish(bufferedDish);
        } else {
          this._cascadeChain = 0;
        }
      } else {
        this._cascadeChain = 0;
      }

      return { served: true, buffered: false, order };
    } else {
      // Dish does not match current order: enter PreparedDishBuffer
      if (this._preparedDishBuffer.length < this.maxPreparedBuffer) {
        this._preparedDishBuffer.push(dishId);
        return { served: false, buffered: true };
      }
      return { served: false, buffered: false };
    }
  }
}
