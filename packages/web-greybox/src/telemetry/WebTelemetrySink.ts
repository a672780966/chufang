import { TelemetryEvent } from '../../../game-core/src/index';

export class WebTelemetrySink {
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
  }

  static getEvents(): TelemetryEvent[] {
    return [...this._events];
  }

  static exportJson(): string {
    return JSON.stringify(this._events, null, 2);
  }

  static downloadJson(): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(this.exportJson());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `chufang_telemetry_human_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  static clear(): void {
    this._events = [];
  }
}
