export type CatActorState = 'IDLE' | 'CHOP' | 'STIR' | 'PASS' | 'WIN';

export type CatActorEvent =
  | 'ORDER_WAITING'
  | 'COOK_CHOP'
  | 'COOK_STIR'
  | 'ORDER_READY'
  | 'ROUND_WIN';

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameMetadata {
  filename: string;
  frame: FrameRect;
  duration: number;
}

export interface ActionMetadata {
  action: string;
  frame_width: number;
  frame_height: number;
  fps: number;
  loop: boolean;
  frame_count: number;
  frames: FrameMetadata[];
}

export interface CatActorPlayerOptions {
  renderMode?: 'spritesheet' | 'webp';
  basePath?: string;
  onStateChange?: (state: CatActorState) => void;
}

export class CatActorPlayer {
  private container: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private webpImg?: HTMLImageElement;
  private fxOverlay?: HTMLElement;

  private currentState: CatActorState | null = null;
  private targetState: CatActorState = 'IDLE';
  private isPlaying: boolean = true;
  private renderMode: 'spritesheet' | 'webp';
  private basePath: string;
  private onStateChange?: (state: CatActorState) => void;

  // Spritesheet animation data
  private sheets: Map<CatActorState, HTMLImageElement> = new Map();
  private metadata: Map<CatActorState, ActionMetadata> = new Map();
  private loaded: boolean = false;
  private currentFrameIndex: number = 0;
  private lastFrameTimestamp: number = 0;
  private frameDurationMs: number = 100; // 10 fps default
  private onCompleteCallback?: () => void;
  private animFrameId: number | null = null;

  constructor(container: HTMLElement, options: CatActorPlayerOptions = {}) {
    this.container = container;
    this.renderMode = options.renderMode || 'spritesheet';
    this.basePath = options.basePath || '/assets/actor_pack/cat';
    this.onStateChange = options.onStateChange;

    this.initDOM();
    this.preloadAssets().then(() => {
      this.loaded = true;
      this.playState(this.targetState, this.onCompleteCallback);
    });
  }

