import { SupabaseClient } from '@supabase/supabase-js';
import { CalendarRepository, OutfitPlan, PlanStatus, Occasion } from '../types';
import { getSupabaseClient } from '../lib/supabase';

export class SupabaseCalendarRepository implements CalendarRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseClient();
  }

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error || !user) throw new Error('User is not authenticated');
    return user.id;
  }

  async getPlans(): Promise<OutfitPlan[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('calendar_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('date', { ascending: true });

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToPlan(r));
  }

  async getPlanByDate(date: string): Promise<OutfitPlan | null> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('calendar_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_deleted) return null;
    return this.mapRowToPlan(data);
  }

  async getAllPlansRaw(): Promise<OutfitPlan[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('calendar_plans')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((r: any) => this.mapRowToPlan(r));
  }

  async upsertPlanRaw(plan: OutfitPlan): Promise<void> {
    const userId = plan.userId || (await this.getUserId());
    const { error } = await this.client.from('calendar_plans').upsert(
      {
        id: plan.id,
        user_id: userId,
        date: plan.date,
        outfit: plan.outfit,
        accessory: plan.accessory || null,
        occasion: plan.occasion,
        status: plan.status,
        is_deleted: plan.isDeleted || false,
        deleted_at: plan.deletedAt ? new Date(plan.deletedAt).toISOString() : null,
        client_updated_at: plan.clientUpdatedAt
          ? new Date(plan.clientUpdatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: 'user_id, date' }
    );

    if (error) throw error;
  }

  async savePlan(plan: OutfitPlan): Promise<void> {
    await this.upsertPlanRaw(plan);
  }

  async deletePlan(id: string): Promise<void> {
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('calendar_plans')
      .update({
        is_deleted: true,
        deleted_at: now,
        client_updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  }

  async updatePlanStatus(id: string, status: PlanStatus): Promise<void> {
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('calendar_plans')
      .update({
        status,
        client_updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await this.getUserId();
    await this.client.from('calendar_plans').delete().eq('user_id', userId);
  }

  private mapRowToPlan(r: any): OutfitPlan {
    return {
      id: r.id,
      userId: r.user_id,
      date: r.date,
      outfit: r.outfit,
      accessory: r.accessory || null,
      occasion: r.occasion as Occasion,
      status: r.status as PlanStatus,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.server_updated_at ? new Date(r.server_updated_at).getTime() : Date.now(),
      isDeleted: r.is_deleted,
      deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
      clientUpdatedAt: r.client_updated_at ? new Date(r.client_updated_at).getTime() : undefined,
      serverUpdatedAt: r.server_updated_at,
    };
  }
}
