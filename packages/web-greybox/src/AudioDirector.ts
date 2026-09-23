/**
 * Procedural AudioDirector using Web Audio API.
 * Synthesizes crisp, responsive game audio with zero external file dependencies.
 */
export class AudioDirector {
  private _ctx: AudioContext | null = null;
  private _muted: boolean = false;

  private getContext(): AudioContext {
    if (!this._ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this._ctx = new AudioCtx();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  playPieceSnap(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  }

  playPieceBounce(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }

  playIngredientComplete(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (_) {}
  }

  playReceiptPrint(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const node = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < buffer.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (i % 20 < 10 ? 0.4 : -0.4);
      }
      node.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      node.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      node.start();
    } catch (_) {}
  }

  playReceiptTear(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const node = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < buffer.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.6;
      }
      node.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2400;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      node.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      node.start();
    } catch (_) {}
  }

  playCascadeDing(chainIndex: number): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const baseFreq = 587.33 * Math.pow(1.15, chainIndex - 1); // D5 * pitch up per chain

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  }

  playDayClear(): void {
    if (this._muted) return;
    try {
      const ctx = this.getContext();
      const chords = [
        [523.25, 659.25, 783.99], // C major
        [587.33, 739.99, 880.00], // D major
        [659.25, 830.61, 987.77], // E major
        [1046.5, 1318.5, 1567.98] // C6 major
      ];

      chords.forEach((chord, step) => {
        const t = ctx.currentTime + step * 0.14;
        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.3);
        });
      });
    } catch (_) {}
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }
}
