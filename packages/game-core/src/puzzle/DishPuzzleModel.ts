/**
 * DishPuzzleModel.ts
 * Pure deterministic domain model for the true Jigsaw Puzzle gameplay.
 * Models DishPuzzleInstance, DishPuzzlePiece, PieceGroup, and physical adjacency rules.
 */

import { GridCoord, JigsawEdges } from '../model/Types';

export interface DishPuzzlePiece {
  readonly pieceInstanceId: string;
  readonly dishPuzzleInstanceId: string;
  readonly dishId: string;
  readonly dishCol: number;
  readonly dishRow: number;
  readonly slotId: string;
  boardCoord: GridCoord;
  groupId: string;
  readonly edges: JigsawEdges;
  readonly imagePath: string;
}

export interface PieceGroup {
  readonly groupId: string;
  readonly dishPuzzleInstanceId: string;
  readonly dishId: string;
  pieceIds: string[];
  isComplete: boolean;
}

export interface DishPuzzleInstance {
  readonly instanceId: string;
  readonly dishId: string;
  readonly name: string;
  readonly totalPieces: number;
  isCompleted: boolean;
  spawnedSlots: Set<string>;
}

/**
 * Checks if two pieces belong to the same dish instance and are orthogonally adjacent in dish coordinates.
 */
export function arePiecesDishAdjacent(p1: DishPuzzlePiece, p2: DishPuzzlePiece): boolean {
  if (p1.dishPuzzleInstanceId !== p2.dishPuzzleInstanceId) return false;
  const dCol = Math.abs(p1.dishCol - p2.dishCol);
  const dRow = Math.abs(p1.dishRow - p2.dishRow);
  return (dCol + dRow) === 1;
}

/**
 * Checks if two pieces are geometrically aligned on the board relative to their dish offsets.
 * i.e., (boardCol2 - boardCol1 === dishCol2 - dishCol1) && (boardRow2 - boardRow1 === dishRow2 - dishRow1)
 */
export function arePiecesGeometricallyAligned(p1: DishPuzzlePiece, p2: DishPuzzlePiece): boolean {
  if (p1.dishPuzzleInstanceId !== p2.dishPuzzleInstanceId) return false;
  const deltaBoardCol = p2.boardCoord.col - p1.boardCoord.col;
  const deltaBoardRow = p2.boardCoord.row - p1.boardCoord.row;
  const deltaDishCol = p2.dishCol - p1.dishCol;
  const deltaDishRow = p2.dishRow - p1.dishRow;
  return deltaBoardCol === deltaDishCol && deltaBoardRow === deltaDishRow;
}

/**
 * Standard edge generation for a 3x3 dish puzzle ensuring strict tab/blank complementarity.
 */
export function generateDishSlotEdges(col: number, row: number, cols: number = 3, rows: number = 3): JigsawEdges {
  // Border edges are flat
  const top = row === rows - 1 ? 'flat' : ((col + row) % 2 === 0 ? 'tab' : 'blank');
  const bottom = row === 0 ? 'flat' : ((col + row - 1) % 2 === 0 ? 'blank' : 'tab');
  const left = col === 0 ? 'flat' : ((col - 1 + row) % 2 === 0 ? 'blank' : 'tab');
  const right = col === cols - 1 ? 'flat' : ((col + row) % 2 === 0 ? 'tab' : 'blank');

  return { top, right, bottom, left };
}
