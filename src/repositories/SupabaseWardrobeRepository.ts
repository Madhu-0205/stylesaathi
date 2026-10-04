import { SupabaseClient } from '@supabase/supabase-js';
import { WardrobeRepository } from './WardrobeRepository';
import { WardrobeItem, GeneratedOutfit, SavedOutfit, Category, Subcategory, Status, Season, Occasion } from '../types';
import { getSupabaseClient } from '../lib/supabase';

export class SupabaseWardrobeRepository implements WardrobeRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseClient();
  }

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error || !user) throw new Error('User is not authenticated');
    return user.id;
  }

  async getItems(): Promise<WardrobeItem[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => this.mapRowToItem(r));
  }

  async getItem(id: string): Promise<WardrobeItem | null> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_deleted) return null;

    return this.mapRowToItem(data);
  }

  async getAllItemsRaw(): Promise<WardrobeItem[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToItem(r));
  }

  async upsertItemRaw(item: WardrobeItem): Promise<void> {
    const userId = item.userId || (await this.getUserId());
    const { error } = await this.client.from('wardrobe_items').upsert(
      {
        id: item.id,
        user_id: userId,
        name: item.name,
        active_image_version_id: item.activeImageVersionId || item.photoId || null,
        storage_path: item.storagePath || null,
        photo_id: item.photoId || null,
        photo_url: item.photoUrl || null,
        category: item.category,
        subcategory: item.subcategory,
        colors: item.colors || [],
        seasons: item.seasons || [],
        occasions: item.occasions || [],
        formality: item.formality || 3,
        brand: item.brand || null,
        status: item.status || 'clean',
        favorite: item.favorite || false,
        note: item.note || '',
        times_worn: item.timesWorn || 0,
        last_worn: item.lastWorn ? new Date(item.lastWorn).toISOString() : null,
        is_deleted: item.isDeleted || false,
        deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
        client_updated_at: item.clientUpdatedAt
          ? new Date(item.clientUpdatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: 'user_id, id' }
    );

    if (error) throw error;
  }

  async addItem(item: WardrobeItem): Promise<void> {
    await this.upsertItemRaw(item);
  }

  async updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void> {
    const userId = await this.getUserId();
    const updateData: any = {
      client_updated_at: patch.clientUpdatedAt
        ? new Date(patch.clientUpdatedAt).toISOString()
        : new Date().toISOString(),
    };

    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.activeImageVersionId !== undefined) updateData.active_image_version_id = patch.activeImageVersionId;
    if (patch.storagePath !== undefined) updateData.storage_path = patch.storagePath;
    if (patch.photoId !== undefined) updateData.photo_id = patch.photoId;
    if (patch.photoUrl !== undefined) updateData.photo_url = patch.photoUrl;
    if (patch.category !== undefined) updateData.category = patch.category;
    if (patch.subcategory !== undefined) updateData.subcategory = patch.subcategory;
    if (patch.colors !== undefined) updateData.colors = patch.colors;
    if (patch.seasons !== undefined) updateData.seasons = patch.seasons;
    if (patch.occasions !== undefined) updateData.occasions = patch.occasions;
    if (patch.formality !== undefined) updateData.formality = patch.formality;
    if (patch.brand !== undefined) updateData.brand = patch.brand;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.favorite !== undefined) updateData.favorite = patch.favorite;
    if (patch.note !== undefined) updateData.note = patch.note;
    if (patch.timesWorn !== undefined) updateData.times_worn = patch.timesWorn;
    if (patch.lastWorn !== undefined) {
      updateData.last_worn = patch.lastWorn ? new Date(patch.lastWorn).toISOString() : null;
    }
    if (patch.isDeleted !== undefined) updateData.is_deleted = patch.isDeleted;
    if (patch.deletedAt !== undefined) {
      updateData.deleted_at = patch.deletedAt ? new Date(patch.deletedAt).toISOString() : null;
    }

    const { error } = await this.client
      .from('wardrobe_items')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteItem(id: string): Promise<void> {
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('wardrobe_items')
      .update({
        is_deleted: true,
        deleted_at: now,
        client_updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  }

  async getSavedOutfits(): Promise<SavedOutfit[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('saved_outfits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('saved_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => this.mapRowToSavedOutfit(r));
  }

  async getAllSavedOutfitsRaw(): Promise<SavedOutfit[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('saved_outfits')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToSavedOutfit(r));
  }

  async upsertSavedOutfitRaw(outfit: SavedOutfit): Promise<void> {
    const userId = outfit.userId || (await this.getUserId());
    const { error } = await this.client.from('saved_outfits').upsert(
      {
        id: outfit.id,
        user_id: userId,
        name: outfit.name || null,
        outfit: outfit.outfit,
        saved_at: outfit.savedAt,
        is_deleted: outfit.isDeleted || false,
        deleted_at: outfit.deletedAt ? new Date(outfit.deletedAt).toISOString() : null,
        client_updated_at: outfit.clientUpdatedAt
          ? new Date(outfit.clientUpdatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: 'user_id, id' }
    );

    if (error) throw error;
  }

  async saveOutfit(outfit: GeneratedOutfit, name?: string): Promise<SavedOutfit> {
    const userId = await this.getUserId();
    const saved: SavedOutfit = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `outfit-${Date.now()}`,
      userId,
      name: name || `Outfit ${new Date().toLocaleDateString('en-IN')}`,
      outfit,
      savedAt: Date.now(),
      isDeleted: false,
      clientUpdatedAt: Date.now(),
    };

    await this.upsertSavedOutfitRaw(saved);
    return saved;
  }

  async deleteSavedOutfit(id: string): Promise<void> {
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('saved_outfits')
      .update({
        is_deleted: true,
        deleted_at: now,
        client_updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await this.getUserId();
    await this.client.from('wardrobe_items').delete().eq('user_id', userId);
    await this.client.from('saved_outfits').delete().eq('user_id', userId);
  }

  private mapRowToItem(r: any): WardrobeItem {
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      activeImageVersionId: r.active_image_version_id,
      storagePath: r.storage_path,
      photoId: r.photo_id,
      photoUrl: r.photo_url,
      category: r.category as Category,
      subcategory: r.subcategory as Subcategory,
      colors: r.colors || [],
      seasons: (r.seasons || []) as Season[],
      occasions: (r.occasions || []) as Occasion[],
      formality: r.formality,
      brand: r.brand || undefined,
      status: r.status as Status,
      favorite: r.favorite,
      note: r.note || '',
      timesWorn: r.times_worn || 0,
      lastWorn: r.last_worn ? new Date(r.last_worn).getTime() : undefined,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
      isDeleted: r.is_deleted,
      deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
      clientUpdatedAt: r.client_updated_at ? new Date(r.client_updated_at).getTime() : undefined,
      serverUpdatedAt: r.server_updated_at,
    };
  }

  private mapRowToSavedOutfit(r: any): SavedOutfit {
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name || undefined,
      outfit: r.outfit,
      savedAt: r.saved_at,
      isDeleted: r.is_deleted,
      deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
      clientUpdatedAt: r.client_updated_at ? new Date(r.client_updated_at).getTime() : undefined,
      serverUpdatedAt: r.server_updated_at,
    };
  }
}
