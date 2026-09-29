import { GamePhase, CampaignState, DayConfig, DayCompletionRecord, GameplayMode } from '../model/Types';
import { GameSession } from '../session/GameSession';
import { DEFAULT_DAYS } from '../data/DefaultData';
import { SaveSystem } from './SaveSystem';
import { TutorialDirector, DragTutorialCue } from './TutorialDirector';

export interface GameFlowEvents {
  onPhaseChanged?: (phase: GamePhase, prevPhase: GamePhase) => void;
  onSessionStarted?: (session: GameSession) => void;
  onTutorialCue?: (cue: DragTutorialCue | null) => void;
  onDayCompleted?: (record: DayCompletionRecord) => void;
  onDayFailed?: (reason: string) => void;
  onResolvingRequested?: (suggestedDurationMs: number) => void;
}

export class GameFlowManager {
  private _phase: GamePhase = 'MAIN_MENU';
  private _campaignState: CampaignState;
  private _session: GameSession | null = null;
  private _selectedDay: number = 1;
  private _events: GameFlowEvents = {};
  private _resolvingTimeout: any = null;
  private _resolvingGroupId: string | null = null;

  constructor(events: GameFlowEvents = {}) {
    this._events = events;
    this._campaignState = SaveSystem.loadCampaignState();
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get campaignState(): CampaignState {
    return this._campaignState;
  }

  get session(): GameSession | null {
    return this._session;
  }

  get selectedDay(): number {
    return this._selectedDay;
  }

  get isInputLocked(): boolean {
    return this._phase !== 'PLAYING';
  }

  private transitionTo(newPhase: GamePhase): void {
    const prev = this._phase;
    this._phase = newPhase;
    this._events.onPhaseChanged?.(newPhase, prev);
  }

  /**
   * Enters Main Menu.
   */
  enterMainMenu(): void {
    if (this._resolvingTimeout) {
      clearTimeout(this._resolvingTimeout);
      this._resolvingTimeout = null;
    }
    this._resolvingGroupId = null;
    this._session = null;
    this._campaignState = SaveSystem.loadCampaignState();
    this.transitionTo('MAIN_MENU');
  }

  /**
   * Launches a day session. Transitions phase to DAY_INTRO.
   * Presentation layer calls beginPlaying() after intro animation finishes.
   */
  startDay(dayNumber: number, seed?: string | number, gameplayMode: GameplayMode = 'DISH_PUZZLE'): GameSession {
    if (dayNumber < 1 || dayNumber > 12) {
      throw new Error(`Invalid dayNumber: ${dayNumber}. Must be between 1 and 12.`);
    }

    if (this._resolvingTimeout) {
      clearTimeout(this._resolvingTimeout);
      this._resolvingTimeout = null;
    }
    this._resolvingGroupId = null;

    this._selectedDay = dayNumber;
    const dayConfig = DEFAULT_DAYS[dayNumber - 1];
    if (!dayConfig) {
      throw new Error(`DayConfig not found for Day ${dayNumber}`);
    }

    const sessionSeed = seed ?? `day_${dayNumber}_session`;
    this._session = new GameSession(dayConfig, sessionSeed, undefined, undefined, gameplayMode);

    this.transitionTo('DAY_INTRO');

    // Subscribe to session events
    this._session.events.on('INGREDIENT_COMPLETED', () => {
      this.handleResolvingEvent(500);
    });

    this._session.events.on('CASCADE_STEP', () => {
      this.handleResolvingEvent(650);
    });

    this._session.events.on('DISH_COMPLETED', (payload: any) => {
      this.handleDishCompletedResolving(payload);
    });

    this._session.events.on('BUSINESS_GOAL_REACHED', () => {
      this.handleDayWon();
    });

    this._session.events.on('BOARD_BLOCKED', (data: any) => {
      this.handleDayFailed(data?.reason || 'BOARD_BLOCKED');
    });

    this._session.events.on('DAY_FAILED', (data: any) => {
      this.handleDayFailed(data?.reason || 'DAY_FAILED');
    });

    this._events.onSessionStarted?.(this._session);

    return this._session;
  }

  /**
   * Transitions from DAY_INTRO to PLAYING.
   * Called by presentation layer once ready for interaction.
   */
  beginPlaying(): void {
    if (this._phase === 'DAY_INTRO') {
      this.transitionTo('PLAYING');
      if (this._session) {
        const cue = TutorialDirector.getFirstDragCue(this._session, this._campaignState);
        if (cue) {
          this._events.onTutorialCue?.(cue);
        }
      }
    }
  }

  /**
   * Places a piece with input-lock during resolution. (Legacy mode)
   */
  placePiece(pieceInstanceId: string, targetInstanceId: string, slotId: string): { success: boolean; reason?: string } {
    if (this.isInputLocked) {
      return { success: false, reason: 'INPUT_LOCKED' };
    }
    if (!this._session) {
      return { success: false, reason: 'NO_SESSION' };
    }

    // Dismiss first drag tutorial cue upon first piece placed
    TutorialDirector.dismissFirstDragCue();
    this._events.onTutorialCue?.(null);

    const res = this._session.placePiece(pieceInstanceId, targetInstanceId, slotId);
    return res;
  }

  /**
   * Stage 5A Authoritative Player Move: Moves a DishPuzzle group and updates state.
   */
  moveDishGroup(
    groupId: string,
    targetCol: number,
    targetRow: number,
    referencePieceId?: string
  ): { success: boolean; merged?: boolean; completedDish?: any; reason?: string } {
    if (this.isInputLocked) {
      return { success: false, reason: 'INPUT_LOCKED' };
    }
    if (!this._session) {
      return { success: false, reason: 'NO_SESSION' };
    }

    TutorialDirector.dismissFirstDragCue();
    this._events.onTutorialCue?.(null);

    return this._session.moveDishGroup(groupId, targetCol, targetRow, referencePieceId);
  }

  /**
   * Puts game into temporary RESOLVING state to let presentation animations complete.
   */
  private handleResolvingEvent(suggestedDurationMs: number): void {
    if (this._phase === 'DAY_CLEAR' || this._phase === 'DAY_FAILED') return;
    this.transitionTo('RESOLVING');
    this._events.onResolvingRequested?.(suggestedDurationMs);
  }

  /**
   * Handles DishPuzzle dish completion event with authoritative fallback timer.
   */
  private handleDishCompletedResolving(payload: any): void {
    if (this._phase === 'DAY_CLEAR' || this._phase === 'DAY_FAILED') return;
    this.transitionTo('RESOLVING');
    this._resolvingGroupId = payload?.groupId || null;
    const duration = 650;
    this._events.onResolvingRequested?.(duration);

    if (this._resolvingTimeout) {
      clearTimeout(this._resolvingTimeout);
    }
    // Authoritative fallback: Presentation layer gets 650ms + 150ms buffer.
    // If presentation is headless or fails to call finishResolving(), Core clears authoritatively!
    this._resolvingTimeout = setTimeout(() => {
      this.executeAuthoritativeDishResolution(payload?.groupId);
    }, duration + 150);
  }

  /**
   * Executes authoritative resolution of a completed dish.
   */
  executeAuthoritativeDishResolution(groupId?: string): void {
    if (this._resolvingTimeout) {
      clearTimeout(this._resolvingTimeout);
      this._resolvingTimeout = null;
    }
    const targetGroupId = groupId || this._resolvingGroupId;
    if (targetGroupId && this._session && this._session.dishPuzzleManager.getGroup(targetGroupId)) {
      this._session.resolveCompletedDish(targetGroupId);
    }
    this._resolvingGroupId = null;
    this.finishResolving();
  }

  /**
   * Called by presentation layer after visual resolution animations finish.
   */
  finishResolving(): void {
    if (this._resolvingTimeout) {
      clearTimeout(this._resolvingTimeout);
      this._resolvingTimeout = null;
    }
    this._resolvingGroupId = null;
    if (this._phase === 'RESOLVING') {
      if (this._session && this._session.revenue >= this._session.dayConfig.businessGoal) {
        this.handleDayWon();
      } else {
        this.transitionTo('PLAYING');
      }
    }
  }

  private handleDayWon(): void {
    const session = this._session!;
    const record: DayCompletionRecord = {
      dayNumber: this._selectedDay,
      clearedAt: 0,
      revenueAchieved: session.revenue,
      businessGoal: session.dayConfig.businessGoal,
      ordersCompleted: session.stats.ordersCompleted,
      maxCascadeStreak: session.stats.maxCascadeChain,
      piecesPlaced: session.stats.piecesPlaced
    };

    this._campaignState = SaveSystem.recordDayCompletion(record);
    this.transitionTo('DAY_CLEAR');
    this._events.onDayCompleted?.(record);
  }

  private handleDayFailed(reason: string): void {
    this.transitionTo('DAY_FAILED');
    this._events.onDayFailed?.(reason);
  }

  pauseGame(): void {
    if (this._phase === 'PLAYING' || this._phase === 'RESOLVING') {
      this.transitionTo('PAUSED');
    }
  }

  resumeGame(): void {
    if (this._phase === 'PAUSED') {
      this.transitionTo('PLAYING');
    }
  }

  restartCurrentDay(): GameSession {
    return this.startDay(this._selectedDay);
  }

  advanceToNextDay(): GameSession | null {
    if (this._selectedDay < 12) {
      return this.startDay(this._selectedDay + 1);
    }
    return null;
  }
}
