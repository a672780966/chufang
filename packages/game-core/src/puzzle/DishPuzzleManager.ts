/**
 * DishPuzzleManager.ts
 * Manages active dish puzzle instances, piece groups, and physical adjacency snapping on the board grid.
 * Enforces pure deterministic rules for:
 *   Piece -> Piece -> Group -> Dish -> Clear
 */

import { GridCoord } from '../model/Types';
import { EventEmitter } from '../model/Events';
import {
  DishPuzzlePiece,
  PieceGroup,
  DishPuzzleInstance,
  arePiecesDishAdjacent,
  arePiecesGeometricallyAligned,
  generateDishSlotEdges
} from './DishPuzzleModel';
import { GOLD_SAMPLE_DISH_MANIFEST } from '../data/DishManifest';

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
   * from all 3 Gold Sample dishes (Breakfast, Salad, Ramen).
   */
  initDay1Layout(): void {
    this._pieces.clear();
    this._groups.clear();
    this._instances.clear();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        this._gridCells[r][c] = null;
      }
    }

    // Create 3 active dish instances
    const breakfast = this.createDishInstance('dish_breakfast');
    const salad = this.createDishInstance('dish_salad');
    const ramen = this.createDishInstance('dish_ramen');

    // --- Salad (Target Dish for Day 1 - Full 9 pieces solvable in 4 natural drags) ---
    // Group 1 (4 pieces, pre-connected 2x2 base): (0,0), (1,0), (0,1), (1,1) at board (0..1, 0..1)
    const s_0_0 = this.createPiece(salad.instanceId, 'dish_salad', 0, 0, { col: 0, row: 0 });
    const s_1_0 = this.createPiece(salad.instanceId, 'dish_salad', 1, 0, { col: 1, row: 0 });
    const s_0_1 = this.createPiece(salad.instanceId, 'dish_salad', 0, 1, { col: 0, row: 1 });
    const s_1_1 = this.createPiece(salad.instanceId, 'dish_salad', 1, 1, { col: 1, row: 1 });
    this.createGroup([s_0_0, s_1_0, s_0_1, s_1_1]);

    // Group 2 (2 pieces, vertical duo): (2,0) and (2,1) at board (4,0) and (4,1)
    const s_2_0 = this.createPiece(salad.instanceId, 'dish_salad', 2, 0, { col: 4, row: 0 });
    const s_2_1 = this.createPiece(salad.instanceId, 'dish_salad', 2, 1, { col: 4, row: 1 });
    this.createGroup([s_2_0, s_2_1]);

    // Salad remaining loose pieces:
    const s_0_2 = this.createPiece(salad.instanceId, 'dish_salad', 0, 2, { col: 3, row: 0 });
    this.createGroup([s_0_2]);

    const s_1_2 = this.createPiece(salad.instanceId, 'dish_salad', 1, 2, { col: 5, row: 0 });
    this.createGroup([s_1_2]);

    const s_2_2 = this.createPiece(salad.instanceId, 'dish_salad', 2, 2, { col: 6, row: 0 });
    this.createGroup([s_2_2]);

    // --- Breakfast Pieces (Scattered obstacles & next opportunities) ---
    // Group 3 (2 pieces): (0,2) and (1,2) at board (3,2) and (4,2)
    const b_0_2 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 0, 2, { col: 3, row: 2 });
    const b_1_2 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 1, 2, { col: 4, row: 2 });
    this.createGroup([b_0_2, b_1_2]);

    const b_0_1 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 0, 1, { col: 3, row: 1 });
    this.createGroup([b_0_1]);

    const b_1_1 = this.createPiece(breakfast.instanceId, 'dish_breakfast', 1, 1, { col: 5, row: 2 });
    this.createGroup([b_1_1]);

    // --- Ramen Pieces (Scattered obstacles & next opportunities) ---
    // Group 4 (2 pieces): (1,0) and (2,0) at board (5,1) and (6,1)
    const r_1_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 1, 0, { col: 5, row: 1 });
    const r_2_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 2, 0, { col: 6, row: 1 });
    this.createGroup([r_1_0, r_2_0]);

    const r_0_0 = this.createPiece(ramen.instanceId, 'dish_ramen', 0, 0, { col: 7, row: 0 });
    this.createGroup([r_0_0]);

    const r_1_1 = this.createPiece(ramen.instanceId, 'dish_ramen', 1, 1, { col: 7, row: 1 });
    this.createGroup([r_1_1]);

    this.applyGravity();
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

    // 2. Set new positions
    for (const item of newCoords) {
      item.piece.boardCoord.col = item.col;
      item.piece.boardCoord.row = item.row;
      this._gridCells[item.col >= 0 ? item.row : 0][item.col] = item.piece.pieceInstanceId;
    }

    // 3. Check for geometric adjacency snapping
    const mergeResult = this.checkAndMergeAdjacency(groupId);

    // 4. Settle any pieces that vacated cells left floating via PieceGroup rigid gravity
    this.applyGravity();

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
   * Clears a completed 9-piece dish from the board, frees cells, settles gravity,
   * and deterministically refills missing pieces to maintain playability.
   */
  clearCompletedGroup(groupId: string): void {
    const group = this._groups.get(groupId);
    if (!group) return;

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
      dishId: group.dishId,
      dishPuzzleInstanceId: group.dishPuzzleInstanceId,
      groupId
    });

    // 1. Settle pieces above down using PieceGroup-based rigid gravity
    this.applyGravity();

    // 2. Refill missing pieces from top spawn zone for active non-completed instances
    this.refillMissingPieces(3);
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
   * Deterministically refills missing pieces from active non-completed DishPuzzleInstances.
   * Spawns pieces at top row (rows - 1) into available columns and settles them via rigid gravity.
   * Guarantees zero orphan pieces.
   */
  refillMissingPieces(maxPieces: number = 3): DishPuzzlePiece[] {
    const spawned: DishPuzzlePiece[] = [];

    // Find active non-completed instances
    const activeInstances = Array.from(this._instances.values()).filter(inst => !inst.isCompleted);
    if (activeInstances.length === 0) return spawned;

    for (const inst of activeInstances) {
      if (spawned.length >= maxPieces) break;

      // Find which slots (0..2, 0..2) have not yet been spawned for this instance
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const slotKey = `${c}_${r}`;
          if (!inst.spawnedSlots.has(slotKey)) {
            // Find an available column at top row (rows - 1)
            let targetCol = -1;
            let minOccupancy = Infinity;
            for (let col = 0; col < this.columns; col++) {
              if (this._gridCells[this.rows - 1][col] === null) {
                let occ = 0;
                for (let row = 0; row < this.rows; row++) {
                  if (this._gridCells[row][col] !== null) occ++;
                }
                if (occ < minOccupancy) {
                  minOccupancy = occ;
                  targetCol = col;
                }
              }
            }

            if (targetCol !== -1) {
              const newPiece = this.createPiece(
                inst.instanceId,
                inst.dishId,
                c,
                r,
                { col: targetCol, row: this.rows - 1 }
              );
              this.createGroup([newPiece]);
              spawned.push(newPiece);

              this.events.emit('PIECE_SPAWNED', {
                piece: {
                  instanceId: newPiece.pieceInstanceId,
                  ingredientId: newPiece.dishId,
                  targetInstanceId: newPiece.dishPuzzleInstanceId,
                  slotId: newPiece.slotId,
                  coord: newPiece.boardCoord
                },
                fromCoord: { col: targetCol, row: this.rows - 1 },
                toCoord: newPiece.boardCoord
              });

              if (spawned.length >= maxPieces) break;
            }
          }
        }
        if (spawned.length >= maxPieces) break;
      }
    }

    if (spawned.length > 0) {
      this.applyGravity();
    }

    return spawned;
  }
}
