import { WardrobeRepository } from './WardrobeRepository';
import { WardrobeItem, GeneratedOutfit, SavedOutfit } from '../types';
import { deleteImage, clearImages } from '../services/imageStore';

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
    return data.items.filter((i) => !i.isDeleted);
  }

  async getItem(id: string): Promise<WardrobeItem | null> {
    const items = await this.getItems();
    return items.find((i) => i.id === id) || null;
  }

  async getAllItemsRaw(): Promise<WardrobeItem[]> {
    const data = this.getStorageData();
    return data.items;
  }

  async upsertItemRaw(item: WardrobeItem): Promise<void> {
    const data = this.getStorageData();
    const existingIndex = data.items.findIndex((i) => i.id === item.id);
    const itemToSave = { ...item };
    if (itemToSave.photo && itemToSave.photo.startsWith('data:')) {
      delete itemToSave.photo;
    }
    if (existingIndex >= 0) {
      data.items[existingIndex] = itemToSave;
    } else {
      data.items.unshift(itemToSave);
    }
    this.setStorageData(data);
  }

  async addItem(item: WardrobeItem): Promise<void> {
    const data = this.getStorageData();
    const now = Date.now();
    const itemToSave: WardrobeItem = {
      ...item,
      isDeleted: false,
      deletedAt: undefined,
      createdAt: item.createdAt || now,
      clientUpdatedAt: now,
    };
    if (itemToSave.photo && itemToSave.photo.startsWith('data:')) {
      delete itemToSave.photo;
    }

    const updated = [itemToSave, ...data.items.filter((i) => i.id !== item.id)];
    this.setStorageData({ ...data, items: updated });
  }

  async updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void> {
    const data = this.getStorageData();
    const patchToApply = { ...patch };
    if (patchToApply.photo && patchToApply.photo.startsWith('data:')) {
      delete patchToApply.photo;
    }

    const now = Date.now();
    const updated = data.items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...patchToApply,
          clientUpdatedAt: patchToApply.clientUpdatedAt || now,
        };
      }
      return item;
    });

    this.setStorageData({ ...data, items: updated });
  }

  async deleteItem(id: string): Promise<void> {
    const data = this.getStorageData();
    const itemToDelete = data.items.find((i) => i.id === id);
    if (!itemToDelete) return;

    if (itemToDelete.photoId) {
      try {
        await deleteImage(itemToDelete.photoId);
      } catch {}
    }
    try {
      await deleteImage(id);
    } catch {}

    const now = Date.now();
    // Soft tombstone: keep in storage so sync engine knows about the deletion
    const updated = data.items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          isDeleted: true,
          deletedAt: now,
          clientUpdatedAt: now,
        };
      }
      return item;
    });
    this.setStorageData({ ...data, items: updated });
  }

  async getSavedOutfits(): Promise<SavedOutfit[]> {
    try {
      const raw = this.getItemRaw(SAVED_OUTFITS_KEY);
      if (!raw) return [];
      const parsed: SavedOutfit[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((o) => !o.isDeleted) : [];
    } catch {
      return [];
    }
  }

  async getAllSavedOutfitsRaw(): Promise<SavedOutfit[]> {
    try {
      const raw = this.getItemRaw(SAVED_OUTFITS_KEY);
      if (!raw) return [];
      const parsed: SavedOutfit[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async upsertSavedOutfitRaw(outfit: SavedOutfit): Promise<void> {
    const saved = await this.getAllSavedOutfitsRaw();
    const idx = saved.findIndex((o) => o.id === outfit.id);
    if (idx >= 0) {
      saved[idx] = outfit;
    } else {
      saved.unshift(outfit);
    }
    this.setItemRaw(SAVED_OUTFITS_KEY, JSON.stringify(saved));
  }

  async saveOutfit(outfit: GeneratedOutfit, name?: string): Promise<SavedOutfit> {
    const saved = await this.getAllSavedOutfitsRaw();
    const now = Date.now();
    const entry: SavedOutfit = {
      id: crypto.randomUUID ? crypto.randomUUID() : `outfit-${now}`,
      name: name || `Look ${Math.floor(outfit.score * 10) % 99 + 1}`,
      outfit,
      savedAt: now,
      isDeleted: false,
      deletedAt: undefined,
      clientUpdatedAt: now,
    };
    const updated = [entry, ...saved.filter((o) => o.id !== entry.id)];
    this.setItemRaw(SAVED_OUTFITS_KEY, JSON.stringify(updated));
    return entry;
  }

  async deleteSavedOutfit(id: string): Promise<void> {
    const saved = await this.getAllSavedOutfitsRaw();
    const now = Date.now();
    const updated = saved.map((o) => {
      if (o.id === id) {
        return {
          ...o,
          isDeleted: true,
          deletedAt: now,
          clientUpdatedAt: now,
        };
      }
      return o;
    });
    this.setItemRaw(SAVED_OUTFITS_KEY, JSON.stringify(updated));
  }

  async clear(): Promise<void> {
    this.removeItemRaw(STORAGE_KEY);
    this.removeItemRaw(SAVED_OUTFITS_KEY);
    this.memStorage.clear();
    try {
      await clearImages();
    } catch {}
  }
}

export const wardrobeRepository = new LocalStorageWardrobeRepository();
