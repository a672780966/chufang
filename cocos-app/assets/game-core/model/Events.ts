import { GridCoord, Order, IngredientTarget, LoosePiece } from './Types';

export type CoreEventType =
  | 'TARGET_SPAWNED'
  | 'PIECE_SPAWNED'
  | 'PIECE_MOVED'
  | 'PIECE_PLACED'
  | 'INGREDIENT_PROGRESS'
  | 'INGREDIENT_COMPLETED'
  | 'INGREDIENT_REMOVED'
  | 'INVENTORY_ADDED'
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_CONSUMED'
  | 'ORDER_CREATED'
  | 'ORDER_PROGRESS'
  | 'ORDER_COMPLETED'
  | 'CASCADE_STARTED'
  | 'CASCADE_STEP'
  | 'CASCADE_ENDED'
  | 'REVENUE_CHANGED'
  | 'BUSINESS_GOAL_REACHED'
  | 'BOARD_DANGER'
  | 'BOARD_BLOCKED'
  | 'DAY_CLEARED'
  | 'DAY_FAILED'
  | 'BOARD_SETTLED'
  | 'DISH_COMPLETED'
  | 'PIECE_GROUP_MERGED'
  | 'DISH_CLEARED'
  | 'DISH_SERVED';

export interface CoreEventMap {
  TARGET_SPAWNED: { target: IngredientTarget; fromAnchor: GridCoord; toAnchor: GridCoord };
  PIECE_SPAWNED: { piece: LoosePiece; fromCoord: GridCoord; toCoord: GridCoord };
  PIECE_MOVED: { pieceInstanceId: string; fromCoord: GridCoord; toCoord: GridCoord };
  PIECE_PLACED: {
    pieceInstanceId: string;
    targetInstanceId: string;
    slotId: string;
    fromCoord: GridCoord;
  };
  INGREDIENT_PROGRESS: {
    targetInstanceId: string;
    ingredientId: string;
    placedCount: number;
    totalCount: number;
    progressRatio: number;
  };
  INGREDIENT_COMPLETED: {
    target: IngredientTarget;
  };
  INGREDIENT_REMOVED: {
    targetInstanceId: string;
    ingredientId: string;
    releasedCoords: GridCoord[];
  };
  INVENTORY_ADDED: {
    ingredientId: string;
    totalAvailable: number;
  };
  INVENTORY_RESERVED: {
    ingredientId: string;
    orderId: string;
    reservedCount: number;
  };
  INVENTORY_CONSUMED: {
    ingredientId: string;
    orderId: string;
    count: number;
  };
  ORDER_CREATED: {
    order: Order;
    orderIndex: number;
  };
  ORDER_PROGRESS: {
    order: Order;
    updatedIngredientId: string;
  };
  ORDER_COMPLETED: {
    order: Order;
    revenueAwarded: number;
    chainIndex: number;
  };
  CASCADE_STARTED: {
    startOrder: Order;
  };
  CASCADE_STEP: {
    chainIndex: number;
    completedOrder: Order;
    multiplier: number;
    revenue: number;
  };
  CASCADE_ENDED: {
    finalChain: number;
    totalCascadeRevenue: number;
  };
  REVENUE_CHANGED: {
    currentRevenue: number;
    businessGoal: number;
    delta: number;
  };
  BUSINESS_GOAL_REACHED: {
    finalRevenue: number;
    businessGoal: number;
  };
  BOARD_DANGER: {
    topRowOccupancy: number;
    warningMessage: string;
  };
  BOARD_BLOCKED: {
    reason: string;
  };
  DAY_CLEARED: {
    dayNumber: number;
    totalRevenue: number;
    businessGoal: number;
    ordersCompleted: number;
  };
  DAY_FAILED: {
    dayNumber: number;
    currentRevenue: number;
    businessGoal: number;
    reason: string;
  };
  BOARD_SETTLED: {
    movedTargets: Array<{ instanceId: string; fromAnchor: GridCoord; toAnchor: GridCoord }>;
    movedPieces: Array<{ instanceId: string; fromCoord: GridCoord; toCoord: GridCoord }>;
  };
  DISH_COMPLETED: {
    dishId: string;
    dishPuzzleInstanceId: string;
    groupId: string;
    pieces: any[];
  };
  PIECE_GROUP_MERGED: {
    targetGroupId: string;
    pieceCount: number;
  };
  DISH_CLEARED: {
    dishId: string;
    dishPuzzleInstanceId: string;
    groupId: string;
  };
  DISH_SERVED: {
    dishId: string;
    dishPuzzleInstanceId: string;
    groupId: string;
  };
}

export type EventListener<K extends CoreEventType> = (payload: CoreEventMap[K]) => void;

export class EventEmitter {
  private _listeners: { [K in CoreEventType]?: Set<EventListener<K>> } = {};

  on<K extends CoreEventType>(type: K, listener: EventListener<K>): () => void {
    if (!this._listeners[type]) {
      this._listeners[type] = new Set() as any;
    }
    this._listeners[type]!.add(listener);
    return () => this.off(type, listener);
  }

  off<K extends CoreEventType>(type: K, listener: EventListener<K>): void {
    this._listeners[type]?.delete(listener);
  }

  emit<K extends CoreEventType>(type: K, payload: CoreEventMap[K]): void {
    const set = this._listeners[type];
    if (set) {
      for (const listener of set) {
        listener(payload);
      }
    }
  }

  removeAllListeners(): void {
    this._listeners = {};
  }
}
