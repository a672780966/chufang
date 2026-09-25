import {
  DayConfig,
  IngredientDefinition,
  RecipeDefinition,
  IngredientTarget,
  LoosePiece,
  GameStats,
  NextOrderPreview,
  GridCoord,
  DEFAULT_PRESSURE_PROFILE
} from '../model/Types';
import { EventEmitter, CoreEventMap } from '../model/Events';
import { BoardGrid } from '../board/BoardGrid';
import { DiscreteGravity } from '../board/DiscreteGravity';
import { PrepInventory } from '../inventory/PrepInventory';
import { OrderSystem } from '../order/OrderSystem';
import { FlowDirector } from '../director/FlowDirector';
import { DeadlockDetector } from '../detector/DeadlockDetector';
import { SeededRandom } from '../random/SeededRandom';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../data/DefaultData';
import { DishPuzzleManager } from '../puzzle/DishPuzzleManager';

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
  readonly dishPuzzleManager: DishPuzzleManager;
  readonly dayConfig: DayConfig;
  readonly daySeed: string | number;

  private _rng: SeededRandom;
  private _ingredients: Record<string, IngredientDefinition>;
  private _recipes: Record<string, RecipeDefinition>;
  private _isGameOver: boolean = false;
  private _targetCounter: number = 1;
  private _pieceCounter: number = 1;
  private _consecutiveNonClearPlacements: number = 0;

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

    this.dishPuzzleManager = new DishPuzzleManager(this.grid.columns, this.grid.rows, this.events);
    if (dayConfig.dayNumber === 1) {
      this.dishPuzzleManager.initDay1Layout();
    }

    // Connect Dish serving (triggered when completed group clears) directly with OrderSystem
    this.events.on('DISH_SERVED', ({ dishId }) => {
      this.orderSystem.handleCompletedDish(dishId);
      if (this.orderSystem.isGoalReached) {
        this._isGameOver = true;
        this.events.emit('DAY_CLEARED', {
          dayNumber: this.dayConfig.dayNumber,
          totalRevenue: this.orderSystem.totalRevenue,
          businessGoal: this.orderSystem.businessGoal,
          ordersCompleted: this.orderSystem.ordersFulfilledCount
        });
      } else if (this.orderSystem.currentOrder) {
        const neededDishId = this.orderSystem.currentOrder.dishId || (this.orderSystem.currentOrder.recipeId.startsWith('dish_') ? this.orderSystem.currentOrder.recipeId : `dish_${this.orderSystem.currentOrder.recipeId}`);
        this.dishPuzzleManager.ensureActiveDishInstance(neededDishId);
      }
    });

    this.events.on('BUSINESS_GOAL_REACHED', () => {
      this._isGameOver = true;
      this.events.emit('DAY_CLEARED', {
        dayNumber: this.dayConfig.dayNumber,
        totalRevenue: this.orderSystem.totalRevenue,
        businessGoal: this.orderSystem.businessGoal,
        ordersCompleted: this.orderSystem.ordersFulfilledCount
      });
    });

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

  get revenue(): number {
    return this.orderSystem.totalRevenue;
  }

  get ingredients(): Record<string, IngredientDefinition> {
    return this._ingredients;
  }

  get recipes(): Record<string, RecipeDefinition> {
    return this._recipes;
  }

  get nextOrderPreview(): NextOrderPreview {
    return this.orderSystem.getNextOrderPreview();
  }

  /**
   * Initializes starting targets and loose pieces on the board.
   * All objects strictly enter via the top Spawn Zone and settle downward via DiscreteGravity.
   */
  private initBoard(): void {
    // 1. Spawn starting ingredient targets from top spawn zone
    while (this.grid.getAllTargets().length < this.dayConfig.targetIngredientCount) {
      const spawned = this.trySpawnNextTarget();
      if (!spawned) break;
    }

    // 2. Spawn starting loose pieces from top spawn row
    while (this.grid.getAllLoosePieces().length < this.dayConfig.loosePieceComfortMin) {
      const spawned = this.trySpawnNextLoosePiece();
      if (!spawned) break;
    }

    // 3. Ensure board has at least one legal placement if possible
    this.ensurePlayableMove();
  }

  /**
   * Spawns a new ingredient target chosen by FlowDirector.
   * Target MUST enter via the top Spawn Zone (row = this.grid.rows),
   * and settles downward under unified DiscreteGravity.
   */
  private trySpawnNextTarget(): boolean {
    const def = this.flowDirector.selectNextTargetIngredient(
      this.grid,
      this.inventory,
      this.orderSystem.currentOrder,
      this.orderSystem.getNextOrderFact()
    );
    if (!def) return false;

    // Must find valid anchor strictly within the top Spawn Zone
    const spawnAnchors = this.grid.findSpawnAnchorsForFootprint(def.footprint);
    if (spawnAnchors.length === 0) {
      // Spawn zone blocked; cannot spawn target
      return false;
    }

    const chosenAnchor = spawnAnchors[this._rng.nextInt(0, spawnAnchors.length - 1)];
    const targetId = `target_${def.id}_${this._targetCounter++}`;
    // Closure ReleasePlan is determined by Seed per Target instance
    const releasePlan = this.flowDirector.createPieceReleasePlan(def, `${targetId}_${this.daySeed}`);
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
      ageTurns: 0,
      nearCompletionTurns: 0
    };

    // 1. Enter at spawn zone
    this.grid.occupyTarget(target);

    // 2. Unified DiscreteGravity drops the target down into resting position
    const settleResult = DiscreteGravity.settle(this.grid);

    this.events.emit('TARGET_SPAWNED', {
      target,
      fromAnchor: chosenAnchor,
      toAnchor: { ...target.anchor }
    });

    if (settleResult.hasMoved) {
      this.events.emit('BOARD_SETTLED', {
        movedTargets: settleResult.movedTargets,
        movedPieces: settleResult.movedPieces
      });
    }

    return true;
  }

  /**
   * Spawns a loose piece for one of the active targets.
   * Loose piece MUST enter via the top row of the Spawn Zone (totalRows - 1),
   * and settles downward under unified DiscreteGravity.
   */
  private trySpawnNextLoosePiece(): boolean {
    const selected = this.flowDirector.selectNextLoosePiece(
      this.grid,
      this.inventory,
      this.orderSystem.currentOrder,
      this.orderSystem.getNextOrderFact()
    );
    if (!selected) return false;

    const topSpawnRow = this.grid.totalRows - 1;

    // Find columns where the top spawn cell is empty
    const candidateCols: number[] = [];
    for (let c = 0; c < this.grid.columns; c++) {
      if (this.grid.isCellEmpty({ col: c, row: topSpawnRow })) {
        candidateCols.push(c);
      }
    }
    if (candidateCols.length === 0) {
      // Top spawn line blocked; cannot enter
      return false;
    }

    if (!selected.target) return false;

    const chosenCol = candidateCols[this._rng.nextInt(0, candidateCols.length - 1)];
    const pieceId = `piece_${selected.ingredientId}_${this._pieceCounter++}`;
    const initialCoord = { col: chosenCol, row: topSpawnRow };

    const piece: LoosePiece = {
      instanceId: pieceId,
      ingredientId: selected.ingredientId,
      targetInstanceId: selected.target.instanceId,
      slotId: selected.slotId,
      coord: initialCoord
    };

    // 1. Enter at top spawn cell
    this.grid.occupyLoosePiece(piece);

    // 2. Unified DiscreteGravity drops the piece down into resting position
    const settleResult = DiscreteGravity.settle(this.grid);

    // Emit event with entry coord and final resting coord
    this.events.emit('PIECE_SPAWNED', {
      piece,
      fromCoord: initialCoord,
      toCoord: { ...piece.coord }
    });

    if (settleResult.hasMoved) {
      this.events.emit('BOARD_SETTLED', {
        movedTargets: settleResult.movedTargets,
        movedPieces: settleResult.movedPieces
      });
    }

    return true;
  }

  /**
   * Player Action: Places a loose piece into an ingredient target slot.
   * Strictly enforces Target-first Instance Binding: piece must belong to targetInstanceId.
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

    // Strict Target-first Instance Binding validation: Must match the bound target instance and slot
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

    // Advance turns for all active targets on the board
    for (const t of this.grid.getAllTargets()) {
      t.ageTurns++;
      if (t.instanceId !== target.instanceId && t.missingSlotIds.length <= 1) {
        t.nearCompletionTurns = (t.nearCompletionTurns || 0) + 1;
      }
    }
    if (target.missingSlotIds.length <= 1 && (target.nearCompletionTurns === undefined || target.missingSlotIds.length === 1)) {
      target.nearCompletionTurns = 0;
    }

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
      this._consecutiveNonClearPlacements++;
      const profile = this.dayConfig.pressureProfile || DEFAULT_PRESSURE_PROFILE;

      // Base inflow from DayConfig.pressureProfile
      for (let i = 0; i < profile.baseInflowPerPlacement; i++) {
        this.trySpawnNextLoosePiece();
      }

      // Check danger state: if in danger and pauseBonusOnDanger is true, suppress bonus drops
      // to create a recoverable near-dead state!
      const inDanger = this.isBoardInDanger();

      if (!inDanger || !profile.pauseBonusOnDanger) {
        if (
          profile.escalationThreshold > 0 &&
          this._consecutiveNonClearPlacements >= profile.escalationThreshold &&
          profile.escalationInterval > 0 &&
          this._consecutiveNonClearPlacements % profile.escalationInterval === 0
        ) {
          for (let i = 0; i < profile.escalationAmount; i++) {
            this.trySpawnNextLoosePiece();
          }
        } else if (
          profile.bonusInterval > 0 &&
          this._consecutiveNonClearPlacements % profile.bonusInterval === 0
        ) {
          for (let i = 0; i < profile.bonusAmount; i++) {
            this.trySpawnNextLoosePiece();
          }
        }
      }

      this.ensurePlayableMove();
      this.checkDeadlockAndDanger();
    }

    return { success: true };
  }

  /**
   * Checks whether the board currently meets BOARD_DANGER thresholds.
   */
  isBoardInDanger(): boolean {
    const topRowOccupancy = this.grid.getTopRowOccupancyRatio();
    const maxStackHeight = this.grid.getMaxStackHeight();
    return maxStackHeight >= this.grid.rows - 3 || topRowOccupancy >= 0.20;
  }

  /**
   * Ensures that the board has at least one valid legal piece placement if active targets exist.
   * If no loose pieces on the board match any active target's missing slots, attempts to spawn
   * an essential loose piece from the top spawn zone. If the top spawn zone is blocked, the spawn
   * fails, which naturally triggers deadlock detection in checkDeadlockAndDanger().
   */
  private ensurePlayableMove(): void {
    const hasLegal = (): boolean => {
      const targets = this.grid.getAllTargets();
      const loosePieces = this.grid.getAllLoosePieces();
      return targets.some(t =>
        loosePieces.some(p => p.targetInstanceId === t.instanceId && t.missingSlotIds.includes(p.slotId))
      );
    };

    while (!hasLegal() && this.grid.getAllTargets().length > 0) {
      const spawned = this.trySpawnNextLoosePiece();
      if (!spawned) break;
    }
  }

  /**
   * Handles completion of an ingredient target:
   * 1. Remove from board -> PrepInventory (major 4~9 cell relief!)
   * 2. Order reservation & cascade
   * 3. Board-wide discrete settling (Completion Reflow / Near-dead recovery)
   * 4. Replenish targets & pieces
   * 5. Check victory / deadlock
   */
  private handleIngredientCompleted(target: IngredientTarget): void {
    this._stats.ingredientsCompleted++;
    this._consecutiveNonClearPlacements = 0; // Reset pressure accumulator!
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

    // Guarantee that at least one valid move exists or detect deadlock
    this.ensurePlayableMove();

    // Final check for deadlocks
    this.checkDeadlockAndDanger();
  }

  private checkDeadlockAndDanger(): void {
    this._stats.deadlockChecks++;
    const check = DeadlockDetector.evaluate(
      this.grid,
      this._ingredients,
      this.dayConfig.targetIngredientCount,
      this.dayConfig.availableRecipeIds,
      this._recipes
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
