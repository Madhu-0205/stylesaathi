import { PreferencesRepository, StylePreferences } from '../types';

const PREFERENCES_KEY = 'stylesaathi-preferences-v1';

export const DEFAULT_STYLE_PREFERENCES: StylePreferences = {
  preferredContexts: ['Everyday', 'Work'],
  preferredAesthetics: ['Contemporary', 'Indo-Western'],
  stylingMode: 'variety',
  updatedAt: Date.now(),
};

export class LocalStoragePreferencesRepository implements PreferencesRepository {
  private memStorage = new Map<string, string>();

  private getRaw(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return this.memStorage.get(key) || null;
  }

  private setRaw(key: string, val: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch {}
    this.memStorage.set(key, val);
  }

  private removeRaw(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    this.memStorage.delete(key);
  }

  async getPreferences(): Promise<StylePreferences | null> {
    const raw = this.getRaw(PREFERENCES_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async savePreferences(prefs: StylePreferences): Promise<void> {
    this.setRaw(PREFERENCES_KEY, JSON.stringify(prefs));
  }

  async clear(): Promise<void> {
    this.removeRaw(PREFERENCES_KEY);
  }
}

export const preferencesRepository = new LocalStoragePreferencesRepository();
