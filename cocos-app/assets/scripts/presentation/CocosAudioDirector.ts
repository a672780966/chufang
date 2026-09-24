/**
 * CocosAudioDirector
 * Procedural Audio Synthesizer for Cocos Creator 3.8.8.
 * Plays crisp tactile snaps, pops, chimes, printer ticks, and cooking cues.
 */

export class CocosAudioDirector {
  private static _ctx: any = null;
  private static _isMuted: boolean = false;
  private static _sfxEnabled: boolean = true;
  private static _bgmEnabled: boolean = true;
  private static _bgmInterval: any = null;

  private static getContext(): any {
    if (this._ctx) return this._ctx;
    const AudioCtx = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        this._ctx = new AudioCtx();
      } catch {
        this._ctx = null;
      }
    }
    return this._ctx;
  }

  static setMuted(muted: boolean): void {
    this._isMuted = muted;
  }

  static setSfxEnabled(enabled: boolean): void {
    this._sfxEnabled = enabled;
  }

  static setBgmEnabled(enabled: boolean): void {
    this._bgmEnabled = enabled;
    if (!enabled) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
  }

  private static playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startVol: number,
    endVol: number = 0.001
  ): void {
    if (this._isMuted || !this._sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(startVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endVol, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  static playPickPiece(): void {
    this.playTone(420, 'sine', 0.06, 0.12);
  }

  static playSnapPiece(): void {
    this.playTone(1200, 'triangle', 0.04, 0.2);
    setTimeout(() => {
      this.playTone(1318.5, 'sine', 0.18, 0.15);
    }, 20);
  }

  static playWrongDrop(): void {
    this.playTone(260, 'sine', 0.12, 0.2);
  }

  static playIngredientComplete(ingredientId?: string): void {
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C Major
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.22, 0.15);
      }, idx * 45);
    });
  }

  static playOrderComplete(): void {
    const melody = [587.33, 739.99, 880.0, 1174.66]; // D Major fanfare
    melody.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.24, 0.2);
      }, idx * 60);
    });
  }

  static playCascade(chainLength: number): void {
    const baseFreq = 440 * Math.pow(1.15, Math.min(6, chainLength));
    this.playTone(baseFreq, 'sawtooth', 0.15, 0.25);
  }

  static playBoardSettling(): void {
    this.playTone(140, 'sine', 0.08, 0.15);
  }

  static playDanger(): void {
    this.playTone(220, 'square', 0.18, 0.2);
  }

  static playDayClear(): void {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    fanfare.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.3, 0.25);
      }, idx * 75);
    });
  }

  static playReceiptPrint(): void {
    this.playTone(1800, 'square', 0.03, 0.05);
  }

  static startBgm(): void {
    if (this._bgmInterval || !this._bgmEnabled) return;
    const chords = [
      [261.63, 329.63, 392.0], // C
      [220.0, 261.63, 329.63],  // Am
      [174.61, 220.0, 261.63],  // F
      [196.0, 246.94, 293.66]   // G
    ];
    let step = 0;
    this._bgmInterval = setInterval(() => {
      if (this._isMuted || !this._bgmEnabled) return;
      const curChord = chords[step % chords.length];
      curChord.forEach(f => this.playTone(f * 0.5, 'sine', 1.8, 0.02, 0.0001));
      step++;
    }, 2200);
  }

  static stopBgm(): void {
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
  }
}
