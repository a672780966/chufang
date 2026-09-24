import { TelemetryEvent } from '../game-core/index';

export class CocosTelemetrySink {
  private static _events: TelemetryEvent[] = [];

  static log(eventType: string, dayNumber: number, payload?: Record<string, any>): void {
    const event: TelemetryEvent = {
      source: 'human',
      eventType,
      timestamp: Date.now(),
      dayNumber,
      payload
    };
    this._events.push(event);
    console.log(`[HumanTelemetry] ${eventType} (D${dayNumber})`, payload || '');
  }

  static getEvents(): TelemetryEvent[] {
    return [...this._events];
  }

  static exportJson(): string {
    return JSON.stringify(this._events, null, 2);
  }

  static clear(): void {
    this._events = [];
  }
}
