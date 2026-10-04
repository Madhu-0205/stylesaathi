import { SupabaseClient } from '@supabase/supabase-js';
import { WearEventsRepository, WearEvent } from '../types';
import { getSupabaseClient } from '../lib/supabase';

export class SupabaseWearEventsRepository implements WearEventsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseClient();
  }

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error || !user) throw new Error('User is not authenticated');
    return user.id;
  }

  async getEvents(): Promise<WearEvent[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('wear_events')
      .select('*')
      .eq('user_id', userId)
      .order('worn_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToWearEvent(r));
  }

  async getEventsForItem(itemId: string): Promise<WearEvent[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('wear_events')
      .select('*')
      .eq('user_id', userId)
      .eq('wardrobe_item_id', itemId)
      .order('worn_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToWearEvent(r));
  }

  async addEvent(event: WearEvent): Promise<void> {
    const userId = event.userId || (await this.getUserId());
    const { error } = await this.client.from('wear_events').upsert(
      {
        id: event.id,
        user_id: userId,
        wardrobe_item_id: event.wardrobeItemId,
        outfit_id: event.outfitId || null,
        planned_date: event.plannedDate || null,
        worn_at: typeof event.wornAt === 'number' ? new Date(event.wornAt).toISOString() : event.wornAt,
      },
      { onConflict: 'user_id, id', ignoreDuplicates: true }
    );

    if (error) throw error;
  }

  async addEvents(events: WearEvent[]): Promise<void> {
    if (events.length === 0) return;
    const userId = await this.getUserId();
    const rows = events.map((e) => ({
      id: e.id,
      user_id: e.userId || userId,
      wardrobe_item_id: e.wardrobeItemId,
      outfit_id: e.outfitId || null,
      planned_date: e.plannedDate || null,
      worn_at: typeof e.wornAt === 'number' ? new Date(e.wornAt).toISOString() : e.wornAt,
    }));

    const { error } = await this.client
      .from('wear_events')
      .upsert(rows, { onConflict: 'user_id, id', ignoreDuplicates: true });

    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await this.getUserId();
    await this.client.from('wear_events').delete().eq('user_id', userId);
  }

  private mapRowToWearEvent(r: any): WearEvent {
    return {
      id: r.id,
      userId: r.user_id,
      wardrobeItemId: r.wardrobe_item_id,
      outfitId: r.outfit_id || undefined,
      plannedDate: r.planned_date || undefined,
      wornAt: new Date(r.worn_at).getTime(),
      createdAt: new Date(r.created_at).getTime(),
    };
  }
}
