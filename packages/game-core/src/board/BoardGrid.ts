import { GridCoord, BoardProfile, DEFAULT_BOARD_PROFILE, IngredientTarget, LoosePiece } from '../model/Types.js';

export type CellContent =
  | { type: 'empty' }
  | { type: 'piece'; instanceId: string; ingredientId: string }
  | { type: 'target'; instanceId: string; ingredientId: string };

export class BoardGrid {
  readonly profile: BoardProfile;
  readonly columns: number;
  readonly rows: number;
  readonly spawnBufferRows: number;
  readonly totalRows: number;

  private _cells: CellContent[][]; // [col][row]
  private _targets: Map<string, IngredientTarget> = new Map();
  private _loosePieces: Map<string, LoosePiece> = new Map();

  constructor(profile: BoardProfile = DEFAULT_BOARD_PROFILE) {
    this.profile = profile;
    this.columns = profile.columns;
    this.rows = profile.rows;
    this.spawnBufferRows = profile.spawnBufferRows;
    this.totalRows = this.rows + this.spawnBufferRows;

    this._cells = [];
    for (let c = 0; c < this.columns; c++) {
      this._cells[c] = [];
      for (let r = 0; r < this.totalRows; r++) {
        this._cells[c][r] = { type: 'empty' };
      }
    }
  }

  isCoordInBounds(coord: GridCoord): boolean {
    return (
      coord.col >= 0 &&
      coord.col < this.columns &&
      coord.row >= 0 &&
      coord.row < this.totalRows
    );
  }

  isPlayableCoord(coord: GridCoord): boolean {
    return (
      coord.col >= 0 &&
      coord.col < this.columns &&
      coord.row >= 0 &&
      coord.row < this.rows
    );
  }

  isSpawnZoneCoord(coord: GridCoord): boolean {
    return (
      coord.col >= 0 &&
      coord.col < this.columns &&
      coord.row >= this.rows &&
      coord.row < this.totalRows
    );
  }

  isCellEmpty(coord: GridCoord): boolean {
    if (!this.isCoordInBounds(coord)) return false;
    return this._cells[coord.col][coord.row].type === 'empty';
  }

  getCell(coord: GridCoord): CellContent | null {
    if (!this.isCoordInBounds(coord)) return null;
    return this._cells[coord.col][coord.row];
  }

  canPlaceFootprint(footprint: GridCoord[], anchor: GridCoord, ignoreInstanceId?: string): boolean {
    for (const offset of footprint) {
      const absCoord = { col: anchor.col + offset.col, row: anchor.row + offset.row };
      if (!this.isCoordInBounds(absCoord)) return false;
      const cell = this._cells[absCoord.col][absCoord.row];
      if (cell.type !== 'empty') {
        if (ignoreInstanceId && (cell.type === 'target' || cell.type === 'piece') && cell.instanceId === ignoreInstanceId) {
          continue;
        }
        return false;
      }
    }
    return true;
  }

  /**
   * Checks if a target footprint can legally enter via the top Spawn Zone.
   * Target anchor MUST be at row = this.rows (bottom of spawn zone),
   * and its entire footprint must fit within the spawn buffer rows.
   */
  findSpawnAnchorsForFootprint(footprint: GridCoord[]): GridCoord[] {
    const valid: GridCoord[] = [];
    const spawnRow = this.rows;
    for (let c = 0; c < this.columns; c++) {
      const anchor = { col: c, row: spawnRow };
      let allInSpawnZone = true;
      for (const offset of footprint) {
        const absRow = spawnRow + offset.row;
        if (absRow >= this.totalRows) {
          allInSpawnZone = false;
          break;
        }
      }
      if (allInSpawnZone && this.canPlaceFootprint(footprint, anchor)) {
        valid.push(anchor);
      }
    }
    return valid;
  }

  occupyTarget(target: IngredientTarget): void {
    this._targets.set(target.instanceId, target);
    for (const coord of target.occupiedCoords) {
      if (this.isCoordInBounds(coord)) {
        this._cells[coord.col][coord.row] = {
          type: 'target',
          instanceId: target.instanceId,
          ingredientId: target.ingredientId
        };
      }
    }
  }

