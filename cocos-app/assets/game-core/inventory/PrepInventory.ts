export class PrepInventory {
  private _totalCounts: Map<string, number> = new Map();
  private _reservedCounts: Map<string, number> = new Map();

  add(ingredientId: string, amount: number = 1): number {
    const current = this._totalCounts.get(ingredientId) || 0;
    const next = current + amount;
    this._totalCounts.set(ingredientId, next);
    return this.getAvailable(ingredientId);
  }

  getTotal(ingredientId: string): number {
    return this._totalCounts.get(ingredientId) || 0;
  }

  getReserved(ingredientId: string): number {
    return this._reservedCounts.get(ingredientId) || 0;
  }

  getAvailable(ingredientId: string): number {
    const total = this.getTotal(ingredientId);
    const reserved = this.getReserved(ingredientId);
    return Math.max(0, total - reserved);
  }

  getAllAvailable(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const [id] of this._totalCounts.entries()) {
      const avail = this.getAvailable(id);
      if (avail > 0) res[id] = avail;
    }
    return res;
  }

  reserve(ingredientId: string, amount: number): boolean {
    const available = this.getAvailable(ingredientId);
    if (available < amount) return false;
    const currentReserved = this.getReserved(ingredientId);
    this._reservedCounts.set(ingredientId, currentReserved + amount);
    return true;
  }

  consumeReserved(ingredientId: string, amount: number): void {
    const currentTotal = this.getTotal(ingredientId);
    const currentReserved = this.getReserved(ingredientId);
    this._totalCounts.set(ingredientId, Math.max(0, currentTotal - amount));
    this._reservedCounts.set(ingredientId, Math.max(0, currentReserved - amount));
  }

  unreserve(ingredientId: string, amount: number): void {
    const currentReserved = this.getReserved(ingredientId);
    this._reservedCounts.set(ingredientId, Math.max(0, currentReserved - amount));
  }

  clear(): void {
    this._totalCounts.clear();
    this._reservedCounts.clear();
  }
}
