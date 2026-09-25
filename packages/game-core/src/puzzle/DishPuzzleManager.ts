/**
 * DishPuzzleManager.ts
 * Manages active dish puzzle instances, piece groups, and physical adjacency snapping on the board grid.
 * Enforces pure deterministic rules for:
 *   Piece -> Piece -> Group -> Dish -> Clear
 */

import { GridCoord } from '../model/Types.js';
import { EventEmitter } from '../model/Events.js';
import {
  DishPuzzlePiece,
  PieceGroup,
  DishPuzzleInstance,
  arePiecesDishAdjacent,
  arePiecesGeometricallyAligned,
  generateDishSlotEdges
} from './DishPuzzleModel.js';
import { GOLD_SAMPLE_DISH_MANIFEST } from '../data/DishManifest.js';
import { DishPieceSupplyScheduler } from './DishPieceSupplyScheduler.js';

export interface MoveGroupResult {
  success: boolean;
  merged: boolean;
  completedDish?: DishPuzzleInstance;
  reason?: string;
}

export class DishPuzzleManager {
  readonly events: EventEmitter;
  readonly columns: number;
  readonly rows: number;

  private _instances = new Map<string, DishPuzzleInstance>();
  private _pieces = new Map<string, DishPuzzlePiece>();
  private _groups = new Map<string, PieceGroup>();
  /** 2D grid lookup: [row][col] -> pieceInstanceId or null */
  private _gridCells: (string | null)[][];
  private _instanceCounter: number = 1;
  private _pieceCounter: number = 1;
  private _groupCounter: number = 1;
  private _scheduler = new DishPieceSupplyScheduler();

  constructor(columns: number = 8, rows: number = 12, events?: EventEmitter) {
    this.columns = columns;
    this.rows = rows;
    this.events = events || new EventEmitter();

    this._gridCells = Array.from({ length: rows }, () => Array(columns).fill(null));
  }

  getPiece(pieceId: string): DishPuzzlePiece | undefined {
    return this._pieces.get(pieceId);
  }

  getGroup(groupId: string): PieceGroup | undefined {
    return this._groups.get(groupId);
  }

  getGroupByPieceId(pieceId: string): PieceGroup | undefined {
    const piece = this._pieces.get(pieceId);
    if (!piece) return undefined;
    return this._groups.get(piece.groupId);
  }

  getAllPieces(): DishPuzzlePiece[] {
    return Array.from(this._pieces.values());
  }

  getAllGroups(): PieceGroup[] {
    return Array.from(this._groups.values());
  }

