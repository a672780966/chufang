export type PrinterActorState = 'IDLE' | 'PRINTING' | 'ORDER_OUT';

export interface PrinterActorPlayerOptions {
  basePath?: string;
  onStateChange?: (state: PrinterActorState) => void;
}

export class PrinterActorPlayer {
  private container: HTMLElement;
  private imgElement!: HTMLImageElement;
  private currentState: PrinterActorState = 'IDLE';
  private basePath: string;
  private onStateChange?: (state: PrinterActorState) => void;
  private printTimer: number | null = null;

  constructor(container: HTMLElement, options: PrinterActorPlayerOptions = {}) {
    this.container = container;
    this.basePath = options.basePath || '/assets/actor_pack/printer';
    this.onStateChange = options.onStateChange;

    this.initDOM();
    this.playState('IDLE');
  }

  private initDOM(): void {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';

    this.imgElement = document.createElement('img');
    this.imgElement.style.width = '100%';
    this.imgElement.style.height = '100%';
    this.imgElement.style.objectFit = 'contain';
    this.imgElement.alt = 'Thermal Ticket Printer';
    this.container.appendChild(this.imgElement);
  }

  public playState(state: PrinterActorState, onComplete?: () => void): void {
    this.currentState = state;
    if (this.onStateChange) {
      this.onStateChange(state);
    }

    if (state === 'IDLE' || state === 'ORDER_OUT') {
      this.imgElement.src = `${this.basePath}/printer_idle.webp`;
      if (onComplete) onComplete();
    } else if (state === 'PRINTING') {
      this.imgElement.src = `${this.basePath}/printer_print.webp?t=${Date.now()}`;
      if (this.printTimer !== null) {
        clearTimeout(this.printTimer);
      }
      this.printTimer = window.setTimeout(() => {
        this.printTimer = null;
        this.playState('ORDER_OUT', onComplete);
      }, 1200);
    }
  }

  public printNewOrder(onComplete?: () => void): void {
    this.playState('PRINTING', onComplete);
  }

  public getState(): PrinterActorState {
    return this.currentState;
  }

  public destroy(): void {
    if (this.printTimer !== null) {
      clearTimeout(this.printTimer);
      this.printTimer = null;
    }
    this.container.innerHTML = '';
  }
}
