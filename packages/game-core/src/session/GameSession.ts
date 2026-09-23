import {
  DayConfig,
  IngredientDefinition,
  RecipeDefinition,
  IngredientTarget,
  LoosePiece,
  GameStats,
  NextOrderPreview,
  GridCoord
} from '../model/Types.js';
import { EventEmitter, CoreEventMap } from '../model/Events.js';
import { BoardGrid } from '../board/BoardGrid.js';
import { DiscreteGravity } from '../board/DiscreteGravity.js';
import { PrepInventory } from '../inventory/PrepInventory.js';
import { OrderSystem } from '../order/OrderSystem.js';
import { FlowDirector } from '../director/FlowDirector.js';
import { DeadlockDetector } from '../detector/DeadlockDetector.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../data/DefaultData.js';

export interface GameSessionState {
  dayNumber: number;
  businessGoal: number;
  currentRevenue: number;
  isGoalReached: boolean;
  isGameOver: boolean;
  isDeadlocked: boolean;
  targets: IngredientTarget[];
  loosePieces: LoosePiece[];
  inventory: Record<string, number>;
  currentOrder: any;
  nextOrderPreview: NextOrderPreview;
  stats: GameStats;
}

export class GameSession {
  readonly events: EventEmitter = new EventEmitter();
  readonly grid: BoardGrid;
  readonly inventory: PrepInventory = new PrepInventory();
  readonly orderSystem: OrderSystem;
  readonly flowDirector: FlowDirector;
  readonly dayConfig: DayConfig;
  readonly daySeed: string | number;

  private _rng: SeededRandom;
  private _ingredients: Record<string, IngredientDefinition>;
  private _recipes: Record<string, RecipeDefinition>;
  private _isGameOver: boolean = false;
  private _targetCounter: number = 1;
  private _pieceCounter: number = 1;

  private _stats: GameStats = {
    totalRevenue: 0,
    ordersCompleted: 0,
    ingredientsCompleted: 0,
    piecesPlaced: 0,
    maxCascadeChain: 0,
    cascadeEventsCount: 0,
    totalSettlingSteps: 0,
    deadlockChecks: 0
  };

  constructor(
    dayConfig: DayConfig,
    daySeed: string | number = 12345,
    customIngredients?: Record<string, IngredientDefinition>,
    customRecipes?: Record<string, RecipeDefinition>
  ) {
    this.dayConfig = dayConfig;
    this.daySeed = daySeed;
    this._rng = new SeededRandom(`${daySeed}_session`);
    this._ingredients = customIngredients || DEFAULT_INGREDIENTS;
    this._recipes = customRecipes || DEFAULT_RECIPES;

    this.grid = new BoardGrid(dayConfig.boardProfile);
    this.flowDirector = new FlowDirector(dayConfig, this._ingredients, this._recipes, daySeed);

    this.orderSystem = new OrderSystem(
      dayConfig,
      this._recipes,
      daySeed,
      this.inventory,
      this.events,
      'DISH_ONLY'
    );

    this.initBoard();
  }

  get stats(): GameStats {
    return {
      ...this._stats,
      totalRevenue: this.orderSystem.totalRevenue,
      ordersCompleted: this.orderSystem.ordersFulfilledCount
    };
  }

  get isGameOver(): boolean {
    return this._isGameOver;
  }

  /**
   * Initializes starting targets and comfortable loose pieces on the board.
   */
  private initBoard(): void {
    // 1. Spawn starting ingredient targets up to quota
    while (this.grid.getAllTargets().length < this.dayConfig.targetIngredientCount) {
      const spawned = this.trySpawnNextTarget();
      if (!spawned) break;
    }

    // 2. Perform initial settling to drop targets to bottom
    DiscreteGravity.settle(this.grid);

    // 3. Spawn loose pieces up to comfort min
    while (this.grid.getAllLoosePieces().length < this.dayConfig.loosePieceComfortMin) {
      const spawned = this.trySpawnNextLoosePiece();
      if (!spawned) break;
    }

    // 4. Initial settling
    DiscreteGravity.settle(this.grid);
  }