  getPieceAt(col: number, row: number): DishPuzzlePiece | undefined {
    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) return undefined;
    const id = this._gridCells[row][col];
    return id ? this._pieces.get(id) : undefined;
  }

  /**
   * Initializes the Day 1 board layout containing pieces and partially connected groups
   * from all 3 Gold Sample dishes (Breakfast, Salad, Ramen) spanning across rows 0 to 6
   * (58.3% vertical span), with distinct identifiable partial groups.
   * DOES NOT collapse to the bottom via premature global gravity.
   */
  initDay1Layout(): void {
    this._pieces.clear();
    this._groups.clear();
    this._instances.clear();
    this._scheduler.cleanupInstances([]);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        this._gridCells[r][c] = null;
      }
    }

    // Create 3 active dish instances
    const breakfast = this.createDishInstance('dish_breakfast');
    const salad = this.createDishInstance('dish_salad');
    const ramen = this.createDishInstance('dish_ramen');

    // --- 1. Salad (Target Dish for Day 1 - Full 9 pieces solvable in 4 natural drags) ---
    // Group 1 (4 pieces, pre-connected 2x2 base): (0,0), (1,0), (0,1), (1,1) at board (0..1, 0..1)
    const s_0_0 = this.createPiece(salad.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const s_1_0 = this.createPiece(salad.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
    const s_0_1 = this.createPiece(salad.instanceId, 'dish_salad', 0, 1, { col: 0, row: 1 });
    const s_1_1 = this.createPiece(salad.instanceId, 'dish_salad', 1, 1, { col: 1, row: 1 });
    this.createGroup([s_0_0, s_1_0, s_0_1, s_1_1]);

    // Group 2 (2 pieces, vertical duo): (2,0) and (2,1) at board (4,2) and (4,3)
    const s_2_0 = this.createPiece(salad.instanceId, 'dish_salad', 2, 0, { col: 4, row: 2 });
    const s_2_1 = this.createPiece(salad.instanceId, 'dish_salad', 2, 1, { col: 4, row: 3 });
    this.createGroup([s_2_0, s_2_1]);

    // Salad remaining loose pieces:
    const s_0_2 = this.createPiece(salad.instanceId, 'dish_salad', 0, 2, { col: 3, row: 0 });
    this.createGroup([s_0_2]);

    const s_1_2 = this.createPiece(salad.instanceId, 'dish_salad', 1, 2, { col: 5, row: 0 });
    this.createGroup([s_1_2]);

    const s_2_2 = this.createPiece(salad.instanceId, 'dish_salad', 2, 2, { col: 6, row: 2 });
    this.createGroup([s_2_2]);

    // --- 2. Breakfast Pieces (Scattered mid/upper partial groups) ---
    // Group 3 (2 pieces horizontal duo): (0,2) and (1,2) at board (3,4) and (4,4)
    const b_0_2 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 0, 2, { col: 3, row: 4 });
    const b_1_2 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 1, 2, { col: 4, row: 4 });
    this.createGroup([b_0_2, b_1_2]);

    const b_0_1 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 0, 1, { col: 3, row: 5 });
    this.createGroup([b_0_1]);

    const b_1_1 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 1, 1, { col: 4, row: 5 });
    this.createGroup([b_1_1]);

    // --- 3. Ramen Pieces (Scattered mid/upper partial groups reaching row 6) ---
    // Group 4 (2 pieces horizontal duo): (1,0) and (2,0) at board (6,4) and (7,4)
    const r_1_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 1, 0, { col: 6, row: 4 });
    const r_2_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 2, 0, { col: 7, row: 4 });
    this.createGroup([r_1_0, r_2_0]);

    const r_0_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 0, 0, { col: 7, row: 5 });
    this.createGroup([r_0_0]);

    const r_1_1 = this.createPiece(ramen.instanceId, 'dish_ramen', 1, 1, { col: 6, row: 6 });
    this.createGroup([r_1_1]);

    // Stage 4.1: NO global gravity collapse on initialization.
    // Preserves vertical span across rows 0 to 6 (58.3% coverage).
  }

  /**
   * Ensures the board always maintains 3 active unfinished DishPuzzleInstances.
   * On Day 1: maintains 'dish_salad', 'dish_breakfast', 'dish_ramen'.
   */
  maintainActiveDishPool(targetDishes: string[] = ['dish_salad', 'dish_breakfast', 'dish_ramen']): DishPuzzleInstance[] {
    // Only maintain multi-dish pool if this manager is running a multi-dish session
    if (this._instances.size < 2) {
      return Array.from(this._instances.values()).filter(i => !i.isCompleted);
    }

    const activeInstances: DishPuzzleInstance[] = [];

    for (const dishId of targetDishes) {
      let inst = Array.from(this._instances.values()).find(
        i => i.dishId === dishId && !i.isCompleted
      );
      if (!inst) {
        inst = this.createDishInstance(dishId);
      }
      activeInstances.push(inst);
    }

    return activeInstances;
  }

  createDishInstance(dishId: string): DishPuzzleInstance {
    const manifest = GOLD_SAMPLE_DISH_MANIFEST[dishId];
    const instanceId = `inst_${dishId}_${this._instanceCounter++}`;
    const instance: DishPuzzleInstance = {
      instanceId,
      dishId,
      name: manifest?.name || dishId,
      totalPieces: 9,
      isCompleted: false,
      spawnedSlots: new Set<string>()
    };
    this._instances.set(instanceId, instance);
    return instance;
  }

  createPiece(
    dishPuzzleInstanceId: string,
    dishId: string,
    dishCol: number,
    dishRow: number,
    boardCoord: GridCoord
  ): DishPuzzlePiece {
    const pieceInstanceId = `p_${dishId}_${dishCol}_${dishRow}_${this._pieceCounter++}`;
    const slotId = `slot_${dishCol}_${dishRow}`;
    const edges = generateDishSlotEdges(dishCol, dishRow, 3, 3);
    const imagePath = `/assets/dishes/piece_${dishId}_slot_${dishCol}_${dishRow}.png`;

    const inst = this._instances.get(dishPuzzleInstanceId);
    if (inst) {
      inst.spawnedSlots.add(`${dishCol}_${dishRow}`);
    }

    const piece: DishPuzzlePiece = {
      pieceInstanceId,
      dishPuzzleInstanceId,
      dishId,
      dishCol,
      dishRow,
      slotId,
      boardCoord: { ...boardCoord },
      groupId: '',
      edges,
      imagePath
    };

    this._pieces.set(pieceInstanceId, piece);
    if (boardCoord.row >= 0 && boardCoord.row < this.rows && boardCoord.col >= 0 && boardCoord.col < this.columns) {
      this._gridCells[boardCoord.row][boardCoord.col] = pieceInstanceId;
    }

    return piece;
  }

  createGroup(pieces: DishPuzzlePiece[]): PieceGroup {
    if (pieces.length === 0) throw new Error('Cannot create empty PieceGroup');
    const groupId = `grp_${pieces[0].dishId}_${this._groupCounter++}`;
    const group: PieceGroup = {
      groupId,
      dishPuzzleInstanceId: pieces[0].dishPuzzleInstanceId,
      dishId: pieces[0].dishId,
      pieceIds: pieces.map(p => p.pieceInstanceId),
      isComplete: pieces.length === 9
    };

    for (const p of pieces) {
      p.groupId = groupId;
    }

    this._groups.set(groupId, group);
    return group;
  }

  /**
   * Attempts to move an entire PieceGroup so its anchor piece sits at targetAnchor.
   * If valid, relocates all member pieces rigid-body style, then triggers adjacency check.
   * Does NOT trigger premature global gravity.
   */
  tryMoveGroup(groupId: string, targetCol: number, targetRow: number, referencePieceId?: string): MoveGroupResult {
    const group = this._groups.get(groupId);
    if (!group) return { success: false, merged: false, reason: 'GROUP_NOT_FOUND' };

    const pieces = group.pieceIds.map(id => this._pieces.get(id)!).filter(Boolean);
    if (pieces.length === 0) return { success: false, merged: false, reason: 'EMPTY_GROUP' };

    // Reference piece to calculate offset
    const ref = (referencePieceId ? this._pieces.get(referencePieceId) : null) || pieces[0];
    const deltaCol = targetCol - ref.boardCoord.col;
    const deltaRow = targetRow - ref.boardCoord.row;

    // Check bounds and collision for every piece in the group
    const newCoords: { piece: DishPuzzlePiece; col: number; row: number }[] = [];
    for (const p of pieces) {
      const c = p.boardCoord.col + deltaCol;
      const r = p.boardCoord.row + deltaRow;

      if (c < 0 || c >= this.columns || r < 0 || r >= this.rows) {
        return { success: false, merged: false, reason: 'OUT_OF_BOUNDS' };
      }

      const occupantId = this._gridCells[r][c];
      if (occupantId && !group.pieceIds.includes(occupantId)) {
        return { success: false, merged: false, reason: 'CELL_OCCUPIED' };
      }

      newCoords.push({ piece: p, col: c, row: r });
    }

    // 1. Clear old grid cells
    for (const p of pieces) {
      if (this._gridCells[p.boardCoord.row][p.boardCoord.col] === p.pieceInstanceId) {
        this._gridCells[p.boardCoord.row][p.boardCoord.col] = null;
      }
    }

    // 2. Set new grid cells and update piece coords
    for (const item of newCoords) {
      item.piece.boardCoord.col = item.col;
      item.piece.boardCoord.row = item.row;
      this._gridCells[item.col >= 0 ? item.row : 0][item.col] = item.piece.pieceInstanceId;
    }

    // 3. Check for geometric adjacency snapping
    const mergeResult = this.checkAndMergeAdjacency(groupId);

    return {
      success: true,
      merged: mergeResult.merged,
      completedDish: mergeResult.completedDish
    };
  }

  /**
   * Inspects orthogonal neighbor cells around every piece in the group.
   * If an aligned matching piece from the same dish instance is found, merges groups!
   */
  checkAndMergeAdjacency(groupId: string): { merged: boolean; completedDish?: DishPuzzleInstance } {
    let currentGroup = this._groups.get(groupId);
    if (!currentGroup) return { merged: false };

    let totalMerged = false;
    let keepChecking = true;

    while (keepChecking) {
      keepChecking = false;
      const memberPieces = currentGroup.pieceIds.map(id => this._pieces.get(id)!).filter(Boolean);

      for (const piece of memberPieces) {
        const neighbors = [
          { col: piece.boardCoord.col + 1, row: piece.boardCoord.row },
          { col: piece.boardCoord.col - 1, row: piece.boardCoord.row },
          { col: piece.boardCoord.col, row: piece.boardCoord.row + 1 },
          { col: piece.boardCoord.col, row: piece.boardCoord.row - 1 }
        ];

        for (const n of neighbors) {
          const neighborPiece = this.getPieceAt(n.col, n.row);
          if (!neighborPiece) continue;

          // Must be same dish instance but different group
          if (
            neighborPiece.dishPuzzleInstanceId === piece.dishPuzzleInstanceId &&
            neighborPiece.groupId !== currentGroup.groupId
          ) {
            // Check dish adjacency and geometric alignment
            if (
              arePiecesDishAdjacent(piece, neighborPiece) &&
              arePiecesGeometricallyAligned(piece, neighborPiece)
            ) {
              // SNAP & MERGE!
              const otherGroup = this._groups.get(neighborPiece.groupId);
              if (otherGroup) {
                this.mergeTwoGroups(currentGroup, otherGroup);
                totalMerged = true;
                keepChecking = true;
                break;
              }
            }
          }
        }
        if (keepChecking) break;
      }
    }

    // Check if dish complete
    if (currentGroup.pieceIds.length === 9) {
      currentGroup.isComplete = true;
      const instance = this._instances.get(currentGroup.dishPuzzleInstanceId);
      if (instance && !instance.isCompleted) {
        instance.isCompleted = true;
        this.events.emit('DISH_COMPLETED', {
          dishId: instance.dishId,
          dishPuzzleInstanceId: instance.instanceId,
          groupId: currentGroup.groupId,
          pieces: currentGroup.pieceIds.map(id => this._pieces.get(id)!)
        });
        return { merged: totalMerged, completedDish: instance };
      }
    }

    return { merged: totalMerged };
  }

  private mergeTwoGroups(targetGroup: PieceGroup, sourceGroup: PieceGroup): void {
    for (const pieceId of sourceGroup.pieceIds) {
      const piece = this._pieces.get(pieceId);
      if (piece) {
        piece.groupId = targetGroup.groupId;
        targetGroup.pieceIds.push(pieceId);
      }
    }
    this._groups.delete(sourceGroup.groupId);

    this.events.emit('PIECE_GROUP_MERGED', {
      targetGroupId: targetGroup.groupId,
      pieceCount: targetGroup.pieceIds.length
    });
  }

  /**
   * Clears a completed 9-piece dish from the board, frees cells, triggers Completion Reflow,
   * emits DISH_SERVED, and maintains the 3-dish active pool.
   */
  clearCompletedGroup(groupId: string): void {
    const group = this._groups.get(groupId);
    if (!group) return;

    const dishId = group.dishId;
    const dishPuzzleInstanceId = group.dishPuzzleInstanceId;

    // Remove pieces from grid
    for (const pieceId of group.pieceIds) {
      const piece = this._pieces.get(pieceId);
      if (piece) {
        if (this._gridCells[piece.boardCoord.row][piece.boardCoord.col] === pieceId) {
          this._gridCells[piece.boardCoord.row][piece.boardCoord.col] = null;
        }
        this._pieces.delete(pieceId);
      }
    }
    this._groups.delete(groupId);

    this.events.emit('DISH_CLEARED', {
      dishId,
      dishPuzzleInstanceId,
      groupId
    });

    // 1. Completion Reflow: apply rigid group gravity when a dish clears!
    this.applyGravity();

    // 2. Emit DISH_SERVED: marks serving transition (cleared from board -> ready for next order)
    this.events.emit('DISH_SERVED', {
      dishId,
      dishPuzzleInstanceId,
      groupId
    });

    // 3. Maintain active pool of 3 dishes
    this.maintainActiveDishPool();
  }

  /**
   * Spawns a deterministic, unblocked Day 1 Salad layout for a new instance.
   * Guarantees complete 9 pieces, zero orphan pieces, and 4 natural drag moves.
   */
  spawnDay1SaladLayout(saladInst: DishPuzzleInstance): void {
    // 1. Group 1: 2x2 base (4 pieces)
    const s_0_0 = this.createPiece(saladInst.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const s_1_0 = this.createPiece(saladInst.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
    const s_0_1 = this.createPiece(saladInst.instanceId, 'dish_salad', 0, 1, { col: 0, row: 1 });
    const s_1_1 = this.createPiece(saladInst.instanceId, 'dish_salad', 1, 1, { col: 1, row: 1 });
    this.createGroup([s_0_0, s_1_0, s_0_1, s_1_1]);

    // 2. Group 2: vertical duo (2 pieces) in col 4
    let col4Row = 0;
    while (col4Row < this.rows && this._gridCells[col4Row][4] !== null) col4Row++;
    const s_2_0 = this.createPiece(saladInst.instanceId, 'dish_salad', 2, 0, { col: 4, row: col4Row });
    const s_2_1 = this.createPiece(saladInst.instanceId, 'dish_salad', 2, 1, { col: 4, row: col4Row + 1 });
    this.createGroup([s_2_0, s_2_1]);

    // 3. Loose piece (0,2) in col 3
    let col3Row = 0;
    while (col3Row < this.rows && this._gridCells[col3Row][3] !== null) col3Row++;
    const s_0_2 = this.createPiece(saladInst.instanceId, 'dish_salad', 0, 2, { col: 3, row: col3Row });
    this.createGroup([s_0_2]);

    // 4. Loose piece (1,2) in col 5
    let col5Row = 0;
    while (col5Row < this.rows && this._gridCells[col5Row][5] !== null) col5Row++;
    const s_1_2 = this.createPiece(saladInst.instanceId, 'dish_salad', 1, 2, { col: 5, row: col5Row });
    this.createGroup([s_1_2]);

    // 5. Loose piece (2,2) in col 6
    let col6Row = 0;
    while (col6Row < this.rows && this._gridCells[col6Row][6] !== null) col6Row++;
    const s_2_2 = this.createPiece(saladInst.instanceId, 'dish_salad', 2, 2, { col: 6, row: col6Row });
    this.createGroup([s_2_2]);

    // Emit typed DISH_PIECE_SPAWNED events for presentation layer
    for (const p of [s_0_0, s_1_0, s_0_1, s_1_1, s_2_0, s_2_1, s_0_2, s_1_2, s_2_2]) {
      this.events.emit('DISH_PIECE_SPAWNED', {
        piece: p,
        fromCoord: { col: p.boardCoord.col, row: this.rows - 1 },
        toCoord: p.boardCoord
      });
    }
  }

  /**
   * Ensures there is an active, unfinished DishPuzzleInstance for the given dishId.
   */
  ensureActiveDishInstance(dishId: string): DishPuzzleInstance {
    let existing = Array.from(this._instances.values()).find(
      inst => inst.dishId === dishId && !inst.isCompleted
    );
    if (!existing) {
      existing = this.createDishInstance(dishId);
    }
    if (dishId === 'dish_salad' && existing.spawnedSlots.size === 0) {
      this.spawnDay1SaladLayout(existing);
    }
    this.maintainActiveDishPool();
    return existing;
  }

  /**
   * Applies PieceGroup-based rigid gravity:
   * Every connected PieceGroup translates down as an indivisible rigid body.
   * All member relative coordinates are strictly preserved across gravity steps.
   */
  applyGravity(): boolean {
    let movedAnyOverall = false;
    let keepSimulating = true;

    while (keepSimulating) {
      keepSimulating = false;

      // Group groups by their current positions
      for (const group of this._groups.values()) {
        const pieces = group.pieceIds.map(id => this._pieces.get(id)!).filter(Boolean);
        if (pieces.length === 0) continue;

        // Check if this entire group can drop down by 1 row
        let canDropOneRow = true;
        for (const p of pieces) {
          const belowRow = p.boardCoord.row - 1;
          if (belowRow < 0) {
            canDropOneRow = false;
            break;
          }
          const occupantId = this._gridCells[belowRow][p.boardCoord.col];
          // Cell below must be either empty, OR occupied by a piece belonging to this SAME group
          if (occupantId !== null && !group.pieceIds.includes(occupantId)) {
            canDropOneRow = false;
            break;
          }
        }

        if (canDropOneRow) {
          // Drop the entire group down by 1 row simultaneously
          // 1. Clear old cells
          for (const p of pieces) {
            if (this._gridCells[p.boardCoord.row][p.boardCoord.col] === p.pieceInstanceId) {
              this._gridCells[p.boardCoord.row][p.boardCoord.col] = null;
            }
          }
          // 2. Set new cells and update coordinates
          for (const p of pieces) {
            p.boardCoord.row -= 1;
            this._gridCells[p.boardCoord.row][p.boardCoord.col] = p.pieceInstanceId;
          }
          movedAnyOverall = true;
          keepSimulating = true; // Continue simulation until all groups settle
        }
      }
    }

    return movedAnyOverall;
  }

  /**
   * Spawns and settles a piece locally within a target column.
   * Places the piece directly on top of the highest occupied row in targetCol.
   * DOES NOT trigger global gravity that would collapse other columns/groups.
   */
  localSettlePiece(
    instance: DishPuzzleInstance,
    slotCol: number,
    slotRow: number,
    preferredCol?: number
  ): DishPuzzlePiece | null {
    let targetCol = preferredCol !== undefined && preferredCol >= 0 && preferredCol < this.columns ? preferredCol : -1;
    if (targetCol !== -1 && this._gridCells[this.rows - 1][targetCol] !== null) {
      targetCol = -1;
    }

    if (targetCol === -1) {
      // Strictly prioritize columns 3..7 to keep columns 0..2 reserved for active dish assembly
      const candidateCols = [3, 4, 5, 6, 7];
      let minHeight = Infinity;
      for (const c of candidateCols) {
        if (this._gridCells[this.rows - 1][c] === null) {
          let h = 0;
          for (let r = 0; r < this.rows; r++) {
            if (this._gridCells[r][c] !== null) h = r + 1;
          }
          // Avoid exceeding danger line (row 10)
          if (h < 10 && h < minHeight) {
            minHeight = h;
            targetCol = c;
          }
        }
      }
      if (targetCol === -1) {
        for (const c of candidateCols) {
          if (this._gridCells[this.rows - 1][c] === null) {
            targetCol = c;
            break;
          }
        }
      }
      // If columns 3..7 are completely full, fallback to [2, 1, 0] as last resort
      if (targetCol === -1) {
        for (const c of [2, 1, 0]) {
          if (this._gridCells[this.rows - 1][c] === null) {
            targetCol = c;
            break;
          }
        }
      }
    }

    if (targetCol === -1) return null; // Board full

    // Find lowest free row in targetCol
    let settleRow = 0;
    while (settleRow < this.rows && this._gridCells[settleRow][targetCol] !== null) {
      settleRow++;
    }
    if (settleRow >= this.rows) return null;

    const piece = this.createPiece(
      instance.instanceId,
      instance.dishId,
      slotCol,
      slotRow,
      { col: targetCol, row: settleRow }
    );
    this.createGroup([piece]);

    this.events.emit('DISH_PIECE_SPAWNED', {
      piece,
      fromCoord: { col: targetCol, row: this.rows - 1 },
      toCoord: { col: targetCol, row: settleRow }
    });

    return piece;
  }

  /**
   * Schedules and spawns pieces across active unfinished instances using soft priorities and starvation protection.
   * Spawns using localSettlePiece, avoiding premature global collapse.
   */
  schedulePieceAcrossActiveDishes(
    batchCount: number = 1,
    currentOrderDishId?: string
  ): DishPuzzlePiece[] {
    this.maintainActiveDishPool();
    const activeInstances = Array.from(this._instances.values()).filter(i => !i.isCompleted);
    const spawned: DishPuzzlePiece[] = [];

    for (let i = 0; i < batchCount; i++) {
      const candidate = this._scheduler.selectNextCandidate(
        activeInstances,
        (id) => this.getMissingSlots(id),
        currentOrderDishId
      );
      if (!candidate) break;

      const piece = this.localSettlePiece(
        candidate.instance,
        candidate.slot.col,
        candidate.slot.row
      );
      if (piece) {
        spawned.push(piece);
      }
    }

    return spawned;
  }

  /**
   * Deterministically refills missing pieces from active non-completed DishPuzzleInstances
   * via multi-dish scheduler.
   */
  refillMissingPieces(maxPieces: number = 3, currentOrderDishId?: string): DishPuzzlePiece[] {
    return this.schedulePieceAcrossActiveDishes(maxPieces, currentOrderDishId);
  }

  /**
   * Returns missing slot coordinates for an instance that have not yet been spawned.
   */
  getMissingSlots(instanceId: string): { col: number; row: number }[] {
    const inst = this._instances.get(instanceId);
    if (!inst) return [];
    const missing: { col: number; row: number }[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!inst.spawnedSlots.has(`${c}_${r}`)) {
          missing.push({ col: c, row: r });
        }
      }
    }
    return missing;
  }

  /**
   * Deterministically refills missing pieces across all active instances until completeness
   * (9/9 pieces spawned for each active instance) or until no more pieces can be placed.
   */
  refillAllMissingPieces(currentOrderDishId?: string): DishPuzzlePiece[] {
    const allSpawned: DishPuzzlePiece[] = [];
    let batch: DishPuzzlePiece[];
    do {
      batch = this.schedulePieceAcrossActiveDishes(3, currentOrderDishId);
      allSpawned.push(...batch);
    } while (batch.length > 0);
    return allSpawned;
  }
}
