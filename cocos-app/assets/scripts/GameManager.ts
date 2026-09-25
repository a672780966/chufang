import { _decorator, Component, Node, Label, Vec3, tween } from 'cc';
import {
  GameSession,
  GameFlowManager,
  SaveSystem,
  CampaignState,
  DayCompletionRecord,
  DEFAULT_DAYS
} from '../game-core/index';
import { BoardView } from './presentation/BoardView';
import { ReceiptPrinterView } from './presentation/ReceiptPrinterView';
import { CocosStorageAdapter } from './presentation/CocosStorageAdapter';
import { CocosAudioDirector } from './presentation/CocosAudioDirector';
import { CocosTelemetrySink } from './presentation/CocosTelemetrySink';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
  @property(BoardView)
  boardView: BoardView | null = null;

  @property(ReceiptPrinterView)
  receiptPrinterView: ReceiptPrinterView | null = null;

  @property(Node)
  menuNode: Node | null = null;

  @property(Node)
  gameNode: Node | null = null;

  @property(Node)
  victoryModalNode: Node | null = null;

  @property(Node)
  failedModalNode: Node | null = null;

  @property(Node)
  settingsModalNode: Node | null = null;

  @property(Label)
  dayTitleLabel: Label | null = null;

  @property(Label)
  revenueGoalLabel: Label | null = null;

  @property(Node)
  dangerBannerNode: Node | null = null;

  private _flow!: GameFlowManager;
  private _session!: GameSession;
  private _currentDayNumber: number = 1;

  onLoad() {
    // 1. Injected StoragePort using cc.sys.localStorage
    SaveSystem.setStorage(new CocosStorageAdapter());

    // 2. Initialize GameFlowManager with full lifecycle hooks
    this._flow = new GameFlowManager({
      onPhaseChanged: (phase, prev) => {
        this.onPhaseChanged(phase, prev);
      },
      onTutorialCue: (cue) => {
        this.boardView?.setTutorialCue(cue);
      },
      onDayCompleted: (record) => {
        this.onDayCompleted(record);
      },
      onDayFailed: (reason) => {
        this.onDayFailed(reason);
      },
      onResolvingRequested: (durationMs) => {
        this.scheduleOnce(() => {
          this._flow.finishResolving();
        }, durationMs / 1000);
      }
    });

    const highest = this._flow.campaignState.highestUnlockedDay;
    this.startDay(highest);
  }

  /**
   * Starts a specific day session (1 ~ 12).
   */
  startDay(dayNumber: number, seed?: string | number) {
    this._currentDayNumber = Math.max(1, Math.min(12, dayNumber));
    const session = this._flow.startDay(this._currentDayNumber, seed);
    this._session = session;

    CocosTelemetrySink.log('day_start', this._currentDayNumber);

    // Initialize presentation views
    if (this.boardView) {
      this.boardView.init(this._session);
    }
    if (this.receiptPrinterView) {
      this.receiptPrinterView.init(this._session);
    }

    this.bindSessionEvents();
    this.updateHUD();

    // Trigger Day Intro presentation then begin playing
    this.scheduleOnce(() => {
      this._flow.beginPlaying();
      this.updateHUD();
    }, 0.3);

    // Start background music if enabled
    if (this._flow.campaignState.settings.musicEnabled) {
      CocosAudioDirector.startBgm();
    }
  }

  private bindSessionEvents() {
    const events = this._session.events;

    events.on('TARGET_SPAWNED', (p) => {
      this.boardView?.onTargetSpawned(p);
      this.updateHUD();
    });

    events.on('PIECE_SPAWNED', (p) => {
      this.boardView?.onPieceSpawned(p);
      this.updateHUD();
    });

    events.on('DISH_PIECE_SPAWNED', (p) => {
      this.boardView?.onDishPieceSpawned(p);
      this.updateHUD();
    });

    events.on('DISH_COMPLETED', (p) => {
      this.boardView?.onDishCompleted(p);
      CocosAudioDirector.playOrderComplete();
      this.updateHUD();
    });

    events.on('DISH_CLEARED', (p) => {
      this.boardView?.onDishCleared(p);
      this.updateHUD();
    });

    events.on('DISH_SERVED', () => {
      this.updateHUD();
    });

    events.on('PIECE_PLACED', (p) => {
      this.boardView?.onPiecePlaced(p);
      this.updateHUD();
    });

    events.on('INGREDIENT_COMPLETED', (p) => {
      this.boardView?.onIngredientCompleted(p);
      CocosAudioDirector.playIngredientComplete(p.target?.ingredientId);
      this.updateHUD();
    });

    events.on('BOARD_SETTLED', (p) => {
      this.boardView?.onBoardSettled(p);
      CocosAudioDirector.playBoardSettling();
      this.updateHUD();
    });

    events.on('ORDER_CREATED', (p) => {
      this.receiptPrinterView?.onOrderCreated(p);
      CocosAudioDirector.playReceiptPrint();
      this.updateHUD();
    });

    events.on('ORDER_PROGRESS', (p) => {
      this.receiptPrinterView?.onOrderProgress(p);
      this.updateHUD();
    });

    events.on('ORDER_COMPLETED', (p) => {
      this.receiptPrinterView?.onOrderCompleted(p);
      CocosAudioDirector.playOrderComplete();
      this.updateHUD();
    });

    events.on('CASCADE_STEP', (p) => {
      this.receiptPrinterView?.onCascadeStep(p);
      CocosAudioDirector.playCascade(p.chainIndex);
      this.updateHUD();
    });

    events.on('BOARD_DANGER', () => {
      CocosAudioDirector.playDanger();
      this.updateHUD();
    });

    events.on('DAY_CLEARED', () => {
      CocosAudioDirector.playDayClear();
    });
  }

  placePiece(pieceInstanceId: string, targetInstanceId: string, slotId: string) {
    const res = this._flow.placePiece(pieceInstanceId, targetInstanceId, slotId);
    return res;
  }

  private onPhaseChanged(phase: string, _prev: string) {
    if (this.menuNode && this.gameNode) {
      if (phase === 'MAIN_MENU') {
        this.menuNode.active = true;
        this.gameNode.active = false;
      } else {
        this.menuNode.active = false;
        this.gameNode.active = true;
      }
    }
  }

  private onDayCompleted(record: DayCompletionRecord) {
    CocosTelemetrySink.log('day_clear', record.dayNumber, {
      revenueAchieved: record.revenueAchieved,
      businessGoal: record.businessGoal,
      ordersCompleted: record.ordersCompleted,
      maxCascadeStreak: record.maxCascadeStreak
    });

    if (this.victoryModalNode) {
      this.victoryModalNode.active = true;
    }
  }

  private onDayFailed(reason: string) {
    CocosTelemetrySink.log('day_fail', this._currentDayNumber, { reason });

    if (this.failedModalNode) {
      this.failedModalNode.active = true;
    }
  }

  advanceToNextDay() {
    if (this.victoryModalNode) {
      this.victoryModalNode.active = false;
    }
    const next = this._flow.advanceToNextDay();
    if (next) {
      this._session = next;
      this._currentDayNumber = next.dayConfig.dayNumber;
      this.startDay(this._currentDayNumber);
    } else {
      this.enterMainMenu();
    }
  }

  restartCurrentDay() {
    if (this.failedModalNode) {
      this.failedModalNode.active = false;
    }
    this.startDay(this._currentDayNumber);
  }

  enterMainMenu() {
    if (this.victoryModalNode) this.victoryModalNode.active = false;
    if (this.failedModalNode) this.failedModalNode.active = false;
    this._flow.enterMainMenu();
  }

  openSettings() {
    if (this.settingsModalNode) {
      this.settingsModalNode.active = true;
    }
  }

  closeSettings() {
    if (this.settingsModalNode) {
      this.settingsModalNode.active = false;
    }
  }

  toggleBgm() {
    const cur = !!this._flow.campaignState.settings.musicEnabled;
    SaveSystem.updateSettings({ musicEnabled: !cur });
    CocosAudioDirector.setBgmEnabled(!cur);
  }

  toggleSfx() {
    const cur = !!this._flow.campaignState.settings.soundEnabled;
    SaveSystem.updateSettings({ soundEnabled: !cur, sfxEnabled: !cur });
    CocosAudioDirector.setSfxEnabled(!cur);
  }

  resetSave() {
    SaveSystem.resetCampaignState();
    this.startDay(1);
    this.closeSettings();
  }

  exportTelemetryJson(): string {
    return CocosTelemetrySink.exportJson();
  }

  private updateHUD() {
    if (!this._session) return;

    if (this.dayTitleLabel) {
      this.dayTitleLabel.string = `DAY ${String(this._session.dayConfig.dayNumber).padStart(2, '0')}`;
    }

    if (this.revenueGoalLabel) {
      this.revenueGoalLabel.string = `¥${this._session.revenue} / ¥${this._session.dayConfig.businessGoal}`;
    }

    if (this.dangerBannerNode) {
      this.dangerBannerNode.active = this._session.isBoardInDanger();
    }
  }

  get session(): GameSession {
    return this._session;
  }

  get flow(): GameFlowManager {
    return this._flow;
  }
}
