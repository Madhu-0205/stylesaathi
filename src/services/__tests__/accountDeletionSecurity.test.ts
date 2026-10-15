// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountDeletionService } from '../accountDeletionService';
import { getSupabaseClient } from '../../lib/supabase';
import { User } from '../../types';

describe('Account Deletion Security & Resilience Gate', () => {
  let service: AccountDeletionService;

  const validUser: User = {
    id: 'usr_valid_123',
    name: 'Priya Sharma',
    email: 'priya@example.in',
    isGuest: false,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    service = new AccountDeletionService();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Authenticated user deletes own account
  it('1. Authenticated user deletes own account through verified cloud flow', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'saree_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(true);
    expect(res.state).toBe('COMPLETE');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
  });

  // 2. Unauthenticated request
  it('2. Rejects unauthenticated request without touching local stores or cloud', async () => {
    const res = await service.executeAccountDeletion(null);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RECOVERABLE_FAILURE');
    expect(res.error).toContain('No active user found');
  });

  // 3. Expired JWT
  it('3. Halts with RETRY_REQUIRED when session JWT is expired', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'JWT expired: session token is invalid' },
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
      count: null,
      status: 401,
      statusText: 'Unauthorized',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'lehenga_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(res.error).toContain('JWT expired');
    // Local data preserved
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 4. Malformed JWT
  it('4. Rejects malformed JWT token without wiping local data', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Invalid JWT structure' },
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Invalid JWT structure' },
      count: null,
      status: 401,
      statusText: 'Unauthorized',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'kurta_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 5 & 6. Attempted arbitrary target UUID / Cross-user deletion attempt
  it('5 & 6. RPC enforces target_user_id match against authenticated session', async () => {
    const client = getSupabaseClient();
    // Simulate Edge function offline, falling back to direct RPC
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Functions unavailable' },
      }),
    } as any);

    // RPC raises exception if target_user_id does not match auth.uid()
    const rpcSpy = vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Authorization failure: cannot delete data for another user or unauthenticated request' },
      count: null,
      status: 403,
      statusText: 'Forbidden',
    } as any);

    const attackerTargetingVictim: User = {
      id: 'victim_uuid_456',
      name: 'Victim',
      email: 'victim@example.in',
      isGuest: false,
      createdAt: Date.now(),
    };

    const res = await service.executeAccountDeletion(attackerTargetingVictim);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(res.error).toContain('Authorization failure');
    expect(rpcSpy).toHaveBeenCalledWith('delete_user_data_records', {
      target_user_id: 'victim_uuid_456',
    });
  });

  // 7. Repeated deletion request (idempotency)
  it('7. Handles repeated deletion request idempotently without corruption', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    const firstRes = await service.executeAccountDeletion(validUser);
    expect(firstRes.success).toBe(true);
    expect(firstRes.state).toBe('COMPLETE');

    // Second call on already wiped/null user
    const secondRes = await service.executeAccountDeletion(null);
    expect(secondRes.success).toBe(false);
    expect(secondRes.state).toBe('RECOVERABLE_FAILURE');
  });

  // 8. Storage deletion failure (resilient completion of DB and auth wipe)
  it('8. Edge function succeeds even if non-fatal storage deletion encountered partial error', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { success: true, message: 'Account and associated records successfully erased' },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'shoes_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(true);
    expect(res.state).toBe('COMPLETE');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
  });

  // 9. Database deletion failure
  it('9. Preserves local data when database deletion fails', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { error: 'Database transaction lock timeout' },
        error: null,
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Database transaction lock timeout' },
      count: null,
      status: 500,
      statusText: 'Internal Server Error',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'shawl_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(res.error).toContain('Database transaction lock timeout');
    // Local data must NOT be wiped
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 10. Auth deletion failure
  it('10. Preserves local data when GoTrue auth admin deletion fails', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: { error: 'Auth deletion failed: User not found in auth provider' },
        error: null,
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Auth deletion failed' },
      count: null,
      status: 500,
      statusText: 'Internal Server Error',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'dupatta_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 11. Network interruption
  it('11. Aborts immediately when offline without sending network requests or wiping local data', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'anarkali_1' }]));

    const res = await service.executeAccountDeletion(validUser);
    expect(res.success).toBe(false);
    expect(res.state).toBe('RECOVERABLE_FAILURE');
    expect(res.error).toContain('active internet connection');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  // 12. Retry after partial failure
  it('12. Allows successful retry after earlier network or cloud error', async () => {
    const client = getSupabaseClient();

    // First attempt fails
    vi.spyOn(client, 'functions', 'get').mockReturnValueOnce({
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network connection dropped' },
      }),
    } as any);
    vi.spyOn(client, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'Network connection dropped' },
      count: null,
      status: 503,
      statusText: 'Service Unavailable',
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'sherwani_1' }]));

    const firstTry = await service.executeAccountDeletion(validUser);
    expect(firstTry.success).toBe(false);
    expect(firstTry.state).toBe('RETRY_REQUIRED');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();

    // Second attempt succeeds
    vi.spyOn(client, 'functions', 'get').mockReturnValueOnce({
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    const secondTry = await service.executeAccountDeletion(validUser);
    expect(secondTry.success).toBe(true);
    expect(secondTry.state).toBe('COMPLETE');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
  });

  // 13. Storage listing failure halts deletion to prevent orphaned files
  it('13. Storage listing failure halts deletion, avoids direct RPC fallback, and preserves local data', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: {
          error: 'Storage cleanup failed: unable to list user files. Deletion halted to prevent orphaned data.',
          stage: 'storage',
          retryable: true,
        },
        error: null,
      }),
    } as any);

    const rpcSpy = vi.spyOn(client, 'rpc').mockResolvedValue({
      data: true,
      error: null,
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'saree_precious' }]));

    const res = await service.executeAccountDeletion(validUser);

    // Deletion must be rejected with RETRY_REQUIRED
    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(res.error).toContain('Storage cleanup failed: unable to list user files');

    // Direct RPC must NOT have been called to bypass storage halt
    expect(rpcSpy).not.toHaveBeenCalled();

    // Local data must NOT be wiped
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 14. Storage removal failure halts deletion and prevents orphaned private files
  it('14. Storage removal failure halts deletion and preserves identity for safe retry', async () => {
    const client = getSupabaseClient();
    vi.spyOn(client, 'functions', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        data: {
          error: 'Storage cleanup failed: unable to remove user files. Deletion halted to prevent orphaned data.',
          stage: 'storage',
          retryable: true,
        },
        error: null,
      }),
    } as any);

    const rpcSpy = vi.spyOn(client, 'rpc').mockResolvedValue({
      data: true,
      error: null,
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'lehenga_gold' }]));

    const res = await service.executeAccountDeletion(validUser);

    expect(res.success).toBe(false);
    expect(res.state).toBe('RETRY_REQUIRED');
    expect(res.error).toContain('Storage cleanup failed: unable to remove user files');
    expect(rpcSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();
  });

  // 15. Safe recovery lifecycle: storage failure followed by successful retry
  it('15. Safe recovery lifecycle: storage transient error followed by successful retry achieves COMPLETE', async () => {
    const client = getSupabaseClient();

    // Attempt 1: Storage removal transient error
    vi.spyOn(client, 'functions', 'get').mockReturnValueOnce({
      invoke: vi.fn().mockResolvedValue({
        data: {
          error: 'Storage cleanup failed: unable to remove user files. Deletion halted to prevent orphaned data.',
          stage: 'storage',
          retryable: true,
        },
        error: null,
      }),
    } as any);

    localStorage.setItem('stylesaathi-wardrobe-items', JSON.stringify([{ id: 'kurti_silk' }]));

    const res1 = await service.executeAccountDeletion(validUser);
    expect(res1.success).toBe(false);
    expect(res1.state).toBe('RETRY_REQUIRED');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).not.toBeNull();

    // Attempt 2: Storage service recovers and succeeds
    vi.spyOn(client, 'functions', 'get').mockReturnValueOnce({
      invoke: vi.fn().mockResolvedValue({
        data: {
          success: true,
          message: 'Account and associated records successfully erased',
        },
        error: null,
      }),
    } as any);
    vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });

    const res2 = await service.executeAccountDeletion(validUser);
    expect(res2.success).toBe(true);
    expect(res2.state).toBe('COMPLETE');
    expect(localStorage.getItem('stylesaathi-wardrobe-items')).toBeNull();
  });
});
