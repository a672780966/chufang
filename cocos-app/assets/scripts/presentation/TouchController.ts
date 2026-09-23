import { _decorator, Component, Node, EventTouch, Vec3 } from 'cc';
import { GameManager } from '../GameManager.js';
import { BoardView } from './BoardView.js';

const { ccclass, property } = _decorator;

@ccclass('TouchController')
export class TouchController extends Component {
  @property(GameManager)
  gameManager: GameManager | null = null;

  @property(BoardView)
  boardView: BoardView | null = null;

  private _draggingPieceId: string | null = null;
  private _dragOriginPos: Vec3 = new Vec3();

  onLoad() {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  onDestroy() {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private onTouchStart(event: EventTouch) {
    // Touch tracking logic mapped to BoardView
  }

  private onTouchMove(event: EventTouch) {
    // Drag following logic
  }

  private onTouchEnd(event: EventTouch) {
    // Drop validation logic: calls gameManager.session.placePiece
  }

  private onTouchCancel(event: EventTouch) {
    // Revert piece to origin pos
  }
}
