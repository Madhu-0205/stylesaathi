// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountDeletionService } from '../accountDeletionService';
import { getSupabaseClient } from '../../lib/supabase';
import { User } from '../../types';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;

  beforeEach(() => {
    service = new AccountDeletionService();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects deletion when user is null', async () => {
    const res = await service.executeAccountDeletion(null);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RECOVERABLE_FAILURE');
    expect(res.error).toContain('No active user');
  });

  it('safely wipes local data for guest users without calling cloud', async () => {
    const guestUser: User = {
      id: 'guest_123',
      name: 'Guest Stylist',
      isGuest: true,
      createdAt: Date.now(),
    };

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'item_1' }]));
    localStorage.setItem('stylesaathi_guest_session', JSON.stringify(guestUser));

    const res = await service.executeAccountDeletion(guestUser);

    expect(res.success).toBe(true);
    expect(res.state).toBe('COMPLETE');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
    expect(localStorage.getItem('stylesaathi_guest_session')).toBeNull();
  });

  it('blocks deletion when device is offline and preserves local data', async () => {
    const authUser: User = {
      id: 'usr_abc',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      isGuest: false,
      createdAt: Date.now(),
    };

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'item_1' }]));

    // Simulate navigator.onLine = false
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const res = await service.executeAccountDeletion(authUser);

    expect(res.success).toBe(false);
    expect(res.state).toBe('RECOVERABLE_FAILURE');
    expect(res.error).toContain('active internet connection');

    // Local data MUST NOT be wiped if cloud deletion could not run
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();

    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('reports state transitions down the deletion lifecycle upon successful cloud execution', async () => {
    const authUser: User = {
      id: 'usr_123',
      name: 'Aditi Rao',
      email: 'aditi@example.com',
      isGuest: false,
      createdAt: Date.now(),
    };

    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'garment_1' }]));

    const recordedStates: string[] = [];
    service.onStateChange((state) => {
      recordedStates.push(state);
    });

    const res = await service.executeAccountDeletion(authUser);

    expect(res.success).toBe(true);
    expect(recordedStates).toContain('IDENTITY_VERIFIED');
    expect(recordedStates).toContain('CLOUD_DELETION_IN_PROGRESS');
    expect(recordedStates).toContain('CLOUD_DELETION_CONFIRMED');
    expect(recordedStates).toContain('LOCAL_DATA_WIPE');
    expect(recordedStates).toContain('SESSION_TERMINATED');
    expect(recordedStates).toContain('COMPLETE');

    // Local data is wiped only after cloud confirmation
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
  });

  it('does NOT wipe local data if cloud deletion fails', async () => {
    const authUser: User = {
      id: 'usr_fail',
      name: 'User With Cloud Error',
      isGuest: false,
      createdAt: Date.now(),
    };

    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Cloud service gateway unavailable' },
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
      count: null,
      status: 500,
      statusText: 'Internal Server Error',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'garment_critical' }]));

    const res = await service.executeAccountDeletion(authUser);

    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    // Local data is preserved for retry and safe recovery
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });
});
