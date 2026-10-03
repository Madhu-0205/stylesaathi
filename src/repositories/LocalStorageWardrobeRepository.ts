import { WardrobeRepository } from './WardrobeRepository';
import { WardrobeItem, GeneratedOutfit, SavedOutfit } from '../types';
import { photoStore } from '../utils/photoStore';

const STORAGE_KEY = 'stylesaathi-v1';
const SAVED_OUTFITS_KEY = 'stylesaathi-saved-outfits-v1';

export class LocalStorageWardrobeRepository implements WardrobeRepository {
  private memStorage = new Map<string, string>();

  private getItemRaw(key: string): string | null {
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

  private setItemRaw(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    this.memStorage.set(key, value);
  }

  private removeItemRaw(key: string): void {
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

  private getStorageData(): { items: WardrobeItem[]; [key: string]: any } {
    try {
      const raw = this.getItemRaw(STORAGE_KEY);
      if (!raw) return { items: [] };
      const parsed = JSON.parse(raw);
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        ...parsed,
      };
    } catch (e) {
      return { items: [] };
    }
  }

  private setStorageData(data: { items: WardrobeItem[]; [key: string]: any }): void {
    try {
      this.setItemRaw(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save wardrobe data to localStorage', e);
    }
  }

  async getItems(): Promise<WardrobeItem[]> {
    const data = this.getStorageData();
    const hydrated = await Promise.all(
      data.items.map(async (item) => {
        if (!item.photo && item.id) {
          const storedPhoto = await photoStore.getPhoto(item.id);
          if (storedPhoto) {
            return { ...item, photo: storedPhoto };
          }
        }
        return item;
      })
    );
    return hydrated;
  }

  async getItem(id: string): Promise<WardrobeItem | null> {
    const items = await this.getItems();
    return items.find((i) => i.id === id) || null;
  }

  async addItem(item: WardrobeItem): Promise<void> {
    const data = this.getStorageData();
    const savedItem = { ...item };

    if (item.photo && item.photo.startsWith('data:')) {
      await photoStore.savePhoto(item.id, item.photo);
    }

    const updated = [savedItem, ...data.items.filter((i) => i.id !== item.id)];
    this.setStorageData({ ...data, items: updated });
  }

  async updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void> {
    const data = this.getStorageData();
    if (patch.photo && patch.photo.startsWith('data:')) {
      await photoStore.savePhoto(id, patch.photo);
    }

    const updated = data.items.map((item) => {
      if (item.id === id) {
        return { ...item, ...patch };
      }
      return item;
    });

    this.setStorageData({ ...data, items: updated });
  }

  async deleteItem(id: string): Promise<void> {
    const data = this.getStorageData();
    await photoStore.deletePhoto(id);
    const updated = data.items.filter((i) => i.id !== id);
    this.setStorageData({ ...data, items: updated });
  }

  async getSavedOutfits(): Promise<SavedOutfit[]> {
    try {
      const raw = this.getItemRaw(SAVED_OUTFITS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async saveOutfit(outfit: GeneratedOutfit, name?: string): Promise<SavedOutfit> {
    const saved = await this.getSavedOutfits();
    const entry: SavedOutfit = {
      id: crypto.randomUUID ? crypto.randomUUID() : `outfit-${Date.now()}`,
      name: name || `Look ${Math.floor(outfit.score * 10) % 99 + 1}`,
      outfit,
      savedAt: Date.now(),
    };
    const updated = [entry, ...saved];
    this.setItemRaw(SAVED_OUTFITS_KEY, JSON.stringify(updated));
    return entry;
  }

  async deleteSavedOutfit(id: string): Promise<void> {
    const saved = await this.getSavedOutfits();
    const updated = saved.filter((o) => o.id !== id);
    this.setItemRaw(SAVED_OUTFITS_KEY, JSON.stringify(updated));
  }

  async clear(): Promise<void> {
    this.removeItemRaw(STORAGE_KEY);
    this.removeItemRaw(SAVED_OUTFITS_KEY);
    this.memStorage.clear();
    await photoStore.clearPhotos();
  }
}

export const wardrobeRepository = new LocalStorageWardrobeRepository();