  removeTarget(instanceId: string): GridCoord[] {
    const target = this._targets.get(instanceId);
    if (!target) return [];
    this._targets.delete(instanceId);
    const released: GridCoord[] = [];
    for (const coord of target.occupiedCoords) {
      if (this.isCoordInBounds(coord)) {
        const cell = this._cells[coord.col][coord.row];
        if (cell.type === 'target' && cell.instanceId === instanceId) {
          this._cells[coord.col][coord.row] = { type: 'empty' };
          released.push(coord);
        }
      }
    }
    return released;
  }

  occupyLoosePiece(piece: LoosePiece): void {
    this._loosePieces.set(piece.instanceId, piece);
    if (this.isCoordInBounds(piece.coord)) {
      this._cells[piece.coord.col][piece.coord.row] = {
        type: 'piece',
        instanceId: piece.instanceId,
        ingredientId: piece.ingredientId
      };
    }
  }

  removeLoosePiece(instanceId: string): GridCoord | null {
    const piece = this._loosePieces.get(instanceId);
    if (!piece) return null;
    this._loosePieces.delete(instanceId);
    const coord = piece.coord;
    if (this.isCoordInBounds(coord)) {
      const cell = this._cells[coord.col][coord.row];
      if (cell.type === 'piece' && cell.instanceId === instanceId) {
        this._cells[coord.col][coord.row] = { type: 'empty' };
        return coord;
      }
    }
    return coord;
  }

  getTarget(instanceId: string): IngredientTarget | undefined {
    return this._targets.get(instanceId);
  }

  getAllTargets(): IngredientTarget[] {
    return Array.from(this._targets.values());
  }

  getLoosePiece(instanceId: string): LoosePiece | undefined {
    return this._loosePieces.get(instanceId);
  }

  getAllLoosePieces(): LoosePiece[] {
    return Array.from(this._loosePieces.values());
  }

  /**
   * Returns valid anchor coordinates where the given footprint can be placed
   * within the playable board rows.
   */
  findValidAnchorsForFootprint(footprint: GridCoord[]): GridCoord[] {
    const valid: GridCoord[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const anchor = { col: c, row: r };
        if (this.canPlaceFootprint(footprint, anchor)) {
          // also ensure all offsets are within playable rows
          let allPlayable = true;
          for (const offset of footprint) {
            const row = anchor.row + offset.row;
            if (row >= this.rows) {
              allPlayable = false;
              break;
            }
          }
          if (allPlayable) {
            valid.push(anchor);
          }
        }
      }
    }
    return valid;
  }

  /**
   * Finds lowest empty cell in a given column (from row 0 upwards)
   */
  findLowestEmptyRowInCol(col: number): number | null {
    if (col < 0 || col >= this.columns) return null;
    for (let r = 0; r < this.totalRows; r++) {
      if (this._cells[col][r].type === 'empty') {
        return r;
      }
    }
    return null;
  }

  /**
   * Checks how full the top rows are (for danger warning)
   */
  getTopRowOccupancyRatio(): number {
    let occupied = 0;
    const startRow = Math.max(0, this.rows - 2);
    const totalCount = this.columns * 2;
    for (let c = 0; c < this.columns; c++) {
      for (let r = startRow; r < startRow + 2; r++) {
        if (this._cells[c][r].type !== 'empty') {
          occupied++;
        }
      }
    }
    return occupied / totalCount;
  }

  /**
   * Returns the maximum row index + 1 currently occupied across all columns.
   */
  getMaxStackHeight(): number {
    let maxHeight = 0;
    for (let c = 0; c < this.columns; c++) {
      for (let r = this.totalRows - 1; r >= 0; r--) {
        if (this._cells[c][r].type !== 'empty') {
          if (r + 1 > maxHeight) maxHeight = r + 1;
          break;
        }
      }
    }
    return maxHeight;
  }
}
