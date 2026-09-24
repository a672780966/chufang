/**
 * AudioDirector
 * Procedural Web Audio Synthesizer for Stage 3.
 * Zero external audio asset loading required!
 * Synthesizes all tactile, cooking, printer, and musical cues dynamically.
 */

export class AudioDirector {
  private static _ctx: any = null;
  private static _bgmInterval: any = null;
  private static _isMuted: boolean = false;
  private static _sfxEnabled: boolean = true;
  private static _bgmEnabled: boolean = true;

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

  /**
   * Helper to play an envelope-modulated tone.
   */
  private static playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startVol: number,
    endVol: number = 0.001,
    detune: number = 0
  ): void {
    if (this._isMuted || !this._sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (detune !== 0) osc.detune.setValueAtTime(detune, ctx.currentTime);

      gain.gain.setValueAtTime(startVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endVol, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback safety
    }
  }

  /**
   * 1. Pick Piece: Light cheerful pop
   */
  static playPickPiece(): void {
    this.playTone(420, 'sine', 0.06, 0.12, 0.001);
  }

  /**
   * 2. Correct Snap: Tactile magnetic click + soft harmonious chime
   */
  static playSnapPiece(): void {
    const ctx = this.getContext();
    if (!ctx || this._isMuted || !this._sfxEnabled) return;

    // Crisp high click
    this.playTone(1200, 'triangle', 0.04, 0.2);
    // Harmonious soft chime (E6 ~ 1318 Hz)
    setTimeout(() => {
      this.playTone(1318.5, 'sine', 0.18, 0.15);
    }, 20);
  }

  /**
   * 3. Wrong Drop: Soft rubbery wobble (no buzzer, gentle wobble return)
   */
  static playWrongDrop(): void {
    if (this._isMuted || !this._sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      // Wobble down and back up
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  /**
   * 4. Ingredient Complete: Full chord chime + offscreen kitchen sound
   */
  static playIngredientComplete(ingredientId?: string): void {
    if (this._isMuted || !this._sfxEnabled) return;

    // Triad chime (C5 - E5 - G5 - C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.35, 0.18);
      }, idx * 45);
    });

    // Kitchen cue sound
    setTimeout(() => {
      this.playCookingCue(ingredientId || 'generic');
    }, 180);
  }

  /**
   * Offscreen cooking cue sound synthesis
   */
  private static playCookingCue(type: string): void {
    if (this._isMuted || !this._sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();

      if (type === 'bread') {
        // Toaster "Ding!"
        this.playTone(2093, 'triangle', 0.6, 0.25);
      } else if (type === 'beef' || type === 'bacon') {
        // Sizzling pan (burst of noise modulated through bandpass)
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, ctx.currentTime);
        filter.Q.setValueAtTime(2.5, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'egg') {
        // Egg shell crack
        this.playTone(880, 'sawtooth', 0.04, 0.2);
        setTimeout(() => this.playTone(440, 'triangle', 0.06, 0.15), 30);
      } else {
        // Knife chop "thwack"
        this.playTone(320, 'triangle', 0.05, 0.2);
      }
    } catch {}
  }

  /**
   * 5. Board Settling: Multi-layered subtle soft thuds
   */
  static playBoardSettling(): void {
    this.playTone(140, 'sine', 0.08, 0.1);
    setTimeout(() => this.playTone(110, 'sine', 0.08, 0.08), 50);
  }

  /**
   * 6. Receipt Print: Thermal printer flutter ticking
   */
  static playReceiptPrint(): void {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playTone(2800 + i * 150, 'square', 0.02, 0.04);
      }, i * 35);
    }
  }

  /**
   * 7. Order Complete: Paper tear / rip sound
   */
  static playOrderComplete(): void {
    if (this._isMuted || !this._sfxEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();
      // Fast pitch drop representing quick tear
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  /**
   * 8. Revenue Gain: Cheerful register coin/bell chime
   */
  static playRevenueGain(): void {
    this.playTone(987.77, 'sine', 0.18, 0.16); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'sine', 0.28, 0.18); // E6
    }, 70);
  }

  /**
   * 9. Production Cascade: Accelerating pitch chime
   */
  static playCascade(streak: number = 1): void {
    const baseFreq = 523.25 * Math.pow(1.15, Math.min(streak, 5));
    this.playTone(baseFreq, 'triangle', 0.15, 0.22);
    setTimeout(() => {
      this.playTone(baseFreq * 1.25, 'sine', 0.25, 0.22);
    }, 60);
  }

  /**
   * 10. Board Danger: Ambient tense low pulse
   */
  static playDanger(): void {
    this.playTone(95, 'sawtooth', 0.35, 0.08);
  }

  /**
   * 11. Day Complete: Victory fanfare
   */
  static playDayClear(): void {
    const melody = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.5, d: 0.35 }  // C6
    ];
    let time = 0;
    melody.forEach(m => {
      setTimeout(() => {
        this.playTone(m.f, 'triangle', m.d, 0.22);
      }, time);
      time += m.d * 1000 + 40;
    });
  }

  /**
   * 12. Kitchen Groove BGM: Warm casual procedural 110 BPM rhythm
   */
  static startBgm(): void {
    if (this._bgmInterval || !this._bgmEnabled || this._isMuted) return;

    // 110 BPM -> 1 beat = 545 ms, 1/8 note = 272 ms
    const stepMs = 272;
    let step = 0;

    const bassLine = [130.81, 0, 146.83, 0, 164.81, 0, 130.81, 164.81]; // C3, D3, E3, C3

    this._bgmInterval = setInterval(() => {
      if (!this._bgmEnabled || this._isMuted) return;
      const f = bassLine[step % bassLine.length];
      if (f > 0) {
        this.playTone(f, 'triangle', 0.14, 0.04);
      }
      // Light hi-hat on every off-beat
      if (step % 2 === 1) {
        this.playTone(4500, 'square', 0.02, 0.015);
      }
      step++;
    }, stepMs);
  }

  static stopBgm(): void {
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
  }
}
