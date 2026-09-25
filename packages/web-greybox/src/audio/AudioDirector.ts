/**
 * AudioDirector
 * Procedural Web Audio Synthesizer for Stage 4 Game Feel.
 * Zero external audio asset loading required!
 * Synthesizes all tactile cardboard, wooden clicks, culinary cues, receipt stamps, and register chimes.
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
   * 1. Pick Piece: Crisp tactile wooden tap
   */
  static playPiecePick(): void {
    this.playTone(520, 'sine', 0.04, 0.16);
    this.playTone(1800, 'triangle', 0.02, 0.08);
  }

  /**
   * Legacy alias for playPiecePick
   */
  static playPickPiece(): void {
    this.playPiecePick();
  }

  /**
   * 2. Piece Drop: Soft low wooden impact onto felt/board
   */
  static playPieceDrop(): void {
    this.playTone(180, 'sine', 0.06, 0.14);
    setTimeout(() => this.playTone(85, 'sine', 0.08, 0.1), 15);
  }

  /**
   * 3. Correct Snap: Crisp physical snap + warm harmonic chime
   */
  static playPieceSnap(): void {
    const ctx = this.getContext();
    if (!ctx || this._isMuted || !this._sfxEnabled) return;

    // Transient wood click
    this.playTone(1400, 'triangle', 0.035, 0.22);
    // Warm harmonic resonance chime (E6 ~ 1318.5 Hz)
    setTimeout(() => {
      this.playTone(1318.5, 'sine', 0.16, 0.15);
    }, 20);
  }

  /**
   * Legacy alias for playPieceSnap
   */
  static playSnapPiece(): void {
    this.playPieceSnap();
  }

  /**
   * 4. Wrong Drop: Non-punitive gentle wobble return
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
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.07);
      osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  /**
   * 5. Final Snap: Rich resonant octave snap for the 9th piece
   */
  static playFinalSnap(): void {
    // Low wood body
    this.playTone(280, 'sine', 0.12, 0.25);
    // Sharp click
    this.playTone(1600, 'triangle', 0.04, 0.28);
    // Harmonious octave bells
    setTimeout(() => {
      this.playTone(1046.5, 'sine', 0.28, 0.22); // C6
      this.playTone(1567.98, 'sine', 0.32, 0.18); // G6
    }, 30);
  }

  /**
   * 6. Dish Reveal: Golden orchestral culinary chord & soft steam release
   */
  static playDishReveal(): void {
    const ctx = this.getContext();
    if (!ctx || this._isMuted || !this._sfxEnabled) return;

    // Harmonic culinary chord (F5, A5, C6)
    const chord = [698.46, 880.0, 1046.5];
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.38, 0.15);
      }, idx * 30);
    });

    // Soft steam sizzle
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2400, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch {}
  }

  /**
   * 7. Dish Serve: Ceramic plate slide swoosh + ringing service bell
   */
  static playDishServe(): void {
    // Ceramic slide
    this.playTone(380, 'sine', 0.12, 0.12);
    // Service bell "Ding!"
    setTimeout(() => {
      this.playTone(1760.0, 'triangle', 0.45, 0.24); // A6
      this.playTone(3520.0, 'sine', 0.25, 0.08); // A7 harmonic
    }, 110);
  }

  /**
   * 8. Receipt Seal Stamp: Deep solid cinnabar stamp impact
   */
  static playReceiptStamp(): void {
    // Sharp seal impact
    this.playTone(900, 'triangle', 0.03, 0.26);
    // Low table thud
    this.playTone(130, 'sine', 0.14, 0.28);
  }

  /**
   * 9. Receipt Tear: Crisp paper tear rip
   */
  static playReceiptTear(): void {
    const ctx = this.getContext();
    if (!ctx || this._isMuted || !this._sfxEnabled) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  /**
   * Legacy alias for playReceiptTear
   */
  static playOrderComplete(): void {
    this.playReceiptTear();
  }

  /**
   * 10. Receipt Print: Thermal printer flutter ticking
   */
  static playReceiptPrint(): void {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playTone(2600 + i * 140, 'square', 0.02, 0.035);
      }, i * 30);
    }
  }

  /**
   * 11. Revenue Gain: Cheerful register coin/bell chime
   */
  static playRevenueGain(): void {
    this.playTone(987.77, 'sine', 0.16, 0.18); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'sine', 0.26, 0.22); // E6
    }, 60);
  }

  /**
   * 12. Prep Dish Storage & Serve
   */
  static playPrepDishStore(): void {
    this.playTone(340, 'triangle', 0.08, 0.14);
    setTimeout(() => this.playTone(220, 'sine', 0.1, 0.1), 35);
  }

  static playPrepDishServe(): void {
    this.playTone(480, 'sine', 0.1, 0.15);
    setTimeout(() => this.playTone(1318.51, 'triangle', 0.25, 0.18), 50);
  }

  /**
   * 13. Day Complete: Pastoral victory fanfare
   */
  static playDayClear(): void {
    const melody = [
      { f: 523.25, d: 0.14 }, // C5
      { f: 659.25, d: 0.14 }, // E5
      { f: 783.99, d: 0.14 }, // G5
      { f: 1046.5, d: 0.42 }  // C6
    ];
    let time = 0;
    melody.forEach(m => {
      setTimeout(() => {
        this.playTone(m.f, 'triangle', m.d, 0.25);
      }, time);
      time += m.d * 1000 + 40;
    });
  }

  /**
   * 14. Board Settling: Multi-layered subtle soft thuds
   */
  static playBoardSettling(): void {
    this.playTone(140, 'sine', 0.08, 0.1);
    setTimeout(() => this.playTone(110, 'sine', 0.08, 0.08), 50);
  }

  /**
   * Legacy support
   */
  static playIngredientComplete(ingredientId?: string): void {
    this.playTone(659.25, 'sine', 0.2, 0.15);
    setTimeout(() => this.playTone(783.99, 'sine', 0.25, 0.15), 50);
  }

  static playCascade(streak: number = 1): void {
    const baseFreq = 523.25 * Math.pow(1.15, Math.min(streak, 5));
    this.playTone(baseFreq, 'triangle', 0.15, 0.22);
    setTimeout(() => {
      this.playTone(baseFreq * 1.25, 'sine', 0.25, 0.22);
    }, 60);
  }

  static playDanger(): void {
    this.playTone(95, 'sawtooth', 0.35, 0.08);
  }

  /**
   * 15. Kitchen Groove BGM: Warm casual procedural 110 BPM rhythm
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
