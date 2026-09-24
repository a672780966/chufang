import { CampaignState, DayCompletionRecord, PlayerSettings, StoragePort } from '../model/Types';

export class MemoryStoragePort implements StoragePort {
  private _store = new Map<string, string>();

  getItem(key: string): string | null {
    return this._store.has(key) ? this._store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  clear(): void {
    this._store.clear();
  }
}

export const DEFAULT_CAMPAIGN_STATE: CampaignState = {
  highestUnlockedDay: 1,
  completedDays: {},
  bestRevenueByDay: {},
  bestCascadeByDay: {},
  tutorialFlags: {},
  settings: {
    soundEnabled: true,
    musicEnabled: true,
    hapticsEnabled: true,
    sfxEnabled: true,
    vibrationEnabled: true,
    debugOverlayEnabled: false
  }
};

export class SaveSystem {
  private static _storageKey = 'chufang_campaign_save_v1';
  private static _storage: StoragePort = new MemoryStoragePort();

  /**
   * Injects the active storage port (e.g. WebStorageAdapter or CocosStorageAdapter).
   */
  static setStorage(storage: StoragePort): void {
    this._storage = storage;
  }

  static getStorage(): StoragePort {
    return this._storage;
  }

  /**
   * Loads campaign state, returning defaults if no save exists or corrupted.
   */
  static loadCampaignState(): CampaignState {
    try {
      const raw = this._storage.getItem(this._storageKey);
      if (!raw) {
        return JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_STATE));
      }
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CAMPAIGN_STATE,
        ...parsed,
        bestRevenueByDay: parsed.bestRevenueByDay || {},
        bestCascadeByDay: parsed.bestCascadeByDay || {},
        completedDays: parsed.completedDays || {},
        tutorialFlags: parsed.tutorialFlags || {},
        settings: {
          ...DEFAULT_CAMPAIGN_STATE.settings,
          ...(parsed.settings || {})
        }
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_STATE));
    }
  }

  /**
   * Persists campaign state.
   */
  static saveCampaignState(state: CampaignState): void {
    try {
      this._storage.setItem(this._storageKey, JSON.stringify(state));
    } catch {
      // In-memory or storage full fallback
    }
  }

  /**
   * Resets save state to pristine initial state.
   */
  static resetCampaignState(): CampaignState {
    this._storage.removeItem(this._storageKey);
    const state = JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_STATE));
    this.saveCampaignState(state);
    return state;
  }

  /**
   * Records completion of a day, updating unlocks, revenues, and cascades.
   */
  static recordDayCompletion(record: DayCompletionRecord): CampaignState {
    const state = this.loadCampaignState();

    state.completedDays[record.dayNumber] = record;

    // Advance highest unlocked day up to 12
    const nextDay = Math.min(12, record.dayNumber + 1);
    if (nextDay > state.highestUnlockedDay) {
      state.highestUnlockedDay = nextDay;
    }

    // Best revenue
    const currentBestRev = state.bestRevenueByDay[record.dayNumber] || 0;
    if (record.revenueAchieved > currentBestRev) {
      state.bestRevenueByDay[record.dayNumber] = record.revenueAchieved;
    }

    // Best cascade
    const currentBestCascade = state.bestCascadeByDay[record.dayNumber] || 0;
    if (record.maxCascadeStreak > currentBestCascade) {
      state.bestCascadeByDay[record.dayNumber] = record.maxCascadeStreak;
    }

    this.saveCampaignState(state);
    return state;
  }

  /**
   * Sets a tutorial flag.
   */
  static setTutorialFlag(flag: string): void {
    const state = this.loadCampaignState();
    state.tutorialFlags[flag] = true;
    this.saveCampaignState(state);
  }

  /**
   * Updates player audio and presentation settings.
   */
  static updateSettings(settings: Partial<PlayerSettings>): CampaignState {
    const state = this.loadCampaignState();
    state.settings = { ...state.settings, ...settings };
    this.saveCampaignState(state);
    return state;
  }
}
