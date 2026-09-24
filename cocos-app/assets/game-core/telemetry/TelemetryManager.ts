export interface TelemetryEvent {
  eventType:
    | 'day_start'
    | 'day_clear'
    | 'day_fail'
    | 'piece_drag'
    | 'piece_placed'
    | 'wrong_drop'
    | 'ingredient_complete'
    | 'target_switch'
    | 'order_complete'
    | 'cascade'
    | 'danger_enter'
    | 'danger_recovery'
    | 'session_quit';
  timestamp: number;
  dayNumber: number;
  payload?: Record<string, any>;
}

export interface DaySessionSummary {
  dayNumber: number;
  durationMs: number;
  piecesPlaced: number;
  wrongDrops: number;
  targetSwitches: number;
  ingredientsCompleted: number;
  ordersCompleted: number;
  cascades: number;
  dangerEvents: number;
  dangerRecoveries: number;
  finalRevenue: number;
  businessGoal: number;
  isCleared: boolean;
}

export class TelemetryManager {
  private static _events: TelemetryEvent[] = [];
  private static _dayStartTimes = new Map<number, number>();

  static log(
    eventType: TelemetryEvent['eventType'],
    dayNumber: number,
    payload?: Record<string, any>
  ): void {
    const timestamp = Date.now();
    const event: TelemetryEvent = { eventType, timestamp, dayNumber, payload };
    this._events.push(event);

    if (eventType === 'day_start') {
      this._dayStartTimes.set(dayNumber, timestamp);
    }
  }

  static getEvents(): TelemetryEvent[] {
    return [...this._events];
  }

  static clear(): void {
    this._events = [];
    this._dayStartTimes.clear();
  }

  static exportJson(): string {
    return JSON.stringify(this._events, null, 2);
  }

  /**
   * Aggregates events for a specific day into a structured summary.
   */
  static summarizeDay(dayNumber: number, businessGoal: number): DaySessionSummary {
    const dayEvents = this._events.filter(e => e.dayNumber === dayNumber);
    const startEvent = dayEvents.find(e => e.eventType === 'day_start');
    const endEvent = dayEvents.slice().reverse().find(e => e.eventType === 'day_clear' || e.eventType === 'day_fail');

    const durationMs =
      startEvent && endEvent ? endEvent.timestamp - startEvent.timestamp : 0;

    let piecesPlaced = 0;
    let wrongDrops = 0;
    let targetSwitches = 0;
    let ingredientsCompleted = 0;
    let ordersCompleted = 0;
    let cascades = 0;
    let dangerEvents = 0;
    let dangerRecoveries = 0;
    let finalRevenue = 0;
    let isCleared = false;

    let lastTargetId: string | null = null;

    for (const e of dayEvents) {
      switch (e.eventType) {
        case 'piece_placed':
          piecesPlaced++;
          if (e.payload?.targetInstanceId) {
            if (lastTargetId && lastTargetId !== e.payload.targetInstanceId) {
              targetSwitches++;
            }
            lastTargetId = e.payload.targetInstanceId;
          }
          break;
        case 'wrong_drop':
          wrongDrops++;
          break;
        case 'ingredient_complete':
          ingredientsCompleted++;
          break;
        case 'order_complete':
          ordersCompleted++;
          if (e.payload?.revenue) {
            finalRevenue = e.payload.revenue;
          }
          break;
        case 'cascade':
          cascades++;
          break;
        case 'danger_enter':
          dangerEvents++;
          break;
        case 'danger_recovery':
          dangerRecoveries++;
          break;
        case 'day_clear':
          isCleared = true;
          if (e.payload?.revenue) finalRevenue = e.payload.revenue;
          break;
      }
    }

    return {
      dayNumber,
      durationMs,
      piecesPlaced,
      wrongDrops,
      targetSwitches,
      ingredientsCompleted,
      ordersCompleted,
      cascades,
      dangerEvents,
      dangerRecoveries,
      finalRevenue,
      businessGoal,
      isCleared
    };
  }
}
