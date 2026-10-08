import { StyleSignalsRepository, StyleSignalEvent } from '../types';

const STYLE_SIGNALS_KEY = 'stylesaathi-style-signals-v1';

export class LocalStorageStyleSignalsRepository implements StyleSignalsRepository {
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

  async getSignals(): Promise<StyleSignalEvent[]> {
    const raw = this.getRaw(STYLE_SIGNALS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getSignalsForItem(itemId: string): Promise<StyleSignalEvent[]> {
    const signals = await this.getSignals();
    return signals.filter((s) => s.itemIds.includes(itemId));
  }

  async addSignal(signal: StyleSignalEvent): Promise<void> {
    const signals = await this.getSignals();
    // Idempotent: prevent duplicate insertion of the same event ID
    if (signals.some((s) => s.id === signal.id)) {
      return;
    }
    signals.push(signal);
    this.setRaw(STYLE_SIGNALS_KEY, JSON.stringify(signals));
  }

  async addSignals(newSignals: StyleSignalEvent[]): Promise<void> {
    const signals = await this.getSignals();
    const existingIds = new Set(signals.map((s) => s.id));
    let modified = false;

    for (const signal of newSignals) {
      if (!existingIds.has(signal.id)) {
        signals.push(signal);
        existingIds.add(signal.id);
        modified = true;
      }
    }

    if (modified) {
      this.setRaw(STYLE_SIGNALS_KEY, JSON.stringify(signals));
    }
  }

  async clear(): Promise<void> {
    this.removeRaw(STYLE_SIGNALS_KEY);
  }
}

export const styleSignalsRepository = new LocalStorageStyleSignalsRepository();
