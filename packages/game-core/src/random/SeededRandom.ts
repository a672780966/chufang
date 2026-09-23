/**
 * Deterministic Pseudo-Random Number Generator using Mulberry32.
 * Supports string or integer seeds, saving/restoring state, shuffling, and weighted choices.
 */
export class SeededRandom {
  private _state: number;

  constructor(seed: string | number = 12345) {
    this._state = typeof seed === 'number' ? seed >>> 0 : SeededRandom.hashString(seed);
  }

  private static hashString(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }

  /**
   * Generates a float in [0, 1)
   */
  next(): number {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates an integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    if (min >= max) return min;
    const f = this.next();
    return Math.floor(f * (max - min + 1)) + min;
  }

  /**
   * Shuffles an array in place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Selects an item using weighted probability
   */
  weightedPick<T>(candidates: { item: T; weight: number }[]): T | null {
    if (candidates.length === 0) return null;
    let totalWeight = 0;
    for (const c of candidates) {
      if (c.weight > 0) totalWeight += c.weight;
    }
    if (totalWeight <= 0) {
      return candidates[this.nextInt(0, candidates.length - 1)].item;
    }
    let roll = this.next() * totalWeight;
    for (const c of candidates) {
      if (c.weight <= 0) continue;
      if (roll <= c.weight) return c.item;
      roll -= c.weight;
    }
    return candidates[candidates.length - 1].item;
  }

  getState(): number {
    return this._state;
  }

  setState(state: number): void {
    this._state = state >>> 0;
  }

  clone(): SeededRandom {
    const r = new SeededRandom(0);
    r.setState(this._state);
    return r;
  }
}
