import { WardrobeItem, GeneratedOutfit, SavedOutfit } from '../types';

export interface WardrobeRepository {
  getItems(): Promise<WardrobeItem[]>;
  getItem(id: string): Promise<WardrobeItem | null>;
  getAllItemsRaw?(): Promise<WardrobeItem[]>;
  upsertItemRaw?(item: WardrobeItem): Promise<void>;
  addItem(item: WardrobeItem): Promise<void>;
  updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getSavedOutfits(): Promise<SavedOutfit[]>;
  getAllSavedOutfitsRaw?(): Promise<SavedOutfit[]>;
  upsertSavedOutfitRaw?(outfit: SavedOutfit): Promise<void>;
  saveOutfit(outfit: GeneratedOutfit, name?: string): Promise<SavedOutfit>;
  deleteSavedOutfit(id: string): Promise<void>;
  clear(): Promise<void>;
}
