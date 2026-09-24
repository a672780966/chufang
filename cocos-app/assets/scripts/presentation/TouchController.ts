import { _decorator, Component, Node, EventTouch, Vec3, UITransform, tween, Vec2, input, Input } from 'cc';
import { GameManager } from '../GameManager';
import { BoardView } from './BoardView';
import { LoosePiece, DEFAULT_INGREDIENTS } from '../../game-core/index';
import { CocosAudioDirector } from './CocosAudioDirector';
import { CocosTelemetrySink } from './CocosTelemetrySink';

const { ccclass, property } = _decorator;

@ccclass('TouchController')
export class TouchController extends Component {
  @property(GameManager)
  gameManager: GameManager | null = null;

  @property(BoardView)
  boardView: BoardView | null = null;

  private _draggingPiece: LoosePiece | null = null;
  private _draggingNode: Node | null = null;
  private _originLocalPos: Vec3 = new Vec3();
  private _snapRadius: number = 95;

  onLoad() {
    if (!this.boardView) {
      this.boardView = this.getComponent(BoardView) || this.node.scene?.getComponentInChildren(BoardView) || null;
    }
    if (!this.gameManager) {
      this.gameManager = this.getComponent(GameManager) || this.node.scene?.getComponentInChildren(GameManager) || null;
    }

    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private screenToBoardLocal(uiLocation: Vec2): Vec3 {
    if (!this.boardView || !this.boardView.node) {
      return new Vec3(uiLocation.x, uiLocation.y, 0);
    }
    const uiTransform = this.boardView.node.getComponent(UITransform);
    if (!uiTransform) {
      return new Vec3(uiLocation.x, uiLocation.y, 0);
    }
    return uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
  }

  private onTouchStart(event: EventTouch) {
    if (!this.gameManager || this.gameManager.session.isGameOver || !this.boardView) return;

    const localPos = this.screenToBoardLocal(event.getUILocation());
    const loosePieces = this.gameManager.session.grid.getAllLoosePieces();

    // Hit-test loose pieces on board
    for (const piece of loosePieces) {
      const piecePos = this.boardView.gridToLocalPos(piece.coord);
      const dist = Vec3.distance(localPos, piecePos);

      if (dist < 55) {
        const pieceNode = this.boardView.piecesContainer?.getChildByName(`Piece_${piece.instanceId}`);
        if (pieceNode) {
          this._draggingPiece = piece;
          this._draggingNode = pieceNode;
          this._originLocalPos.set(pieceNode.position);

          pieceNode.setSiblingIndex(999);
          tween(pieceNode).to(0.08, { scale: new Vec3(1.15, 1.15, 1) }).start();
          CocosAudioDirector.playPickPiece();
          CocosTelemetrySink.log('piece_drag', this.gameManager.session.dayConfig.dayNumber, {
            pieceId: piece.instanceId,
            targetId: piece.targetInstanceId
          });
          break;
        }
      }
    }
  }

  private onTouchMove(event: EventTouch) {
    if (!this._draggingNode || !this._draggingPiece) return;

    const localPos = this.screenToBoardLocal(event.getUILocation());
    this._draggingNode.setPosition(localPos);
  }

  private onTouchEnd(event: EventTouch) {
    if (!this._draggingNode || !this._draggingPiece || !this.gameManager || !this.boardView) {
      this.clearDragState();
      return;
    }

    const currentPos = this._draggingNode.position;
    const session = this.gameManager.session;

    // Strict Target-first Instance Binding: find target by targetInstanceId
    const target = session.grid.getTarget(this._draggingPiece.targetInstanceId);
    let placed = false;

    if (target) {
      const def = DEFAULT_INGREDIENTS[target.ingredientId];
      const slotDef = def?.slots.find(s => s.slotId === this._draggingPiece!.slotId);

      if (slotDef) {
        const slotAbsCoord = {
          col: target.anchor.col + slotDef.relativeCol,
          row: target.anchor.row + slotDef.relativeRow
        };
        const slotLocalPos = this.boardView.gridToLocalPos(slotAbsCoord);
        const dist = Vec3.distance(currentPos, slotLocalPos);

        if (dist <= this._snapRadius) {
          const res = this.gameManager.placePiece(
            this._draggingPiece.instanceId,
            target.instanceId,
            slotDef.slotId
          );

          if (res.success) {
            placed = true;
            CocosAudioDirector.playSnapPiece();
            CocosTelemetrySink.log('piece_placed', session.dayConfig.dayNumber, {
              pieceId: this._draggingPiece.instanceId,
              targetId: target.instanceId,
              slotId: slotDef.slotId
            });
          }
        }
      }
    }

    if (!placed) {
      CocosAudioDirector.playWrongDrop();
      CocosTelemetrySink.log('wrong_drop', session.dayConfig.dayNumber);
      const origin = this._originLocalPos.clone();
      const node = this._draggingNode;
      tween(node)
        .to(0.18, { position: origin, scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }

    this.clearDragState();
  }

  private onTouchCancel(event: EventTouch) {
    if (this._draggingNode) {
      const origin = this._originLocalPos.clone();
      tween(this._draggingNode)
        .to(0.15, { position: origin, scale: new Vec3(1, 1, 1) })
        .start();
    }
    this.clearDragState();
  }

  private clearDragState() {
    this._draggingPiece = null;
    this._draggingNode = null;
  }
}
