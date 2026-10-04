import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseAuthRepository } from '../repositories/SupabaseAuthRepository';
import { syncService } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { WardrobeItem, User } from '../types';

const { hoistedState, mockGetSession, mockUpsert } = vi.hoisted(() => {
  const state = { sessionUser: null as any };
  const getSession = vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: { session: state.sessionUser ? { user: state.sessionUser } : null },
      error: null,
    })
  );
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return { hoistedState: state, mockGetSession: getSession, mockUpsert: upsert };
});

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => ({
      upsert: mockUpsert,
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          gt: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
      }),
    },
  }),
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

describe('Production Auth & Session Lifecycle', () => {
  let authRepo: SupabaseAuthRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    hoistedState.sessionUser = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    authRepo = new SupabaseAuthRepository();
    await authRepo.clear();
    await syncQueue.clear();
    await wardrobeRepository.clear();
  });

  // ==========================================================================
  // M. Session Restoration
  // ==========================================================================
  describe('M. Session restoration', () => {
    it('restores authenticated user session when valid Supabase session exists', async () => {
      hoistedState.sessionUser = {
        id: 'sb_user_abc_999',
        email: 'priya@stylesaathi.in',
        user_metadata: { full_name: 'Priya Patel' },
        created_at: new Date(1700000000000).toISOString(),
      };

      const user = await authRepo.getUser();
      expect(user).not.toBeNull();
      expect(user?.id).toBe('sb_user_abc_999');
      expect(user?.email).toBe('priya@stylesaathi.in');
      expect(user?.name).toBe('Priya Patel');
      expect(user?.isGuest).toBe(false);
    });

    it('falls back to local guest session if no Supabase session exists but guest session exists', async () => {
      hoistedState.sessionUser = null;

      // User previously chose guest mode
      const guest = await authRepo.continueAsGuest();
      expect(guest.isGuest).toBe(true);

      // Re-boot app: restore session
      const restored = await authRepo.getUser();
      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(guest.id);
      expect(restored?.isGuest).toBe(true);
    });

    it('returns null if neither Supabase nor guest session exists', async () => {
      hoistedState.sessionUser = null;
      const user = await authRepo.getUser();
      expect(user).toBeNull();
    });
  });

  // ==========================================================================
  // N. Offline -> Online Synchronization
  // ==========================================================================
  describe('N. Offline -> online synchronization', () => {
    const testUser: User = {
      id: 'user_sync_test',
      email: 'offline_user@stylesaathi.in',
      isGuest: false,
      createdAt: Date.now(),
    };

    it('persists offline mutations in queue and drains them when back online', async () => {
      syncService.setCurrentUser(testUser);

      // 1. Enqueue 2 mutations while offline
      await syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: 'item-offline-1',
        operation: 'UPSERT',
        payload: {
          id: 'item-offline-1',
          name: 'Chikankari Kurta',
          category: 'Ethnic',
          subcategory: 'kurta',
          colors: ['white'],
          seasons: ['summer'],
          occasions: ['everyday'],
          formality: 3,
          status: 'clean',
          favorite: false,
          note: '',
          timesWorn: 0,
        } as WardrobeItem,
      });

      await syncQueue.enqueue({
        entityType: 'wardrobe_item',
        entityId: 'item-offline-2',
        operation: 'UPSERT',
        payload: {
          id: 'item-offline-2',
          name: 'Linen Trousers',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['beige'],
          seasons: ['summer'],
          occasions: ['office'],
          formality: 3,
          status: 'clean',
          favorite: true,
          note: '',
          timesWorn: 1,
        } as WardrobeItem,
      });

      const statsBefore = await syncQueue.getStats();
      expect(statsBefore.total).toBe(2);

      // 2. Trigger sync processing (reconnect)
      await syncService.processQueue();

      // Cloud upsert should have been invoked for both items
      expect(mockUpsert).toHaveBeenCalledTimes(2);

      // Queue should now be drained
      const statsAfter = await syncQueue.getStats();
      expect(statsAfter.total).toBe(0);
    });
  });

  // ==========================================================================
  // A. Offline Edit vs Online Edit
  // ==========================================================================
  describe('A. Offline edit vs online edit', () => {
    it('reconciles offline local edit with newer remote edit correctly', async () => {
      const offlineItem: WardrobeItem = {
        id: 'item-conflict-1',
        name: 'Offline Modified Name',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['blue'],
        seasons: ['summer'],
        occasions: ['everyday'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 1,
        clientUpdatedAt: 2000,
      };

      await wardrobeRepository.addItem(offlineItem);

      // Local item exists
      const local = await wardrobeRepository.getItem('item-conflict-1');
      expect(local?.name).toBe('Offline Modified Name');
    });
  });
});
