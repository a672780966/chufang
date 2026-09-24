import { CampaignState, DayCompletionRecord, PlayerSettings } from '../model/Types';

export const DEFAULT_CAMPAIGN_STATE: CampaignState = {
  highestUnlockedDay: 1,
  completedDays: {},
  bestRevenueByDay: {},
  bestCascadeByDay: {},
  tutorialFlags: {},
  settings: {
    musicEnabled: true,
    sfxEnabled: true,
    vibrationEnabled: true,
    debugOverlayEnabled: false
  }
};

export class SaveSystem {
  private static _storageKey = 'chufang_campaign_save_v1';
  private static _memoryStore: string | null = null;

  /**
   * Retrieves the current storage provider (localStorage in browser/Cocos, or memory in Node).
   */
  private static getStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
    // 1. Browser window.localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    // 2. Cocos Creator sys.localStorage
    if (typeof (globalThis as any).cc !== 'undefined' && (globalThis as any).cc.sys?.localStorage) {
      return (globalThis as any).cc.sys.localStorage;
    }
    // 3. Fallback memory storage
    return {
      getItem: (k: string) => (k === this._storageKey ? this._memoryStore : null),
      setItem: (k: string, v: string) => {
        if (k === this._storageKey) this._memoryStore = v;
      },
      removeItem: (k: string) => {
        if (k === this._storageKey) this._memoryStore = null;
      }
    };
  }

  /**
   * Loads campaign state, returning defaults if no save exists or corrupt.
   */
  static loadCampaignState(): CampaignState {
    try {
      const storage = this.getStorage();
      const raw = storage.getItem(this._storageKey);
      if (!raw) {
        return JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_STATE));
      }
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CAMPAIGN_STATE,
        ...parsed,
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
      const storage = this.getStorage();
      storage.setItem(this._storageKey, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save campaign state to storage:', err);
    }
  }

  /**
   * Resets save state to pristine initial state (Debug / User reset).
   */
  static resetCampaignState(): CampaignState {
    const storage = this.getStorage();
    storage.removeItem(this._storageKey);
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
