import { StoragePort } from '../../../game-core/src/index';

export class WebStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[WebStorageAdapter] Failed to set localStorage item:', e);
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('[WebStorageAdapter] Failed to remove localStorage item:', e);
    }
  }
}
