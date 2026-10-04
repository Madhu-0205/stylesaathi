import { SupabaseClient } from '@supabase/supabase-js';
import { PreferencesRepository, StylePreferences, StylingMode } from '../types';
import { getSupabaseClient } from '../lib/supabase';

export class SupabasePreferencesRepository implements PreferencesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseClient();
  }

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error || !user) throw new Error('User is not authenticated');
    return user.id;
  }

  async getPreferences(): Promise<StylePreferences | null> {
    const userId = await this.getUserId();
    const { data, error } = await this.client
      .from('style_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      userId: data.user_id,
      preferredContexts: data.preferred_contexts || [],
      preferredAesthetics: data.preferred_aesthetics || [],
      stylingMode: (data.styling_mode as StylingMode) || 'variety',
      updatedAt: data.server_updated_at ? new Date(data.server_updated_at).getTime() : Date.now(),
      clientUpdatedAt: data.client_updated_at ? new Date(data.client_updated_at).getTime() : Date.now(),
      serverUpdatedAt: data.server_updated_at,
    };
  }

  async savePreferences(prefs: StylePreferences): Promise<void> {
    await this.upsertPreferencesRaw(prefs);
  }

  async upsertPreferencesRaw(prefs: StylePreferences): Promise<void> {
    const userId = prefs.userId || (await this.getUserId());
    const { error } = await this.client.from('style_preferences').upsert(
      {
        user_id: userId,
        preferred_contexts: prefs.preferredContexts || [],
        preferred_aesthetics: prefs.preferredAesthetics || [],
        styling_mode: prefs.stylingMode || 'variety',
        client_updated_at: prefs.clientUpdatedAt
          ? new Date(prefs.clientUpdatedAt).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await this.getUserId();
    await this.client.from('style_preferences').delete().eq('user_id', userId);
  }
}