  /**
   * Spawns a new ingredient target chosen by FlowDirector.
   */
  private trySpawnNextTarget(): boolean {
    const def = this.flowDirector.selectNextTargetIngredient(
      this.grid,
      this.inventory,
      this.orderSystem.currentOrder,
      this.orderSystem.getNextOrderPreview()
    );
    if (!def) return false;

    // Find valid anchor on playable board
    const validAnchors = this.grid.findValidAnchorsForFootprint(def.footprint);
    if (validAnchors.length === 0) return false;

    // Pick a valid anchor with preference to lower rows
    validAnchors.sort((a, b) => a.row - b.row);
    const chosenAnchor = validAnchors[this._rng.nextInt(0, Math.min(2, validAnchors.length - 1))];

    const targetId = `target_${def.id}_${this._targetCounter++}`;
    const releasePlan = this.flowDirector.createPieceReleasePlan(def);
    const allSlotIds = def.slots.map(s => s.slotId);

    const target: IngredientTarget = {
      instanceId: targetId,
      ingredientId: def.id,
      anchor: chosenAnchor,
      occupiedCoords: def.footprint.map(f => ({
        col: chosenAnchor.col + f.col,
        row: chosenAnchor.row + f.row
      })),
      placedSlotIds: [],
      missingSlotIds: allSlotIds,
      pieceReleasePlan: releasePlan,
      ageTurns: 0
    };

    this.grid.occupyTarget(target);
    return true;
  }

  /**
   * Spawns a loose piece for one of the active targets.
   */
  private trySpawnNextLoosePiece(): boolean {
    const selected = this.flowDirector.selectNextLoosePiece(
      this.grid,
      this.inventory,
      this.orderSystem.currentOrder,
      this.orderSystem.getNextOrderPreview()
    );
    if (!selected) return false;

    // Find a column that has empty space at top
    const candidateCols: number[] = [];
    for (let c = 0; c < this.grid.columns; c++) {
      if (this.grid.isCellEmpty({ col: c, row: this.grid.totalRows - 1 })) {
        candidateCols.push(c);
      }
    }
    if (candidateCols.length === 0) return false;

    const chosenCol = candidateCols[this._rng.nextInt(0, candidateCols.length - 1)];
    const lowestRow = this.grid.findLowestEmptyRowInCol(chosenCol);
    if (lowestRow === null) return false;

    const pieceId = `piece_${selected.target.ingredientId}_${this._pieceCounter++}`;
    const piece: LoosePiece = {
      instanceId: pieceId,
      ingredientId: selected.target.ingredientId,
      targetInstanceId: selected.target.instanceId,
      slotId: selected.slotId,
      coord: { col: chosenCol, row: lowestRow }
    };

    this.grid.occupyLoosePiece(piece);
    this.events.emit('PIECE_SPAWNED', {
      piece,
      fromCoord: { col: chosenCol, row: this.grid.totalRows - 1 },
      toCoord: { col: chosenCol, row: lowestRow }
    });

    return true;
  }

  /**
   * Player Action: Places a loose piece into an ingredient target slot.
   */
  placePiece(pieceInstanceId: string, targetInstanceId: string, slotId: string): { success: boolean; reason?: string } {
    if (this._isGameOver) {
      return { success: false, reason: 'GAME_OVER' };
    }

    const piece = this.grid.getLoosePiece(pieceInstanceId);
    if (!piece) {
      return { success: false, reason: 'PIECE_NOT_FOUND' };
    }

    const target = this.grid.getTarget(targetInstanceId);
    if (!target) {
      return { success: false, reason: 'TARGET_NOT_FOUND' };
    }

    // Strict validation: Must match the target and missing slot
    if (piece.targetInstanceId !== targetInstanceId || piece.slotId !== slotId) {
      return { success: false, reason: 'MISMATCH' };
    }

    if (!target.missingSlotIds.includes(slotId)) {
      return { success: false, reason: 'SLOT_ALREADY_FILLED' };
    }

    // --- Execution of Placement ---
    const fromCoord = { ...piece.coord };
    this.grid.removeLoosePiece(pieceInstanceId);

    target.placedSlotIds.push(slotId);
    target.missingSlotIds = target.missingSlotIds.filter(s => s !== slotId);
    target.ageTurns++;
    this._stats.piecesPlaced++;

    this.events.emit('PIECE_PLACED', {
      pieceInstanceId,
      targetInstanceId,
      slotId,
      fromCoord
    });

    const totalSlots = target.placedSlotIds.length + target.missingSlotIds.length;
    this.events.emit('INGREDIENT_PROGRESS', {
      targetInstanceId,
      ingredientId: target.ingredientId,
      placedCount: target.placedSlotIds.length,
      totalCount: totalSlots,
      progressRatio: target.placedSlotIds.length / totalSlots
    });

    // Check if ingredient completed
    if (target.missingSlotIds.length === 0) {
      this.handleIngredientCompleted(target);
    } else {
      // Micro Refill (per GDD and grill-me):
      // Only refill if loose pieces fell below comfort zone and board allows
      const currentLooseCount = this.grid.getAllLoosePieces().length;
      if (currentLooseCount < this.dayConfig.loosePieceComfortMin) {
        this.trySpawnNextLoosePiece();
      }
      this.checkDeadlockAndDanger();
    }

    return { success: true };
  }

