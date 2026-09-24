import { GridCoord } from '../model/Types';
import { BoardGrid } from './BoardGrid';

export interface SettleResult {
  hasMoved: boolean;
  movedTargets: Array<{ instanceId: string; fromAnchor: GridCoord; toAnchor: GridCoord }>;
  movedPieces: Array<{ instanceId: string; fromCoord: GridCoord; toCoord: GridCoord }>;
}

export class DiscreteGravity {
  /**
   * Performs discrete deterministic settling.
   * Objects (Targets and LoosePieces) shift downward row by row until resting on either row 0
   * or another immovable object.
   */
  static settle(grid: BoardGrid): SettleResult {
    const initialTargetAnchors = new Map<string, GridCoord>();
    const initialPieceCoords = new Map<string, GridCoord>();

    for (const target of grid.getAllTargets()) {
      initialTargetAnchors.set(target.instanceId, { ...target.anchor });
    }
    for (const piece of grid.getAllLoosePieces()) {
      initialPieceCoords.set(piece.instanceId, { ...piece.coord });
    }

    let somethingMoved = true;
    let iteration = 0;
    const maxIterations = grid.totalRows + 2;

    while (somethingMoved && iteration < maxIterations) {
      somethingMoved = false;
      iteration++;

      // 1. Check all targets (sorted by anchor row ascending so lower targets settle first)
      const targets = grid.getAllTargets().sort((a, b) => a.anchor.row - b.anchor.row);
      for (const target of targets) {
        if (target.anchor.row <= 0) continue;

        // Try moving down 1 row
        const targetDefFootprint = target.occupiedCoords.map(c => ({
          col: c.col - target.anchor.col,
          row: c.row - target.anchor.row
        }));
        const newAnchor = { col: target.anchor.col, row: target.anchor.row - 1 };

        if (grid.canPlaceFootprint(targetDefFootprint, newAnchor, target.instanceId)) {
          // Move target down
          grid.removeTarget(target.instanceId);
          target.anchor = newAnchor;
          target.occupiedCoords = targetDefFootprint.map(f => ({
            col: newAnchor.col + f.col,
            row: newAnchor.row + f.row
          }));
          grid.occupyTarget(target);
          somethingMoved = true;
        }
      }

      // 2. Check all loose pieces (sorted by row ascending)
      const pieces = grid.getAllLoosePieces().sort((a, b) => a.coord.row - b.coord.row);
      for (const piece of pieces) {
        if (piece.coord.row <= 0) continue;
        const newCoord = { col: piece.coord.col, row: piece.coord.row - 1 };

        if (grid.isCellEmpty(newCoord)) {
          grid.removeLoosePiece(piece.instanceId);
          piece.coord = newCoord;
          grid.occupyLoosePiece(piece);
          somethingMoved = true;
        }
      }
    }

    // Collect moved objects
    const movedTargets: Array<{ instanceId: string; fromAnchor: GridCoord; toAnchor: GridCoord }> = [];
    for (const [instanceId, fromAnchor] of initialTargetAnchors.entries()) {
      const target = grid.getTarget(instanceId);
      if (target && (target.anchor.col !== fromAnchor.col || target.anchor.row !== fromAnchor.row)) {
        movedTargets.push({
          instanceId,
          fromAnchor,
          toAnchor: { ...target.anchor }
        });
      }
    }

    const movedPieces: Array<{ instanceId: string; fromCoord: GridCoord; toCoord: GridCoord }> = [];
    for (const [instanceId, fromCoord] of initialPieceCoords.entries()) {
      const piece = grid.getLoosePiece(instanceId);
      if (piece && (piece.coord.col !== fromCoord.col || piece.coord.row !== fromCoord.row)) {
        movedPieces.push({
          instanceId,
          fromCoord,
          toCoord: { ...piece.coord }
        });
      }
    }

    return {
      hasMoved: movedTargets.length > 0 || movedPieces.length > 0,
      movedTargets,
      movedPieces
    };
  }
}
