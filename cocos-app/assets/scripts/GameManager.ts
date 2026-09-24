import { _decorator, Component, Node } from 'cc';
import {
  GameSession,
  DEFAULT_DAYS,
  DEFAULT_INGREDIENTS,
  DEFAULT_RECIPES
} from '../game-core/index';
import { BoardView } from './presentation/BoardView';
import { ReceiptPrinterView } from './presentation/ReceiptPrinterView';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
  @property(BoardView)
  boardView: BoardView | null = null;

  @property(ReceiptPrinterView)
  receiptPrinterView: ReceiptPrinterView | null = null;

  private _session!: GameSession;
  private _currentDayIndex: number = 0;

  onLoad() {
    this.startDay(this._currentDayIndex);
  }

  startDay(dayIndex: number) {
    this._currentDayIndex = dayIndex;
    const dayConfig = DEFAULT_DAYS[dayIndex] || DEFAULT_DAYS[0];
    const seed = Date.now();

    this._session = new GameSession(dayConfig, seed);

    if (this.boardView) {
      this.boardView.init(this._session);
    }
    if (this.receiptPrinterView) {
      this.receiptPrinterView.init(this._session);
    }

    this.bindEvents();
  }

  private bindEvents() {
    const events = this._session.events;

    events.on('TARGET_SPAWNED', (p) => {
      this.boardView?.onTargetSpawned(p);
    });

    events.on('PIECE_SPAWNED', (p) => {
      this.boardView?.onPieceSpawned(p);
    });

    events.on('PIECE_PLACED', (p) => {
      this.boardView?.onPiecePlaced(p);
    });

    events.on('INGREDIENT_COMPLETED', (p) => {
      this.boardView?.onIngredientCompleted(p);
    });

    events.on('BOARD_SETTLED', (p) => {
      this.boardView?.onBoardSettled(p);
    });

    events.on('ORDER_CREATED', (p) => {
      this.receiptPrinterView?.onOrderCreated(p);
    });

    events.on('ORDER_PROGRESS', (p) => {
      this.receiptPrinterView?.onOrderProgress(p);
    });

    events.on('ORDER_COMPLETED', (p) => {
      this.receiptPrinterView?.onOrderCompleted(p);
    });

    events.on('CASCADE_STEP', (p) => {
      this.receiptPrinterView?.onCascadeStep(p);
    });

    events.on('DAY_CLEARED', (p) => {
      console.log(`[Cocos] DAY ${p.dayNumber} CLEARED! Revenue: ¥${p.totalRevenue}`);
    });

    events.on('DAY_FAILED', (p) => {
      console.log(`[Cocos] DAY ${p.dayNumber} FAILED: ${p.reason}`);
    });
  }

  get session(): GameSession {
    return this._session;
  }
}