  private initDOM(): void {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'hidden';

    // Canvas for Spritesheet mode
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 672;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = this.renderMode === 'spritesheet' ? 'block' : 'none';
    this.canvas.style.objectFit = 'contain';
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.container.appendChild(this.canvas);

    // WebP image fallback
    this.webpImg = document.createElement('img');
    this.webpImg.style.width = '100%';
    this.webpImg.style.height = '100%';
    this.webpImg.style.display = this.renderMode === 'webp' ? 'block' : 'none';
    this.webpImg.style.objectFit = 'contain';
    this.container.appendChild(this.webpImg);

    // Transition FX overlay (80-120ms steam puff / flash)
    this.fxOverlay = document.createElement('div');
    this.fxOverlay.className = 'cat-actor-fx-layer';
    this.fxOverlay.style.position = 'absolute';
    this.fxOverlay.style.top = '0';
    this.fxOverlay.style.left = '0';
    this.fxOverlay.style.width = '100%';
    this.fxOverlay.style.height = '100%';
    this.fxOverlay.style.pointerEvents = 'none';
    this.fxOverlay.style.opacity = '0';
    this.fxOverlay.style.transition = 'opacity 0.08s ease-out';
    this.fxOverlay.style.background = 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)';
    this.container.appendChild(this.fxOverlay);
  }

  private async preloadAssets(): Promise<void> {
    const states: CatActorState[] = ['IDLE', 'CHOP', 'STIR', 'PASS', 'WIN'];
    const loadPromises = states.map(async (st) => {
      const lower = st.toLowerCase();
      // 1. Fetch metadata
      try {
        const res = await fetch(`${this.basePath}/metadata/cat_${lower}.json`);
        if (res.ok) {
          const meta: ActionMetadata = await res.json();
          this.metadata.set(st, meta);
        }
      } catch (err) {
        console.warn(`[CatActorPlayer] Failed to load metadata for ${st}:`, err);
      }

      // 2. Preload Spritesheet
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = `${this.basePath}/spritesheets/cat_${lower}_sheet.png`;
        img.onload = () => {
          this.sheets.set(st, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`[CatActorPlayer] Spritesheet failed for ${st}, will rely on fallback`);
          resolve();
        };
      });
    });

    await Promise.all(loadPromises);
  }

  public playState(state: CatActorState, onComplete?: () => void): void {
    this.targetState = state;
    if (onComplete) {
      this.onCompleteCallback = onComplete;
    }

    if (!this.loaded) {
      return;
    }

    if (this.currentState === state && (state === 'CHOP' || state === 'STIR' || state === 'IDLE')) {
      // Loopable state already active
      return;
    }

    const prevState = this.currentState;
    this.currentState = state;
    this.currentFrameIndex = 0;
    this.lastFrameTimestamp = performance.now();
    this.onCompleteCallback = onComplete;

    if (this.onStateChange) {
      this.onStateChange(state);
    }

    // Trigger brief 80ms transition FX to prevent any seam artifact
    if (prevState !== state && this.fxOverlay) {
      this.fxOverlay.style.opacity = '0.35';
      setTimeout(() => {
        if (this.fxOverlay) this.fxOverlay.style.opacity = '0';
      }, 80);
    }

    if (this.renderMode === 'spritesheet') {
      const meta = this.metadata.get(state);
      this.frameDurationMs = meta ? 1000 / meta.fps : 100;
      this.renderCurrentFrame();
      this.startLoop();
    } else {
      // Animated WebP fallback mode
      if (this.webpImg) {
        const lower = state.toLowerCase();
        this.webpImg.src = `${this.basePath}/cat_${lower}.webp?t=${Date.now()}`;
        if (state === 'PASS' || state === 'WIN') {
          const meta = this.metadata.get(state);
          const duration = meta ? (meta.frame_count * 1000) / meta.fps : 1200;
          setTimeout(() => {
            if (this.currentState === state && this.onCompleteCallback) {
              const cb = this.onCompleteCallback;
              this.onCompleteCallback = undefined;
              cb();
            }
          }, duration);
        }
      }
    }
  }

  public onEvent(event: CatActorEvent): void {
    switch (event) {
      case 'ORDER_WAITING':
        this.playState('IDLE');
        break;
      case 'COOK_CHOP':
        this.playState('CHOP');
        break;
      case 'COOK_STIR':
        this.playState('STIR');
        break;
      case 'ORDER_READY':
        this.playState('PASS', () => {
          this.playState('IDLE');
        });
        break;
      case 'ROUND_WIN':
        this.playState('WIN', () => {
          // After victory dance finishes, return to happy idle
          this.playState('IDLE');
        });
        break;
    }
  }

  public getState(): CatActorState {
    return this.currentState || this.targetState;
  }

  public getCurrentFrame(): number {
    return this.currentFrameIndex;
  }

  private startLoop(): void {
    if (this.animFrameId !== null) return;

    const tick = (now: number) => {
      if (!this.isPlaying) {
        this.animFrameId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - this.lastFrameTimestamp;
      if (elapsed >= this.frameDurationMs) {
        this.lastFrameTimestamp = now - (elapsed % this.frameDurationMs);
        this.advanceFrame();
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private advanceFrame(): void {
    if (!this.currentState) return;
    const meta = this.metadata.get(this.currentState);
    if (!meta || meta.frames.length === 0) return;

    const nextFrame = this.currentFrameIndex + 1;
    if (nextFrame >= meta.frames.length) {
      if (meta.loop) {
        this.currentFrameIndex = 0;
      } else {
        // One-shot animation completed
        this.currentFrameIndex = meta.frames.length - 1;
        if (this.onCompleteCallback) {
          const cb = this.onCompleteCallback;
          this.onCompleteCallback = undefined;
          cb();
        }
      }
    } else {
      this.currentFrameIndex = nextFrame;
    }

    this.renderCurrentFrame();
  }

  private renderCurrentFrame(): void {
    if (!this.currentState) return;
    const meta = this.metadata.get(this.currentState);
    const sheet = this.sheets.get(this.currentState);
    if (!meta || !sheet || !meta.frames[this.currentFrameIndex]) return;

    const fInfo = meta.frames[this.currentFrameIndex].frame;
    this.ctx.drawImage(
      sheet,
      fInfo.x, fInfo.y, fInfo.w, fInfo.h,
      0, 0, this.canvas.width, this.canvas.height
    );
  }

  public pause(): void {
    this.isPlaying = false;
  }

  public resume(): void {
    this.isPlaying = true;
    this.lastFrameTimestamp = performance.now();
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.container.innerHTML = '';
  }
}
