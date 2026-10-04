import { WearEventsRepository, WearEvent } from '../types';

const WEAR_EVENTS_KEY = 'stylesaathi-wear-events-v1';

export class LocalStorageWearEventsRepository implements WearEventsRepository {
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

  async getEvents(): Promise<WearEvent[]> {
    const raw = this.getRaw(WEAR_EVENTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getEventsForItem(itemId: string): Promise<WearEvent[]> {
    const events = await this.getEvents();
    return events.filter((e) => e.wardrobeItemId === itemId);
  }

  async addEvent(event: WearEvent): Promise<void> {
    const events = await this.getEvents();
    // Idempotent: prevent duplicate insertion of the same event ID
    if (events.some((e) => e.id === event.id)) {
      return;
    }
    events.push(event);
    this.setRaw(WEAR_EVENTS_KEY, JSON.stringify(events));
  }

  async addEvents(newEvents: WearEvent[]): Promise<void> {
    const events = await this.getEvents();
    const existingIds = new Set(events.map((e) => e.id));
    let modified = false;

    for (const event of newEvents) {
      if (!existingIds.has(event.id)) {
        events.push(event);
        existingIds.add(event.id);
        modified = true;
      }
    }

    if (modified) {
      this.setRaw(WEAR_EVENTS_KEY, JSON.stringify(events));
    }
  }

  async clear(): Promise<void> {
    this.removeRaw(WEAR_EVENTS_KEY);
  }
}

export const wearEventsRepository = new LocalStorageWearEventsRepository();
