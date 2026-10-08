import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { syncQueue } from './syncQueue';
import {
  resolveWardrobeItemConflict,
  resolveCalendarPlanConflict,
  resolvePreferencesConflict,
  resolveSavedOutfitConflict,
} from './conflictResolvers';
import { wardrobeRepository } from '../../repositories/LocalStorageWardrobeRepository';
import { calendarRepository } from '../../repositories/LocalStorageCalendarRepository';
import { preferencesRepository } from '../../repositories/LocalStoragePreferencesRepository';
import { wearEventsRepository } from '../../repositories/LocalStorageWearEventsRepository';
import { styleSignalsRepository } from '../../repositories/LocalStorageStyleSignalsRepository';
import { getImage } from '../../services/imageStore';
import {
  SyncMutation,
  User,
  WardrobeItem,
  OutfitPlan,
  StylePreferences,
  SavedOutfit,
  WearEvent,
  StyleSignalEvent,
} from '../../types';

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error';

export interface MigrationState {
  status: 'NOT_STARTED' | 'PREPARING' | 'SYNCING' | 'VERIFYING' | 'COMPLETE' | 'FAILED';
  completedSteps: string[];
  lastError?: string;
  updatedAt: number;
}

type SyncStatusListener = (status: SyncStatus, error?: string | null) => void;

class SyncService {
  private status: SyncStatus = 'idle';
  private lastError: string | null = null;
  private isProcessing = false;
  private currentUser: User | null = null;
  private listeners = new Set<SyncStatusListener>();
  private lastSyncKey = 'stylesaathi-last-sync-time';
  private memoryStorage = new Map<string, string>();

  getStorageItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return this.memoryStorage.get(key) || null;
  }

  setStorageItem(key: string, val: string): void {
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
    this.memoryStorage.set(key, val);
  }

  clearMemoryStorage(): void {
    this.memoryStorage.clear();
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus('idle');
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.updateStatus('offline');
      });
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
        this.status = 'offline';
      }
    }
  }

  setCurrentUser(user: User | null) {
    this.currentUser = user;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.lastError);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(newStatus: SyncStatus, error: string | null = null) {
    this.status = newStatus;
    this.lastError = error;
    this.listeners.forEach((l) => {
      try {
        l(newStatus, error);
      } catch (e) {
        console.error('SyncService listener error:', e);
      }
    });
  }

  async recoverAndSync(): Promise<void> {
    await syncQueue.recoverFromCrash();
    await this.processQueue();
    await this.pullRemoteDeltas();
  }

  /**
   * Process all pending mutations in the queue sequentially according to dependency and retry rules.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!isSupabaseConfigured() || !this.currentUser || this.currentUser.isGuest) {
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      this.updateStatus('offline');
      return;
    }

    this.isProcessing = true;
    this.updateStatus('syncing');

    const supabase = getSupabaseClient();
    const user = this.currentUser;

    try {
      while (true) {
        const mutation = await syncQueue.peekNext();
        if (!mutation) {
          break; // Queue is empty or remaining items are waiting on retry/deps
        }

        await syncQueue.markInFlight(mutation.id);

        try {
          await this.executeRemoteMutation(supabase, user, mutation);
          await syncQueue.markSuccess(mutation.id);
        } catch (err: any) {
          console.error(`Mutation ${mutation.id} execution failed:`, err);
          const isPermanent =
            err.code === '42501' || // RLS violation
            err.code === '23503' || // Foreign key constraint violation
            err.status === 401; // Unauthorized
          await syncQueue.markFailed(mutation.id, err.message || 'Unknown error', isPermanent);
          if (!isPermanent) {
            // Transient error (network/server), stop loop until next retry window
            break;
          }
        }
      }

      const stats = await syncQueue.getStats();
      if (stats.failed > 0 || stats.deadLetter > 0) {
        this.updateStatus('error', `${stats.failed + stats.deadLetter} sync items need attention`);
      } else {
        this.updateStatus('synced');
      }
    } catch (globalErr: any) {
      this.updateStatus('error', globalErr.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single typed mutation against Supabase.
   */
  private async executeRemoteMutation(
    supabase: any,
    user: User,
    mutation: SyncMutation
  ): Promise<void> {
    switch (mutation.entityType) {
      case 'wardrobe_item': {
        if (mutation.operation === 'UPSERT') {
          const item = mutation.payload;
          const { error } = await supabase.from('wardrobe_items').upsert(
            {
              id: item.id,
              user_id: user.id,
              name: item.name,
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
              last_worn: item.lastWorn || null,
              is_deleted: item.isDeleted || false,
              deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
              client_updated_at: item.clientUpdatedAt
                ? new Date(item.clientUpdatedAt).toISOString()
                : new Date().toISOString(),
            },
            { onConflict: 'user_id, id' }
          );
          if (error) throw error;
        } else if (mutation.operation === 'DELETE') {
          const { error } = await supabase
            .from('wardrobe_items')
            .update({
              is_deleted: true,
              deleted_at: new Date(mutation.payload.deletedAt).toISOString(),
              client_updated_at: new Date(mutation.payload.deletedAt).toISOString(),
            })
            .eq('id', mutation.payload.id);
          if (error) throw error;
        }
        break;
      }

      case 'saved_outfit': {
        if (mutation.operation === 'UPSERT') {
          const outfit = mutation.payload;
          const { error } = await supabase.from('saved_outfits').upsert(
            {
              id: outfit.id,
              user_id: user.id,
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
        } else if (mutation.operation === 'DELETE') {
          const { error } = await supabase
            .from('saved_outfits')
            .update({
              is_deleted: true,
              deleted_at: new Date(mutation.payload.deletedAt).toISOString(),
              client_updated_at: new Date(mutation.payload.deletedAt).toISOString(),
            })
            .eq('id', mutation.payload.id);
          if (error) throw error;
        }
        break;
      }

      case 'calendar_plan': {
        if (mutation.operation === 'UPSERT') {
          const plan = mutation.payload;
          const { error } = await supabase.from('calendar_plans').upsert(
            {
              id: plan.id,
              user_id: user.id,
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
        } else if (mutation.operation === 'DELETE') {
          const { error } = await supabase
            .from('calendar_plans')
            .update({
              is_deleted: true,
              deleted_at: new Date(mutation.payload.deletedAt).toISOString(),
              client_updated_at: new Date(mutation.payload.deletedAt).toISOString(),
            })
            .eq('id', mutation.payload.id);
          if (error) throw error;
        }
        break;
      }

      case 'style_preferences': {
        const prefs = mutation.payload;
        const { error } = await supabase.from('style_preferences').upsert(
          {
            user_id: user.id,
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
        break;
      }

      case 'wear_event': {
        const event = mutation.payload;
        const { error } = await supabase.from('wear_events').upsert(
          {
            id: event.id,
            user_id: user.id,
            wardrobe_item_id: event.wardrobeItemId,
            outfit_id: event.outfitId || null,
            planned_date: event.plannedDate || null,
            worn_at: event.wornAt,
          },
          { onConflict: 'user_id, id', ignoreDuplicates: true }
        );
        if (error) throw error;
        break;
      }

      case 'style_signal': {
        const signal = mutation.payload;
        const { error } = await supabase.from('style_signals').upsert(
          {
            id: signal.id,
            user_id: user.id,
            signal_type: signal.signalType,
            outfit_id: signal.outfitId || null,
            item_ids: signal.itemIds || [],
            occasion: signal.occasion || null,
            season: signal.season || null,
            rejection_reason: signal.rejectionReason || null,
            note: signal.note || null,
            created_at: new Date(signal.createdAt).toISOString(),
          },
          { onConflict: 'user_id, id', ignoreDuplicates: true }
        );
        if (error) throw error;
        break;
      }

      case 'wardrobe_image': {
        if (mutation.operation === 'UPLOAD_IMAGE') {
          const { itemId, photoId, storagePath } = mutation.payload;
          const blob = await getImage(photoId);
          if (!blob) {
            // Local blob is missing, cannot upload; mark dead letter
            throw new Error(`Image blob ${photoId} not found locally in imageStore`);
          }

          const file = new File([blob], `${photoId}.jpg`, { type: 'image/jpeg' });
          const { error: uploadError } = await supabase.storage
            .from('wardrobe')
            .upload(storagePath, file, { contentType: 'image/jpeg', upsert: true });

          if (uploadError) throw uploadError;

          // Verification step: verify the uploaded object is accessible
          const { data: verifyData, error: verifyError } = await supabase.storage
            .from('wardrobe')
            .createSignedUrl(storagePath, 60);

          if (verifyError || !verifyData?.signedUrl) {
            throw new Error(`Verification of uploaded storage object failed for ${storagePath}`);
          }

          // Persist image version row in wardrobe_image_versions
          await supabase.from('wardrobe_image_versions').upsert(
            {
              id: photoId,
              user_id: user.id,
              wardrobe_item_id: itemId,
              storage_path: storagePath,
              mime_type: 'image/jpeg',
              byte_size: blob.size,
              is_active: true,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, id' }
          );

          // Active reference: update local and remote wardrobe item with the verified storage reference
          const signedUrl = verifyData.signedUrl;
          try {
            const updateBuilder: any = supabase.from('wardrobe_items').update({
              active_image_version_id: photoId,
              storage_path: storagePath,
              photo_id: photoId,
              photo_url: signedUrl,
              client_updated_at: new Date().toISOString(),
            }).eq('id', itemId);

            if (updateBuilder && typeof updateBuilder.eq === 'function') {
              await updateBuilder.eq('user_id', user.id);
            } else {
              await updateBuilder;
            }
          } catch (updateErr) {
            console.warn('Remote wardrobe_items photo update non-fatal error:', updateErr);
          }

          await wardrobeRepository.updateItem(itemId, {
            activeImageVersionId: photoId,
            photoId,
            storagePath,
            photoUrl: signedUrl,
            clientUpdatedAt: Date.now(),
          });
        } else if (mutation.operation === 'ACTIVATE_IMAGE') {
          const { itemId, imageVersionId, storagePath, previousImageVersionId } = mutation.payload;
          if (previousImageVersionId) {
            try {
              const q: any = supabase
                .from('wardrobe_image_versions')
                .update({ is_active: false })
                .eq('id', previousImageVersionId);
              if (q && typeof q.eq === 'function') {
                await q.eq('user_id', user.id);
              } else {
                await q;
              }
            } catch (err) {
              console.warn('Deactivate previous image version non-fatal warning:', err);
            }
          }
          await supabase.from('wardrobe_image_versions').upsert(
            {
              id: imageVersionId,
              user_id: user.id,
              wardrobe_item_id: itemId,
              storage_path: storagePath,
              is_active: true,
            },
            { onConflict: 'user_id, id' }
          );
          try {
            const updateBuilder: any = supabase
              .from('wardrobe_items')
              .update({
                active_image_version_id: imageVersionId,
                storage_path: storagePath,
                photo_id: imageVersionId,
                client_updated_at: new Date().toISOString(),
              })
              .eq('id', itemId);

            if (updateBuilder && typeof updateBuilder.eq === 'function') {
              await updateBuilder.eq('user_id', user.id);
            } else {
              await updateBuilder;
            }
          } catch (updateErr) {
            console.warn('Remote wardrobe_items activation update error:', updateErr);
          }

          await wardrobeRepository.updateItem(itemId, {
            activeImageVersionId: imageVersionId,
            photoId: imageVersionId,
            storagePath,
            clientUpdatedAt: Date.now(),
          });
        } else if (mutation.operation === 'DELETE_IMAGE') {
          const { storagePath, photoId, imageVersionId } = mutation.payload;
          const targetId = imageVersionId || photoId;
          if (targetId) {
            try {
              const q: any = supabase
                .from('wardrobe_image_versions')
                .update({ is_active: false, deleted_at: new Date().toISOString() })
                .eq('id', targetId);
              if (q && typeof q.eq === 'function') {
                await q.eq('user_id', user.id);
              } else {
                await q;
              }
            } catch (err) {
              console.warn('Image version soft delete non-fatal warning:', err);
            }
          }
          const { error: deleteError } = await supabase.storage
            .from('wardrobe')
            .remove([storagePath]);
          if (deleteError) {
            console.warn(`Storage delete failed for ${storagePath}:`, deleteError);
          }
        }
        break;
      }
    }
  }

  /**
   * Pulls remote deltas since the last sync time and reconciles with local storage.
   */
  async pullRemoteDeltas(): Promise<void> {
    if (!isSupabaseConfigured() || !this.currentUser || this.currentUser.isGuest) {
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const supabase = getSupabaseClient();
    const user = this.currentUser;

    try {
      const lastSync = this.getStorageItem(this.lastSyncKey);
      let query = supabase.from('wardrobe_items').select('*').eq('user_id', user.id);
      if (lastSync) {
        query = query.gt('server_updated_at', lastSync);
      }
      const { data: remoteItems, error: itemsErr } = await query;
      if (itemsErr) throw itemsErr;

      if (remoteItems && remoteItems.length > 0) {
        const localItems = (await wardrobeRepository.getAllItemsRaw?.()) || [];
        for (const r of remoteItems) {
          const remoteItem: WardrobeItem = {
            id: r.id,
            userId: r.user_id,
            name: r.name,
            photoId: r.photo_id,
            photoUrl: r.photo_url,
            category: r.category,
            subcategory: r.subcategory,
            colors: r.colors || [],
            seasons: r.seasons || [],
            occasions: r.occasions || [],
            formality: r.formality,
            brand: r.brand,
            status: r.status,
            favorite: r.favorite,
            note: r.note,
            timesWorn: r.times_worn,
            lastWorn: r.last_worn,
            isDeleted: r.is_deleted,
            deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
            serverUpdatedAt: r.server_updated_at,
          };

          const local = localItems.find((i) => i.id === remoteItem.id);
          if (local) {
            const winner = resolveWardrobeItemConflict(local, remoteItem);
            await wardrobeRepository.upsertItemRaw?.(winner);
          } else {
            await wardrobeRepository.upsertItemRaw?.(remoteItem);
          }
        }
      }

      // Sync calendar plans
      let planQuery = supabase.from('calendar_plans').select('*').eq('user_id', user.id);
      if (lastSync) {
        planQuery = planQuery.gt('server_updated_at', lastSync);
      }
      const { data: remotePlans, error: plansErr } = await planQuery;
      if (plansErr) throw plansErr;

      if (remotePlans && remotePlans.length > 0) {
        const localPlans = (await calendarRepository.getAllPlansRaw?.()) || [];
        for (const r of remotePlans) {
          const remotePlan: OutfitPlan = {
            id: r.id,
            userId: r.user_id,
            date: r.date,
            outfit: r.outfit,
            accessory: r.accessory,
            occasion: r.occasion,
            status: r.status,
            createdAt: new Date(r.created_at).getTime(),
            updatedAt: new Date(r.server_updated_at).getTime(),
            isDeleted: r.is_deleted,
            deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
            serverUpdatedAt: r.server_updated_at,
          };

          const local = localPlans.find((p) => p.date === remotePlan.date || p.id === remotePlan.id);
          if (local) {
            const winner = resolveCalendarPlanConflict(local, remotePlan);
            await calendarRepository.upsertPlanRaw?.(winner);
          } else {
            await calendarRepository.upsertPlanRaw?.(remotePlan);
          }
        }
      }

      // Sync preferences
      const { data: remotePrefs, error: prefsErr } = await supabase
        .from('style_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!prefsErr && remotePrefs) {
        const remotePreferences: StylePreferences = {
          userId: remotePrefs.user_id,
          preferredContexts: remotePrefs.preferred_contexts || [],
          preferredAesthetics: remotePrefs.preferred_aesthetics || [],
          stylingMode: remotePrefs.styling_mode || 'variety',
          updatedAt: new Date(remotePrefs.server_updated_at).getTime(),
          serverUpdatedAt: remotePrefs.server_updated_at,
        };
        const local = await preferencesRepository.getPreferences();
        if (local) {
          const winner = resolvePreferencesConflict(local, remotePreferences);
          await preferencesRepository.upsertPreferencesRaw?.(winner);
        } else {
          await preferencesRepository.upsertPreferencesRaw?.(remotePreferences);
        }
      }

      // Sync wear events
      const { data: remoteWear, error: wearErr } = await supabase
        .from('wear_events')
        .select('*')
        .eq('user_id', user.id);

      if (!wearErr && remoteWear && remoteWear.length > 0) {
        const events: WearEvent[] = remoteWear.map((w: any) => ({
          id: w.id,
          userId: w.user_id,
          wardrobeItemId: w.wardrobe_item_id,
          outfitId: w.outfit_id,
          plannedDate: w.planned_date,
          wornAt: w.worn_at,
          createdAt: new Date(w.created_at).getTime(),
        }));
        await wearEventsRepository.addEvents(events);
      }

      // Sync style signals
      const { data: remoteSignals, error: signalsErr } = await supabase
        .from('style_signals')
        .select('*')
        .eq('user_id', user.id);

      if (!signalsErr && remoteSignals && remoteSignals.length > 0) {
        const signals: StyleSignalEvent[] = remoteSignals.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          signalType: s.signal_type,
          outfitId: s.outfit_id || undefined,
          itemIds: s.item_ids || [],
          occasion: s.occasion || undefined,
          season: s.season || undefined,
          rejectionReason: s.rejection_reason || undefined,
          note: s.note || undefined,
          createdAt: new Date(s.created_at).getTime(),
        }));
        await styleSignalsRepository.addSignals(signals);
      }

      this.setStorageItem(this.lastSyncKey, new Date().toISOString());
    } catch (err: any) {
      console.warn('Delta pull failed:', err);
    }
  }

  /**
   * Resumable, idempotent guest -> account migration.
   * Never wipes local data on error.
   */
  async migrateGuestData(user: User): Promise<void> {
    if (!isSupabaseConfigured() || user.isGuest) return;

    const migrationStateKey = `stylesaathi-migration-${user.id}`;
    let state: MigrationState = {
      status: 'PREPARING',
      completedSteps: [],
      updatedAt: Date.now(),
    };

    try {
      const stored = this.getStorageItem(migrationStateKey);
      if (stored) {
        state = JSON.parse(stored);
      }
    } catch {}

    if (state.status === 'COMPLETE') {
      return; // Already fully migrated
    }

    const saveState = (updated: Partial<MigrationState>) => {
      state = { ...state, ...updated, updatedAt: Date.now() };
      try {
        this.setStorageItem(migrationStateKey, JSON.stringify(state));
      } catch {}
    };

    const supabase = getSupabaseClient();

    try {
      // Step 1: Gather local items
      const localItems = (await wardrobeRepository.getAllItemsRaw?.()) || (await wardrobeRepository.getItems());
      const localOutfits = (await wardrobeRepository.getAllSavedOutfitsRaw?.()) || (await wardrobeRepository.getSavedOutfits());
      const localPlans = (await calendarRepository.getAllPlansRaw?.()) || (await calendarRepository.getPlans());
      const localPrefs = await preferencesRepository.getPreferences();
      const localWear = await wearEventsRepository.getEvents();
      const localSignals = await styleSignalsRepository.getSignals();

      // Step 2: Upload local images
      if (!state.completedSteps.includes('IMAGES')) {
        saveState({ status: 'SYNCING' });
        for (const item of localItems) {
          if (item.photoId && !item.photoUrl) {
            const blob = await getImage(item.photoId);
            if (blob) {
              const storagePath = `wardrobe/${user.id}/${item.id}/${item.photoId}.jpg`;
              const file = new File([blob], `${item.photoId}.jpg`, { type: 'image/jpeg' });
              const { error } = await supabase.storage
                .from('wardrobe')
                .upload(storagePath, file, { contentType: 'image/jpeg', upsert: true });

              if (!error) {
                const { data } = await supabase.storage.from('wardrobe').createSignedUrl(storagePath, 3600);
                if (data?.signedUrl) {
                  item.photoUrl = data.signedUrl;
                  await wardrobeRepository.updateItem(item.id, { photoUrl: data.signedUrl });
                }
              }
            }
          }
        }
        state.completedSteps.push('IMAGES');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 3: Upsert wardrobe items
      if (!state.completedSteps.includes('WARDROBE')) {
        saveState({ status: 'SYNCING' });
        for (const item of localItems) {
          await supabase.from('wardrobe_items').upsert(
            {
              id: item.id,
              user_id: user.id,
              name: item.name,
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
              last_worn: item.lastWorn || null,
              is_deleted: item.isDeleted || false,
              deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
              client_updated_at: item.clientUpdatedAt
                ? new Date(item.clientUpdatedAt).toISOString()
                : new Date().toISOString(),
            },
            { onConflict: 'user_id, id' }
          );
        }
        state.completedSteps.push('WARDROBE');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 4: Upsert saved outfits
      if (!state.completedSteps.includes('OUTFITS')) {
        for (const outfit of localOutfits) {
          await supabase.from('saved_outfits').upsert(
            {
              id: outfit.id,
              user_id: user.id,
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
        }
        state.completedSteps.push('OUTFITS');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 5: Upsert calendar plans
      if (!state.completedSteps.includes('CALENDAR')) {
        for (const plan of localPlans) {
          await supabase.from('calendar_plans').upsert(
            {
              id: plan.id,
              user_id: user.id,
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
        }
        state.completedSteps.push('CALENDAR');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 6: Upsert preferences
      if (!state.completedSteps.includes('PREFERENCES') && localPrefs) {
        await supabase.from('style_preferences').upsert(
          {
            user_id: user.id,
            preferred_contexts: localPrefs.preferredContexts || [],
            preferred_aesthetics: localPrefs.preferredAesthetics || [],
            styling_mode: localPrefs.stylingMode || 'variety',
            client_updated_at: localPrefs.clientUpdatedAt
              ? new Date(localPrefs.clientUpdatedAt).toISOString()
              : new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        state.completedSteps.push('PREFERENCES');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 7: Upsert wear events
      if (!state.completedSteps.includes('WEAR_EVENTS')) {
        for (const event of localWear) {
          await supabase.from('wear_events').upsert(
            {
              id: event.id,
              user_id: user.id,
              wardrobe_item_id: event.wardrobeItemId,
              outfit_id: event.outfitId || null,
              planned_date: event.plannedDate || null,
              worn_at: event.wornAt,
            },
            { onConflict: 'user_id, id', ignoreDuplicates: true }
          );
        }
        state.completedSteps.push('WEAR_EVENTS');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 8: Upsert style signals
      if (!state.completedSteps.includes('STYLE_SIGNALS')) {
        for (const signal of localSignals) {
          await supabase.from('style_signals').upsert(
            {
              id: signal.id,
              user_id: user.id,
              signal_type: signal.signalType,
              outfit_id: signal.outfitId || null,
              item_ids: signal.itemIds || [],
              occasion: signal.occasion || null,
              season: signal.season || null,
              rejection_reason: signal.rejectionReason || null,
              note: signal.note || null,
              created_at: new Date(signal.createdAt).toISOString(),
            },
            { onConflict: 'user_id, id', ignoreDuplicates: true }
          );
        }
        state.completedSteps.push('STYLE_SIGNALS');
        saveState({ completedSteps: state.completedSteps });
      }

      // Step 9: Update local user IDs without wiping data
      saveState({ status: 'VERIFYING' });
      for (const item of localItems) {
        if (!item.userId || item.userId !== user.id) {
          await wardrobeRepository.updateItem(item.id, { userId: user.id });
        }
      }

      saveState({ status: 'COMPLETE' });
      this.updateStatus('synced');
    } catch (err: any) {
      console.error('Guest migration error:', err);
      saveState({ status: 'FAILED', lastError: err.message });
      this.updateStatus('error', `Migration interrupted: ${err.message}`);
      // RULE 10: Never wipe guest data on error
    }
  }
}

export const syncService = new SyncService();
