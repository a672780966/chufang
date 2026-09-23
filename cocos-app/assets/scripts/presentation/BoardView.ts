import { _decorator, Component, Node, Vec3, tween, UITransform } from 'cc';
import {
  GameSession,
  GridCoord,
  IngredientTarget,
  LoosePiece,
  CoreEventMap
} from '../../../packages/game-core/src/index.js';

const { ccclass, property } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
  @property(Node)
  targetsContainer: Node | null = null;

  @property(Node)
  piecesContainer: Node | null = null;

  private _session!: GameSession;
  private _cellWidth: number = 80;
  private _cellHeight: number = 80;

  init(session: GameSession) {
    this._session = session;
    this.calculateCellSize();
    this.renderInitialBoard();
  }

  private calculateCellSize() {
    const uiTransform = this.node.getComponent(UITransform);
    if (uiTransform) {
      this._cellWidth = uiTransform.width / this._session.grid.columns;
      this._cellHeight = uiTransform.height / this._session.grid.rows;
    }
  }

  gridToLocalPos(coord: GridCoord): Vec3 {
    const uiTransform = this.node.getComponent(UITransform);
    const originX = uiTransform ? -uiTransform.width / 2 : 0;
    const originY = uiTransform ? -uiTransform.height / 2 : 0;

    const x = originX + (coord.col + 0.5) * this._cellWidth;
    const y = originY + (coord.row + 0.5) * this._cellHeight;
    return new Vec3(x, y, 0);
  }

  renderInitialBoard() {
    // Clear old children if any
    this.targetsContainer?.removeAllChildren();
    this.piecesContainer?.removeAllChildren();

    // Render targets and loose pieces
    for (const target of this._session.grid.getAllTargets()) {
      this.createTargetNode(target);
    }

    for (const piece of this._session.grid.getAllLoosePieces()) {
      this.createPieceNode(piece);
    }
  }

  createTargetNode(target: IngredientTarget): Node {
    const node = new Node(`Target_${target.instanceId}`);
    node.setPosition(this.gridToLocalPos(target.anchor));
    this.targetsContainer?.addChild(node);
    return node;
  }

  createPieceNode(piece: LoosePiece): Node {
    const node = new Node(`Piece_${piece.instanceId}`);
    node.setPosition(this.gridToLocalPos(piece.coord));
    this.piecesContainer?.addChild(node);
    return node;
  }

  onPiecePlaced(payload: CoreEventMap['PIECE_PLACED']) {
    const pieceNode = this.piecesContainer?.getChildByName(`Piece_${payload.pieceInstanceId}`);
    if (pieceNode) {
      // Scale down and remove
      tween(pieceNode)
        .to(0.15, { scale: new Vec3(0, 0, 1) })
        .call(() => pieceNode.destroy())
        .start();
    }
  }

  onIngredientCompleted(payload: CoreEventMap['INGREDIENT_COMPLETED']) {
    const targetNode = this.targetsContainer?.getChildByName(`Target_${payload.target.instanceId}`);
    if (targetNode) {
      // Golden punch effect and fly-away
      tween(targetNode)
        .to(0.12, { scale: new Vec3(1.2, 1.2, 1) })
        .to(0.2, { scale: new Vec3(0, 0, 1) })
        .call(() => targetNode.destroy())
        .start();
    }
  }

  onBoardSettled(payload: CoreEventMap['BOARD_SETTLED']) {
    // Discrete gravity smooth animation
    for (const item of payload.movedTargets) {
      const node = this.targetsContainer?.getChildByName(`Target_${item.instanceId}`);
      if (node) {
        const dest = this.gridToLocalPos(item.toAnchor);
        tween(node).to(0.22, { position: dest }, { easing: 'quadOut' }).start();
      }
    }

    for (const item of payload.movedPieces) {
      const node = this.piecesContainer?.getChildByName(`Piece_${item.instanceId}`);
      if (node) {
        const dest = this.gridToLocalPos(item.toCoord);
        tween(node).to(0.22, { position: dest }, { easing: 'quadOut' }).start();
      }
    }
  }
}
