import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { getInMemorySessionToken } from '../auth/pkce';
import { syncQueue } from './syncQueue';
import {
  workerSyncClient,
  QuotaExceededError,
  isQuotaExhaustedError,
} from './workerSyncClient';
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
  private authToken: string | null = null;
  private listeners = new Set<SyncStatusListener>();
  private lastSyncKey = 'stylesaathi-last-sync-time';
  private memoryStorage = new Map<string, string>();
  private syncBackend: 'worker' | 'supabase' = 'supabase';

  setSyncBackend(backend: 'worker' | 'supabase'): void {
    this.syncBackend = backend;
  }

  getSyncBackend(): 'worker' | 'supabase' {
    return this.syncBackend;
  }

  isWorkerBackend(): boolean {
    return this.syncBackend === 'worker' || !isSupabaseConfigured();
  }

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

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken || getInMemorySessionToken();
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
    if (syncQueue.isQuotaPaused()) {
      this.updateStatus('error', 'Sync paused: cloud daily quota reached. Local changes are safe.');
      return;
    }
    if (!this.currentUser || this.currentUser.isGuest) {
      return;
    }
    const isWorker = this.isWorkerBackend();
    if (!isWorker && !isSupabaseConfigured()) {
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      this.updateStatus('offline');
      return;
    }

    this.isProcessing = true;
    this.updateStatus('syncing');

    const supabase = !isWorker && isSupabaseConfigured() ? getSupabaseClient() : null;
    const user = this.currentUser;

    try {
      while (true) {
        const mutation = await syncQueue.peekNext(user.id);
        if (!mutation) {
          break; // Queue is empty or remaining items are waiting on retry/deps
        }

        await syncQueue.markInFlight(mutation.id);

        try {
          if (isWorker) {
            await this.executeRemoteMutationWorker(mutation);
          } else if (supabase) {
            await this.executeRemoteMutation(supabase, user, mutation);
          }
          await syncQueue.markSuccess(mutation.id);
        } catch (err: any) {
          console.error(`Mutation ${mutation.id} execution failed:`, err);
          if (err instanceof QuotaExceededError || isQuotaExhaustedError(err?.status, err?.message)) {
            // WORKSTREAM 5: Quota failures must NOT dead-letter mutations
            await syncQueue.markFailed(mutation.id, err.message, false, true);
            this.updateStatus('error', 'Sync paused: cloud daily quota reached. Local changes are safe.');
            break;
          }
          if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            // Phase 3F.10A.5: Authentication required (HTTP 401).
            // Do NOT dead-letter or destroy local offline mutations or IndexedDB data!
            await syncQueue.markFailed(mutation.id, 'Authentication required (HTTP 401)', false);
            this.updateStatus('error', 'Sync paused: authentication required. Local changes are safe.');
            break;
          }
          const isPermanent =
            err.isPermanent ||
            err.code === '42501' || // RLS violation
            err.code === '23503'; // Foreign key constraint violation
          await syncQueue.markFailed(mutation.id, err.message || 'Unknown error', isPermanent);
          if (!isPermanent) {
            // Transient error (network/server), stop loop until next retry window
            break;
          }
        }
      }

      const stats = await syncQueue.getStats(user.id);
      if (syncQueue.isQuotaPaused()) {
        this.updateStatus('error', 'Sync paused: cloud daily quota reached. Local changes are safe.');
      } else if (this.lastError?.includes('authentication required')) {
        // Preserve authentication required status and error message
        this.updateStatus('error', this.lastError);
      } else if (stats.failed > 0 || stats.deadLetter > 0) {
        this.updateStatus('error', `${stats.failed + stats.deadLetter} sync items need attention`);
      } else {
        this.updateStatus('synced');
      }
    } catch (globalErr: any) {
      if (globalErr instanceof QuotaExceededError || isQuotaExhaustedError(globalErr?.status, globalErr?.message)) {
        await syncQueue.markQuotaExhausted(globalErr.retryAfterMs || 3600000);
        this.updateStatus('error', 'Sync paused: cloud daily quota reached. Local changes are safe.');
      } else if (globalErr?.status === 401 || globalErr?.message?.includes('401')) {
        this.updateStatus('error', 'Sync paused: authentication required. Local changes are safe.');
      } else {
        this.updateStatus('error', globalErr.message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single typed mutation against the Cloudflare Worker + D1 delta sync backend.
   */
  private async executeRemoteMutationWorker(mutation: SyncMutation): Promise<void> {
    const token = this.getAuthToken() || undefined;
    const res = await workerSyncClient.pushMutations([mutation], token);
    const result = res.results?.[0];
    if (!result) return;

    if (result.status === 'conflict_server_wins') {
      if (result.conflictData) {
        await this.reconcileConflictData(mutation.entityType, result.conflictData);
      }
    } else if (result.status === 'rejected') {
      const err: any = new Error(result.error || 'Mutation rejected by server');
      err.code = 'REJECTED';
      err.isPermanent = true;
      throw err;
    }
  }

  /**
   * Reconciles server conflict data when server-wins is returned on push.
   */
  private async reconcileConflictData(entityType: string, conflictData: any): Promise<void> {
    switch (entityType) {
      case 'wardrobe_item': {
        const localItems = (await wardrobeRepository.getAllItemsRaw?.()) || [];
        const local = localItems.find((i) => i.id === conflictData.id);
        if (local) {
          const remoteItem: WardrobeItem = {
            id: conflictData.id,
            userId: conflictData.user_id,
            name: conflictData.name,
            photoId: conflictData.photo_id,
            photoUrl: conflictData.photo_url,
            category: conflictData.category,
            subcategory: conflictData.subcategory,
            colors: typeof conflictData.colors === 'string' ? JSON.parse(conflictData.colors) : conflictData.colors || [],
            seasons: typeof conflictData.seasons === 'string' ? JSON.parse(conflictData.seasons) : conflictData.seasons || [],
            occasions: typeof conflictData.occasions === 'string' ? JSON.parse(conflictData.occasions) : conflictData.occasions || [],
            formality: conflictData.formality,
            brand: conflictData.brand,
            status: conflictData.status,
            favorite: Boolean(conflictData.favorite),
            note: conflictData.note || '',
            timesWorn: conflictData.times_worn || 0,
            lastWorn: conflictData.last_worn,
            isDeleted: Boolean(conflictData.is_deleted),
            deletedAt: conflictData.deleted_at ? new Date(conflictData.deleted_at).getTime() : undefined,
            serverUpdatedAt: conflictData.server_updated_at,
            revision: conflictData.revision,
            serverRevision: conflictData.revision,
          } as any;
          const winner = resolveWardrobeItemConflict(local, remoteItem);
          winner.photo = local.photo || winner.photo;
          await wardrobeRepository.upsertItemRaw?.(winner);
        }
        break;
      }
      case 'calendar_plan': {
        const localPlans = (await calendarRepository.getAllPlansRaw?.()) || [];
        const local = localPlans.find((p) => p.date === conflictData.date || p.id === conflictData.id);
        if (local) {
          const remotePlan: OutfitPlan = {
            id: conflictData.id,
            userId: conflictData.user_id,
            date: conflictData.date,
            outfit: typeof conflictData.outfit === 'string' ? JSON.parse(conflictData.outfit) : conflictData.outfit || {},
            accessory: typeof conflictData.accessory === 'string' ? JSON.parse(conflictData.accessory) : conflictData.accessory,
            occasion: conflictData.occasion,
            status: conflictData.status,
            createdAt: new Date(conflictData.created_at).getTime(),
            updatedAt: new Date(conflictData.server_updated_at).getTime(),
            isDeleted: Boolean(conflictData.is_deleted),
            deletedAt: conflictData.deleted_at ? new Date(conflictData.deleted_at).getTime() : undefined,
            serverUpdatedAt: conflictData.server_updated_at,
            revision: conflictData.revision,
            serverRevision: conflictData.revision,
          } as any;
          const winner = resolveCalendarPlanConflict(local, remotePlan);
          await calendarRepository.upsertPlanRaw?.(winner);
        }
        break;
      }
      case 'saved_outfit': {
        const localOutfits = (await wardrobeRepository.getAllSavedOutfitsRaw?.()) || [];
        const local = localOutfits.find((o) => o.id === conflictData.id);
        if (local) {
          const remoteOutfit: SavedOutfit = {
            id: conflictData.id,
            name: conflictData.name,
            outfit: {
              id: conflictData.id,
              name: conflictData.name,
              template: conflictData.template,
              slots: typeof conflictData.slots === 'string' ? JSON.parse(conflictData.slots) : conflictData.slots || {},
              score: conflictData.score,
              why: conflictData.why,
            } as any,
            savedAt: new Date(conflictData.created_at || conflictData.server_updated_at).getTime(),
            isDeleted: Boolean(conflictData.is_deleted),
            deletedAt: conflictData.deleted_at ? new Date(conflictData.deleted_at).getTime() : undefined,
            serverUpdatedAt: conflictData.server_updated_at,
            revision: conflictData.revision,
            serverRevision: conflictData.revision,
          } as any;
          const winner = resolveSavedOutfitConflict(local, remoteOutfit);
          await wardrobeRepository.upsertSavedOutfitRaw?.(winner);
        }
        break;
      }
      case 'style_preferences': {
        const local = await preferencesRepository.getPreferences();
        if (local) {
          const remotePref: StylePreferences = {
            userId: conflictData.user_id,
            preferredContexts: typeof conflictData.preferred_contexts === 'string' ? JSON.parse(conflictData.preferred_contexts) : conflictData.preferred_contexts || [],
            preferredAesthetics: typeof conflictData.preferred_aesthetics === 'string' ? JSON.parse(conflictData.preferred_aesthetics) : conflictData.preferred_aesthetics || [],
            stylingMode: conflictData.styling_mode || 'variety',
            updatedAt: new Date(conflictData.server_updated_at || Date.now()).getTime(),
            serverUpdatedAt: conflictData.server_updated_at,
            revision: conflictData.revision,
            serverRevision: conflictData.revision,
          } as any;
          const winner = resolvePreferencesConflict(local, remotePref);
          await preferencesRepository.upsertPreferencesRaw?.(winner);
        }
        break;
      }
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
   * Pulls remote deltas from Cloudflare Worker + D1 backend and reconciles with local repositories.
   */
  private async pullRemoteDeltasWorker(): Promise<void> {
    try {
      const lastSync = this.getStorageItem(this.lastSyncKey);
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const token = this.getAuthToken() || undefined;
        const pullRes = await workerSyncClient.pullDeltas({
          since: lastSync,
          cursor,
          limit: 100,
        }, token);

        const changes = pullRes.changes;

        // 1. Reconcile wardrobe items
        if (changes.wardrobe_items && changes.wardrobe_items.length > 0) {
          const localItems = (await wardrobeRepository.getAllItemsRaw?.()) || [];
          for (const r of changes.wardrobe_items) {
            const remoteItem: WardrobeItem = {
              id: r.id,
              userId: r.user_id,
              name: r.name,
              photoId: r.photo_id,
              photoUrl: r.photo_url,
              category: r.category,
              subcategory: r.subcategory,
              colors: Array.isArray(r.colors) ? r.colors : [],
              seasons: Array.isArray(r.seasons) ? r.seasons : [],
              occasions: Array.isArray(r.occasions) ? r.occasions : [],
              formality: r.formality,
              brand: r.brand,
              status: r.status,
              favorite: Boolean(r.favorite),
              note: r.note || '',
              timesWorn: r.times_worn || 0,
              lastWorn: r.last_worn,
              fabric: r.fabric,
              pattern: r.pattern,
              fit: r.fit,
              purchasePrice: r.purchase_price,
              culturalContext: r.cultural_context,
              userVerified: Boolean(r.user_verified),
              isDeleted: Boolean(r.is_deleted),
              deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
              serverUpdatedAt: r.server_updated_at,
              revision: r.revision,
              serverRevision: r.revision,
            } as any;

            const local = localItems.find((i) => i.id === remoteItem.id);
            if (local) {
              const winner = resolveWardrobeItemConflict(local, remoteItem);
              winner.photo = local.photo || winner.photo;
              await wardrobeRepository.upsertItemRaw?.(winner);
            } else {
              await wardrobeRepository.upsertItemRaw?.(remoteItem);
            }
          }
        }

        // 2. Reconcile saved outfits
        if (changes.saved_outfits && changes.saved_outfits.length > 0) {
          const localOutfits = (await wardrobeRepository.getAllSavedOutfitsRaw?.()) || [];
          for (const r of changes.saved_outfits) {
            const remoteOutfit: SavedOutfit = {
              id: r.id,
              name: r.name,
              outfit: {
                id: r.id,
                name: r.name,
                template: r.template,
                slots: typeof r.slots === 'object' ? r.slots : {},
                score: r.score || 0,
                why: r.why || '',
              } as any,
              savedAt: new Date(r.created_at || r.server_updated_at).getTime(),
              isDeleted: Boolean(r.is_deleted),
              deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
              serverUpdatedAt: r.server_updated_at,
              revision: r.revision,
              serverRevision: r.revision,
            } as any;

            const local = localOutfits.find((o) => o.id === remoteOutfit.id);
            if (local) {
              const winner = resolveSavedOutfitConflict(local, remoteOutfit);
              await wardrobeRepository.upsertSavedOutfitRaw?.(winner);
            } else {
              await wardrobeRepository.upsertSavedOutfitRaw?.(remoteOutfit);
            }
          }
        }

        // 3. Reconcile calendar plans
        if (changes.calendar_plans && changes.calendar_plans.length > 0) {
          const localPlans = (await calendarRepository.getAllPlansRaw?.()) || [];
          for (const r of changes.calendar_plans) {
            const remotePlan: OutfitPlan = {
              id: r.id,
              userId: r.user_id,
              date: r.date,
              outfit: typeof r.outfit === 'object' ? r.outfit : {},
              accessory: typeof r.accessory === 'object' ? r.accessory : undefined,
              occasion: r.occasion,
              status: r.status,
              createdAt: new Date(r.created_at).getTime(),
              updatedAt: new Date(r.server_updated_at).getTime(),
              isDeleted: Boolean(r.is_deleted),
              deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : undefined,
              serverUpdatedAt: r.server_updated_at,
              revision: r.revision,
              serverRevision: r.revision,
            } as any;

            const local = localPlans.find((p) => p.date === remotePlan.date || p.id === remotePlan.id);
            if (local) {
              const winner = resolveCalendarPlanConflict(local, remotePlan);
              await calendarRepository.upsertPlanRaw?.(winner);
            } else {
              await calendarRepository.upsertPlanRaw?.(remotePlan);
            }
          }
        }

        // 4. Reconcile style preferences
        if (changes.style_preferences) {
          const sp = changes.style_preferences;
          const remotePref: StylePreferences = {
            userId: sp.user_id,
            preferredContexts: Array.isArray(sp.preferred_contexts) ? sp.preferred_contexts : [],
            preferredAesthetics: Array.isArray(sp.preferred_aesthetics) ? sp.preferred_aesthetics : [],
            stylingMode: sp.styling_mode || 'variety',
            updatedAt: new Date(sp.server_updated_at || Date.now()).getTime(),
            serverUpdatedAt: sp.server_updated_at,
            revision: sp.revision,
            serverRevision: sp.revision,
          } as any;
          const local = await preferencesRepository.getPreferences();
          if (local) {
            const winner = resolvePreferencesConflict(local, remotePref);
            await preferencesRepository.upsertPreferencesRaw?.(winner);
          } else {
            await preferencesRepository.upsertPreferencesRaw?.(remotePref);
          }
        }

        // 5. Wear events
        if (changes.wear_events && changes.wear_events.length > 0) {
          const events: WearEvent[] = changes.wear_events.map((w: any) => ({
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

        // 6. Style signals
        if (changes.style_signals && changes.style_signals.length > 0) {
          const signals: StyleSignalEvent[] = changes.style_signals.map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            signalType: s.signal_type,
            outfitId: s.outfit_id || undefined,
            itemIds: Array.isArray(s.item_ids) ? s.item_ids : [],
            occasion: s.occasion || undefined,
            season: s.season || undefined,
            rejectionReason: s.rejection_reason || undefined,
            note: s.note || undefined,
            createdAt: new Date(s.created_at).getTime(),
          }));
          await styleSignalsRepository.addSignals(signals);
        }

        hasMore = pullRes.hasMore && Boolean(pullRes.nextCursor);
        cursor = pullRes.nextCursor;
      }

      this.setStorageItem(this.lastSyncKey, new Date().toISOString());
    } catch (err: any) {
      if (err instanceof QuotaExceededError || isQuotaExhaustedError(err?.status, err?.message)) {
        await syncQueue.markQuotaExhausted(err.retryAfterMs || 3600000);
        this.updateStatus('error', 'Sync paused: cloud daily quota reached. Local changes are safe.');
      } else if (err?.status === 401 || err?.message?.includes('401')) {
        this.updateStatus('error', 'Sync paused: authentication required. Local changes are safe.');
      } else {
        console.warn('Worker delta pull non-fatal warning:', err);
      }
    }
  }

  /**
   * Pulls remote deltas since the last sync time and reconciles with local storage.
   */
  async pullRemoteDeltas(): Promise<void> {
    if (syncQueue.isQuotaPaused()) {
      return;
    }
    if (!this.currentUser || this.currentUser.isGuest) {
      return;
    }
    const isWorker = this.isWorkerBackend();
    if (!isWorker && !isSupabaseConfigured()) {
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      return;
    }

    if (isWorker) {
      await this.pullRemoteDeltasWorker();
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

  // ============================================================================
  // PHASE 3C.8: DEAD-LETTER RECOVERY & USER-CONTROLLED RESOLUTION
  // ============================================================================

  /**
   * Retrieves all dead-lettered mutations for the current user.
   */
  async getDeadLetterMutations(userId?: string): Promise<SyncMutation[]> {
    const targetUserId = userId || this.currentUser?.id;
    return await syncQueue.getDeadLetterMutations(targetUserId);
  }

  /**
   * Reconciles a dead-letter mutation against latest server state,
   * updates the local repository non-destructively, and enqueues a fresh mutation
   * with updated expectedRevision and new mutation ID.
   */
  async reconcileAndRetryDeadLetter(
    mutationId: string
  ): Promise<{ success: boolean; error?: string; newMutationId?: string }> {
    const mutation = await syncQueue.getMutation(mutationId);
    if (!mutation) {
      return { success: false, error: 'Mutation not found in queue' };
    }

    if (mutation.status !== 'dead_letter') {
      return { success: false, error: 'Only dead-lettered mutations can be manually reconciled' };
    }

    const currentUserId = this.currentUser?.id;
    if (mutation.userId && currentUserId && mutation.userId !== currentUserId) {
      return { success: false, error: 'Cannot reconcile mutation belonging to another user' };
    }

    const isWorker = this.isWorkerBackend();
    if (!isWorker && !isSupabaseConfigured()) {
      return { success: false, error: 'Sync backend not configured' };
    }

    try {
      let serverRecord: any = null;

      // 1. Fetch latest server state via pull deltas
      if (isWorker) {
        try {
          const token = this.getAuthToken() || undefined;
          const pullRes = await workerSyncClient.pullDeltas({ limit: 100 }, token);
          const changes = pullRes.changes;

          if (mutation.entityType === 'wardrobe_item') {
            serverRecord = changes.wardrobe_items?.find((r) => r.id === mutation.entityId);
          } else if (mutation.entityType === 'saved_outfit') {
            serverRecord = changes.saved_outfits?.find((r) => r.id === mutation.entityId);
          } else if (mutation.entityType === 'calendar_plan') {
            serverRecord = changes.calendar_plans?.find(
              (r) => r.id === mutation.entityId || (mutation.payload as any)?.date === r.date
            );
          } else if (mutation.entityType === 'style_preferences') {
            serverRecord = changes.style_preferences;
          }
        } catch (pullErr) {
          console.warn('Pull deltas during reconciliation warning:', pullErr);
        }
      }

      // 2. Perform safe, non-destructive reconciliation with local repository
      let reconciledPayload = (mutation as any).payload;
      const nextExpectedRevision =
        typeof serverRecord?.revision === 'number'
          ? serverRecord.revision
          : typeof (mutation as any).expectedRevision === 'number'
          ? (mutation as any).expectedRevision
          : 1;

      if (mutation.entityType === 'wardrobe_item' && mutation.operation === 'UPSERT') {
        const localItems = (await wardrobeRepository.getAllItemsRaw?.()) || [];
        const local = localItems.find((i) => i.id === mutation.entityId) || (mutation.payload as WardrobeItem);
        if (serverRecord) {
          const remoteItem: WardrobeItem = {
            id: serverRecord.id,
            userId: serverRecord.user_id,
            name: serverRecord.name,
            photoId: serverRecord.photo_id,
            photoUrl: serverRecord.photo_url,
            category: serverRecord.category,
            subcategory: serverRecord.subcategory,
            colors: Array.isArray(serverRecord.colors) ? serverRecord.colors : [],
            seasons: Array.isArray(serverRecord.seasons) ? serverRecord.seasons : [],
            occasions: Array.isArray(serverRecord.occasions) ? serverRecord.occasions : [],
            formality: serverRecord.formality,
            brand: serverRecord.brand,
            status: serverRecord.status,
            favorite: Boolean(serverRecord.favorite),
            note: serverRecord.note || '',
            timesWorn: serverRecord.times_worn || 0,
            lastWorn: serverRecord.last_worn,
            fabric: serverRecord.fabric,
            pattern: serverRecord.pattern,
            fit: serverRecord.fit,
            purchasePrice: serverRecord.purchase_price,
            culturalContext: serverRecord.cultural_context,
            userVerified: Boolean(serverRecord.user_verified),
            isDeleted: Boolean(serverRecord.is_deleted),
            deletedAt: serverRecord.deleted_at ? new Date(serverRecord.deleted_at).getTime() : undefined,
            serverUpdatedAt: serverRecord.server_updated_at,
            revision: serverRecord.revision,
            serverRevision: serverRecord.revision,
          } as any;

          const winner = resolveWardrobeItemConflict(local, remoteItem);
          winner.photo = local.photo || winner.photo; // Strictly preserve local garment images!
          await wardrobeRepository.upsertItemRaw?.(winner);
          reconciledPayload = winner;
        } else if (local) {
          reconciledPayload = local;
        }
      } else if (mutation.entityType === 'saved_outfit' && mutation.operation === 'UPSERT') {
        const localOutfits = (await wardrobeRepository.getAllSavedOutfitsRaw?.()) || [];
        const local = localOutfits.find((o) => o.id === mutation.entityId) || (mutation.payload as SavedOutfit);
        if (serverRecord) {
          const remoteOutfit: SavedOutfit = {
            id: serverRecord.id,
            name: serverRecord.name,
            outfit: {
              id: serverRecord.id,
              name: serverRecord.name,
              template: serverRecord.template,
              slots: typeof serverRecord.slots === 'object' ? serverRecord.slots : {},
              score: serverRecord.score || 0,
              why: serverRecord.why || '',
            } as any,
            savedAt: new Date(serverRecord.created_at || serverRecord.server_updated_at).getTime(),
            isDeleted: Boolean(serverRecord.is_deleted),
            deletedAt: serverRecord.deleted_at ? new Date(serverRecord.deleted_at).getTime() : undefined,
            serverUpdatedAt: serverRecord.server_updated_at,
            revision: serverRecord.revision,
            serverRevision: serverRecord.revision,
          } as any;
          const winner = resolveSavedOutfitConflict(local, remoteOutfit);
          await wardrobeRepository.upsertSavedOutfitRaw?.(winner);
          reconciledPayload = winner;
        }
      } else if (mutation.entityType === 'calendar_plan' && mutation.operation === 'UPSERT') {
        const localPlans = (await calendarRepository.getAllPlansRaw?.()) || [];
        const local = localPlans.find((p) => p.id === mutation.entityId) || (mutation.payload as OutfitPlan);
        if (serverRecord) {
          const remotePlan: OutfitPlan = {
            id: serverRecord.id,
            userId: serverRecord.user_id,
            date: serverRecord.date,
            outfit: typeof serverRecord.outfit === 'object' ? serverRecord.outfit : {},
            accessory: typeof serverRecord.accessory === 'object' ? serverRecord.accessory : undefined,
            occasion: serverRecord.occasion,
            status: serverRecord.status,
            createdAt: new Date(serverRecord.created_at).getTime(),
            updatedAt: new Date(serverRecord.server_updated_at).getTime(),
            isDeleted: Boolean(serverRecord.is_deleted),
            deletedAt: serverRecord.deleted_at ? new Date(serverRecord.deleted_at).getTime() : undefined,
            serverUpdatedAt: serverRecord.server_updated_at,
            revision: serverRecord.revision,
            serverRevision: serverRecord.revision,
          } as any;
          const winner = resolveCalendarPlanConflict(local, remotePlan);
          await calendarRepository.upsertPlanRaw?.(winner);
          reconciledPayload = winner;
        }
      } else if (mutation.entityType === 'style_preferences') {
        if (serverRecord) {
          const remotePref: StylePreferences = {
            userId: serverRecord.user_id,
            preferredContexts: Array.isArray(serverRecord.preferred_contexts) ? serverRecord.preferred_contexts : [],
            preferredAesthetics: Array.isArray(serverRecord.preferred_aesthetics) ? serverRecord.preferred_aesthetics : [],
            stylingMode: serverRecord.styling_mode || 'variety',
            updatedAt: new Date(serverRecord.server_updated_at || Date.now()).getTime(),
            serverUpdatedAt: serverRecord.server_updated_at,
            revision: serverRecord.revision,
            serverRevision: serverRecord.revision,
          } as any;
          const local = await preferencesRepository.getPreferences();
          if (local) {
            const winner = resolvePreferencesConflict(local, remotePref);
            await preferencesRepository.upsertPreferencesRaw?.(winner);
            reconciledPayload = winner;
          } else {
            await preferencesRepository.upsertPreferencesRaw?.(remotePref);
            reconciledPayload = remotePref;
          }
        }
      }

      // 3. Generate a brand new mutation ID (idempotency safety: never reuse key with modified payload)
      const newMutationId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `reconciled-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // 4. Enqueue the fresh mutation with updated expectedRevision and clean pending status
      await syncQueue.enqueue({
        id: newMutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: reconciledPayload,
        userId: currentUserId || mutation.userId,
        expectedRevision: nextExpectedRevision,
        reconciledAt: Date.now(),
        originalMutationId: mutation.id,
      } as any);

      // 5. Safely discard the old dead-letter mutation
      await syncQueue.discardMutation(mutation.id);

      return { success: true, newMutationId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Reconciliation failed' };
    }
  }

  /**
   * Discards a dead-letter mutation when user explicitly chooses to discard.
   */
  async discardDeadLetter(mutationId: string): Promise<boolean> {
    const mutation = await syncQueue.getMutation(mutationId);
    if (!mutation) return false;
    const currentUserId = this.currentUser?.id;
    if (mutation.userId && currentUserId && mutation.userId !== currentUserId) {
      return false;
    }
    const discarded = await syncQueue.discardMutation(mutationId);
    if (discarded) {
      const stats = await syncQueue.getStats(currentUserId);
      if (stats.failed > 0 || stats.deadLetter > 0) {
        this.updateStatus('error', `${stats.failed + stats.deadLetter} sync items need attention`);
      } else {
        this.updateStatus('synced');
      }
    }
    return discarded;
  }

  /**
   * Exports unresolved dead-letter mutations into a clean, recoverable JSON structure without secrets or tokens.
   */
  async exportDeadLetters(): Promise<{
    application: string;
    version: string;
    exportedAt: string;
    totalUnresolved: number;
    mutations: any[];
  }> {
    const deadLetters = await syncQueue.getDeadLetterMutations(this.currentUser?.id);
    const sanitized = deadLetters.map((m) => {
      const cleanPayload: Record<string, any> = {};
      const raw = (m as any).payload || {};
      for (const [k, v] of Object.entries(raw)) {
        if (k === 'photo' && typeof v === 'string' && (v.startsWith('data:') || v.startsWith('blob:'))) {
          continue; // Strip large local base64/blob
        }
        cleanPayload[k] = v;
      }
      return {
        id: m.id,
        entityType: m.entityType,
        entityId: m.entityId,
        operation: m.operation,
        clientTimestamp: m.clientTimestamp,
        createdAt: m.createdAt,
        lastError: m.lastError,
        payload: cleanPayload,
      };
    });

    return {
      application: 'StyleSaathi',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      totalUnresolved: sanitized.length,
      mutations: sanitized,
    };
  }

  /**
   * Restores previously exported unresolved mutations safely into the local queue and repositories.
   */
  async importUnresolvedMutations(
    data: any
  ): Promise<{ importedCount: number; errors: string[] }> {
    if (!data || !Array.isArray(data.mutations)) {
      return { importedCount: 0, errors: ['Invalid export format: missing mutations array'] };
    }

    let importedCount = 0;
    const errors: string[] = [];
    const currentUserId = this.currentUser?.id;

    for (const m of data.mutations) {
      if (!m.entityType || !m.entityId || !m.payload) {
        errors.push(`Skipping malformed mutation ${m.id || 'unknown'}`);
        continue;
      }

      try {
        const newId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Enqueue with fresh ID
        await syncQueue.enqueue({
          id: newId,
          entityType: m.entityType,
          entityId: m.entityId,
          operation: m.operation || 'UPSERT',
          payload: m.payload,
          userId: currentUserId,
          status: 'pending',
        } as any);

        // Also restore into local repository if needed
        if (m.entityType === 'wardrobe_item' && m.payload.name) {
          await wardrobeRepository.upsertItemRaw?.(m.payload);
        } else if (m.entityType === 'saved_outfit') {
          await wardrobeRepository.upsertSavedOutfitRaw?.(m.payload);
        } else if (m.entityType === 'calendar_plan') {
          await calendarRepository.upsertPlanRaw?.(m.payload);
        }

        importedCount++;
      } catch (err: any) {
        errors.push(`Failed to import mutation for ${m.entityId}: ${err.message}`);
      }
    }

    if (importedCount > 0) {
      this.processQueue().catch(() => {});
    }

    return { importedCount, errors };
  }
}

export const syncService = new SyncService();