  /**
   * Handles completion of an ingredient target:
   * 1. Remove from board -> PrepInventory
   * 2. Order reservation & cascade
   * 3. Board-wide discrete settling (Completion Reflow)
   * 4. Replenish targets & pieces
   * 5. Check victory / deadlock
   */
  private handleIngredientCompleted(target: IngredientTarget): void {
    this._stats.ingredientsCompleted++;
    this.events.emit('INGREDIENT_COMPLETED', { target });

    // Remove from board
    const releasedCoords = this.grid.removeTarget(target.instanceId);
    this.events.emit('INGREDIENT_REMOVED', {
      targetInstanceId: target.instanceId,
      ingredientId: target.ingredientId,
      releasedCoords
    });

    // Add to inventory
    const totalAvail = this.inventory.add(target.ingredientId, 1);
    this.events.emit('INVENTORY_ADDED', {
      ingredientId: target.ingredientId,
      totalAvailable: totalAvail
    });

    // Sync with order system
    this.orderSystem.syncInventoryWithCurrentOrder();

    // Check for order fulfillment & Cascade!
    const { completedOrders, finalChain } = this.orderSystem.resolveOrderFulfillment();
    if (completedOrders.length > 0) {
      if (finalChain > this._stats.maxCascadeChain) {
        this._stats.maxCascadeChain = finalChain;
      }
      if (finalChain >= 2) {
        this._stats.cascadeEventsCount++;
      }
    }

    // Check win condition
    if (this.orderSystem.isGoalReached) {
      this._isGameOver = true;
      this.events.emit('DAY_CLEARED', {
        dayNumber: this.dayConfig.dayNumber,
        totalRevenue: this.orderSystem.totalRevenue,
        businessGoal: this.orderSystem.businessGoal,
        ordersCompleted: this.orderSystem.ordersFulfilledCount
      });
      return;
    }

    // Completion Reflow: Discrete Settling for entire board
    const settleResult = DiscreteGravity.settle(this.grid);
    if (settleResult.hasMoved) {
      this._stats.totalSettlingSteps++;
      this.events.emit('BOARD_SETTLED', {
        movedTargets: settleResult.movedTargets,
        movedPieces: settleResult.movedPieces
      });
    }

    // Replenish ingredient targets if below quota
    while (this.grid.getAllTargets().length < this.dayConfig.targetIngredientCount) {
      const spawned = this.trySpawnNextTarget();
      if (!spawned) break;
    }

    // Settle again after new target spawn
    DiscreteGravity.settle(this.grid);

    // Replenish loose pieces up to comfortable target
    while (this.grid.getAllLoosePieces().length < this.dayConfig.loosePieceComfortMax) {
      const spawned = this.trySpawnNextLoosePiece();
      if (!spawned) break;
    }

    // Final check for deadlocks
    this.checkDeadlockAndDanger();
  }

  private checkDeadlockAndDanger(): void {
    this._stats.deadlockChecks++;
    const check = DeadlockDetector.evaluate(
      this.grid,
      this._ingredients,
      this.dayConfig.targetIngredientCount
    );

    if (check.isDanger) {
      this.events.emit('BOARD_DANGER', {
        topRowOccupancy: check.topRowOccupancy,
        warningMessage: '棋盘顶部接近饱和！'
      });
    }

    if (check.isDeadlocked) {
      this._isGameOver = true;
      this.events.emit('BOARD_BLOCKED', {
        reason: '无可执行拼图、无待消除目标、无法生成必要碎片'
      });
      this.events.emit('DAY_FAILED', {
        dayNumber: this.dayConfig.dayNumber,
        currentRevenue: this.orderSystem.totalRevenue,
        businessGoal: this.orderSystem.businessGoal,
        reason: 'BOARD_BLOCKED'
      });
    }
  }

  getState(): GameSessionState {
    return {
      dayNumber: this.dayConfig.dayNumber,
      businessGoal: this.orderSystem.businessGoal,
      currentRevenue: this.orderSystem.totalRevenue,
      isGoalReached: this.orderSystem.isGoalReached,
      isGameOver: this._isGameOver,
      isDeadlocked: this._isGameOver && !this.orderSystem.isGoalReached,
      targets: this.grid.getAllTargets(),
      loosePieces: this.grid.getAllLoosePieces(),
      inventory: this.inventory.getAllAvailable(),
      currentOrder: this.orderSystem.currentOrder,
      nextOrderPreview: this.orderSystem.getNextOrderPreview(),
      stats: this.stats
    };
  }
}
