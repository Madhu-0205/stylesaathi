import { clear, createStore, UseStore } from 'idb-keyval';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

export type AccountDeletionState =
  | 'READY'
  | 'IDENTITY_VERIFIED'
  | 'CLOUD_DELETION_IN_PROGRESS'
  | 'CLOUD_DELETION_CONFIRMED'
  | 'LOCAL_DATA_WIPE'
  | 'SESSION_TERMINATED'
  | 'COMPLETE'
  | 'RECOVERABLE_FAILURE'
  | 'RETRY_REQUIRED'
  | 'SUPPORT_REQUIRED';

export interface DeletionResult {
  success: boolean;
  state: AccountDeletionState;
  error?: string;
}

export type DeletionStateListener = (state: AccountDeletionState, error?: string) => void;

export class AccountDeletionService {
  private currentState: AccountDeletionState = 'READY';
  private listeners = new Set<DeletionStateListener>();

  public getState(): AccountDeletionState {
    return this.currentState;
  }

  public onStateChange(listener: DeletionStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private transition(state: AccountDeletionState, error?: string): void {
    this.currentState = state;
    this.listeners.forEach((l) => l(state, error));
  }

  /**
   * Complete account deletion orchestrator.
   * Guarantees that local data is ONLY wiped after cloud deletion is confirmed.
   */
  public async executeAccountDeletion(currentUser: User | null): Promise<DeletionResult> {
    if (!currentUser) {
      const err = 'No active user found to delete.';
      this.transition('RECOVERABLE_FAILURE', err);
      return { success: false, state: 'RECOVERABLE_FAILURE', error: err };
    }

    // 1. If user is guest, cloud records do not exist. Wipe local data directly.
    if (currentUser.isGuest) {
      this.transition('LOCAL_DATA_WIPE');
      await this.wipeLocalData();
      this.transition('SESSION_TERMINATED');
      this.transition('COMPLETE');
      return { success: true, state: 'COMPLETE' };
    }

    // 2. Strict connectivity check: Cloud deletion CANNOT happen offline.
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      const err = 'Account deletion requires an active internet connection to securely erase cloud records.';
      this.transition('RECOVERABLE_FAILURE', err);
      return { success: false, state: 'RECOVERABLE_FAILURE', error: err };
    }

    this.transition('IDENTITY_VERIFIED');

    // 3. Cloud deletion via Supabase Edge Function or verified RPC cascade
    this.transition('CLOUD_DELETION_IN_PROGRESS');

    try {
      let cloudSucceeded = false;
      let cloudErrorMessage: string | null = null;

      if (isSupabaseConfigured()) {
        let edgeFunctionExecuted = false;

        try {
          // Attempt preferred Edge Function orchestrator
          const { data, error } = await supabase.functions.invoke('delete-account', {
            method: 'POST',
          });

          if (!error && data?.success === true) {
            cloudSucceeded = true;
          } else if (data?.error) {
            edgeFunctionExecuted = true;
            cloudErrorMessage = data.error;
          } else if (error) {
            cloudErrorMessage = error.message;
            // If the error contains context/status from function response, it was executed
            if ((error as any)?.context || (error as any)?.status) {
              edgeFunctionExecuted = true;
            }
          }
        } catch (edgeFnErr: any) {
          cloudErrorMessage = edgeFnErr?.message || 'Edge function invocation error';
        }

        // If Edge Function actively ran and returned a deletion error (e.g. storage cleanup halted
        // to prevent orphaned files, or database locked), DO NOT bypass it with direct RPC fallback.
        // Direct RPC fallback is ONLY for environments where Edge Functions are not deployed/available.
        if (!cloudSucceeded && !edgeFunctionExecuted) {
          try {
            const { error: rpcError } = await supabase.rpc('delete_user_data_records', {
              target_user_id: currentUser.id,
            });

            if (!rpcError) {
              cloudSucceeded = true;
            } else {
              cloudErrorMessage = rpcError.message;
            }
          } catch (rpcErr: any) {
            cloudErrorMessage = rpcErr?.message || cloudErrorMessage;
          }
        }
      } else {
        cloudSucceeded = true;
      }

      if (!cloudSucceeded) {
        const errorMsg = cloudErrorMessage || 'Server failed to erase user records.';
        this.transition('RETRY_REQUIRED', errorMsg);
        return { success: false, state: 'RETRY_REQUIRED', error: errorMsg };
      }

      this.transition('CLOUD_DELETION_CONFIRMED');

      // 4. Wipe all local IndexedDB and LocalStorage stores now that cloud deletion succeeded
      this.transition('LOCAL_DATA_WIPE');
      await this.wipeLocalData();

      // 5. Sign out and terminate local session
      this.transition('SESSION_TERMINATED');
      if (isSupabaseConfigured()) {
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.warn('SignOut warning post-deletion:', signOutErr);
        }
      }

      this.transition('COMPLETE');
      return { success: true, state: 'COMPLETE' };
    } catch (err: any) {
      const msg = err?.message || 'Unexpected failure during account deletion.';
      this.transition('SUPPORT_REQUIRED', msg);
      return { success: false, state: 'SUPPORT_REQUIRED', error: msg };
    }
  }

  /**
   * Wipes all local IndexedDB stores and LocalStorage keys.
   */
  public async wipeLocalData(): Promise<void> {
    // A. Clear IndexedDB stores
    try {
      if (typeof indexedDB !== 'undefined') {
        const syncStore = createStore('stylesaathi-sync-queue-db', 'mutations');
        await clear(syncStore);

        const imgStore = createStore('stylesaathi-images-db', 'images');
        await clear(imgStore);

        const needleStore = createStore('stylesaathi-needle-db', 'models');
        await clear(needleStore);
      }
    } catch (e) {
      console.warn('Error clearing IndexedDB stores during deletion:', e);
    }

    // B. Clear all LocalStorage keys
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove = [
          'stylesaathi-wardrobe-items',
          'stylesaathi-saved-outfits',
          'stylesaathi-calendar-plans',
          'stylesaathi-style-preferences',
          'stylesaathi-wear-events',
          'stylesaathi-style-signals',
          'stylesaathi-last-sync-time',
          'stylesaathi_auth_session',
          'stylesaathi_guest_session',
          'stylesaathi-guest-session-v1',
          'stylesaathi-supabase-auth-token',
          'stylesaathi-onboarded',
          'stylesaathi-setup-completed',
          'stylesaathi-weather-cache-v1',
          'stylesaathi-weather-location-v1',
          'stylesaathi-saathi-chat-v1',
          'stylesaathi-trend-telemetry',
        ];

        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('Error clearing LocalStorage keys during deletion:', e);
    }
  }
}

export const accountDeletionService = new AccountDeletionService();
