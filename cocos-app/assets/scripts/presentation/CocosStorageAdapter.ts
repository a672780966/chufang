import { sys } from 'cc';
import { StoragePort } from '../game-core/index';

export class CocosStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    try {
      return sys.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      sys.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[CocosStorageAdapter] Failed to set localStorage item:', e);
    }
  }

  removeItem(key: string): void {
    try {
      sys.localStorage.removeItem(key);
    } catch (e) {
      console.warn('[CocosStorageAdapter] Failed to remove localStorage item:', e);
    }
  }
}
