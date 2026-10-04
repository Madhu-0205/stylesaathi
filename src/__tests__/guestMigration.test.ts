import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncService } from '../lib/sync/syncService';
import { wardrobeRepository } from '../repositories/LocalStorageWardrobeRepository';
import { calendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { preferencesRepository } from '../repositories/LocalStoragePreferencesRepository';
import { wearEventsRepository } from '../repositories/LocalStorageWearEventsRepository';
import { User, WardrobeItem, OutfitPlan } from '../types';

// Mock Supabase client to inspect migration calls
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.mock/item.jpg' }, error: null });

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    from: (table: string) => ({
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
        upload: mockStorageUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

describe('Production Guest -> Account Migration', () => {
  const targetUser: User = {
    id: 'user_auth_12345',
    email: 'ananya@example.com',
    name: 'Ananya Sharma',
    isGuest: false,
    createdAt: Date.now(),
  };

  const sampleGuestItem: WardrobeItem = {
    id: 'guest-item-1',
    name: 'Indigo Cotton Kurti',
    category: 'Ethnic',
    subcategory: 'kurti',
    colors: ['indigo'],
    seasons: ['summer'],
    occasions: ['college', 'everyday'],
    formality: 2,
    status: 'clean',
    favorite: true,
    note: 'College staple',
    timesWorn: 3,
    createdAt: 1000,
  };

  const sampleGuestPlan: OutfitPlan = {
    id: 'guest-plan-1',
    date: '2026-10-20',
    outfit: { template: 'Casual', slots: {}, score: 4.5, why: 'Easy everyday look' },
    occasion: 'college',
    status: 'planned',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    syncService.clearMemoryStorage();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await wardrobeRepository.clear();
    await calendarRepository.clear();
    await preferencesRepository.clear();
    await wearEventsRepository.clear();

    // Populate guest data
    await wardrobeRepository.addItem(sampleGuestItem);
    await calendarRepository.savePlan(sampleGuestPlan);
    await preferencesRepository.savePreferences({
      preferredContexts: ['College'],
      preferredAesthetics: ['Indo-Western'],
      stylingMode: 'variety',
      updatedAt: 1000,
    });
    await wearEventsRepository.addEvent({
      id: 'wear-evt-1',
      userId: 'guest',
      wardrobeItemId: 'guest-item-1',
      wornAt: 1000,
      createdAt: 1000,
    });
  });

  it('migrates all guest entities to the authenticated account', async () => {
    await syncService.migrateGuestData(targetUser);

    // Verify wardrobe upsert called with targetUser.id
    expect(mockUpsert).toHaveBeenCalled();
    const wardrobeCalls = mockUpsert.mock.calls.filter(([arg]) => arg.id === 'guest-item-1');
    expect(wardrobeCalls.length).toBeGreaterThanOrEqual(1);
    expect(wardrobeCalls[0][0].user_id).toBe(targetUser.id);
    expect(wardrobeCalls[0][0].name).toBe('Indigo Cotton Kurti');

    // Local items must still exist and have userId set to authenticated user
    const localItems = await wardrobeRepository.getItems();
    expect(localItems).toHaveLength(1);
    expect(localItems[0].userId).toBe(targetUser.id);
  });

  // ==========================================================================
  // G. Guest Migration Interrupted Midway
  // ==========================================================================
  describe('G. Guest migration interrupted midway', () => {
    it('does NOT wipe local data if cloud call fails midway, and records failure state safely', async () => {
      // Simulate network / server crash during wardrobe upsert
      mockUpsert.mockRejectedValueOnce(new Error('Cloud connection dropped midway'));

      await syncService.migrateGuestData(targetUser);

      // Local records must NOT be lost!
      const items = await wardrobeRepository.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Indigo Cotton Kurti');

      const plans = await calendarRepository.getPlans();
      expect(plans).toHaveLength(1);

      const prefs = await preferencesRepository.getPreferences();
      expect(prefs?.preferredContexts).toEqual(['College']);

      // Migration state should record failure for resume
      const storedState = JSON.parse(
        syncService.getStorageItem(`stylesaathi-migration-${targetUser.id}`) || '{}'
      );
      expect(storedState.status).toBe('FAILED');
      expect(storedState.lastError).toContain('Cloud connection dropped midway');
    });

    it('resumes safely from the previous completed steps without restarting from scratch', async () => {
      // Pre-set migration state where IMAGES and WARDROBE succeeded, but CALENDAR was interrupted
      const stateKey = `stylesaathi-migration-${targetUser.id}`;
      syncService.setStorageItem(
        stateKey,
        JSON.stringify({
          status: 'FAILED',
          completedSteps: ['IMAGES', 'WARDROBE'],
          updatedAt: Date.now(),
        })
      );

      mockUpsert.mockResolvedValue({ error: null });

      // Run migration resume
      await syncService.migrateGuestData(targetUser);

      const finalState = JSON.parse(syncService.getStorageItem(stateKey) || '{}');
      expect(finalState.status).toBe('COMPLETE');
      expect(finalState.completedSteps).toContain('CALENDAR');
      expect(finalState.completedSteps).toContain('PREFERENCES');
      expect(finalState.completedSteps).toContain('WEAR_EVENTS');

      // Local data is preserved
      const items = await wardrobeRepository.getItems();
      expect(items).toHaveLength(1);
    });
  });

  // ==========================================================================
  // H. Guest Migration Retry/Idempotency
  // ==========================================================================
  describe('H. Guest migration retry/idempotency', () => {
    it('is completely idempotent when run multiple times on the same account', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      // First run
      await syncService.migrateGuestData(targetUser);
      const firstCallCount = mockUpsert.mock.calls.length;

      // Second run immediately after
      await syncService.migrateGuestData(targetUser);

      // Status was already COMPLETE, so no extra cloud calls needed
      expect(mockUpsert.mock.calls.length).toBe(firstCallCount);

      // Local data still intact
      const localItems = await wardrobeRepository.getItems();
      expect(localItems).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 8. Guest -> Account Full Lifecycle Data Retention
  // ==========================================================================
  describe('8. Guest -> Account Full Lifecycle Data Retention', () => {
    it('preserves all items, images, favorites, plans, and wear events across auth, migration, refresh, and re-login', async () => {
      // 1. Guest adds 3 wardrobe items
      const item1: WardrobeItem = {
        id: 'guest-kurta-1',
        name: 'Chikankari Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['white'],
        seasons: ['summer'],
        occasions: ['festive', 'everyday'],
        formality: 3,
        status: 'clean',
        favorite: true,
        note: 'Lucknowi embroidery',
        timesWorn: 0,
        photoId: 'photo-chikankari',
        photoUrl: 'blob:http://localhost/photo-chikankari',
      };

      const item2: WardrobeItem = {
        id: 'guest-jeans-2',
        name: 'Slim Fit Blue Denim',
        category: 'Bottoms',
        subcategory: 'jeans',
        colors: ['blue'],
        seasons: ['summer'],
        occasions: ['everyday'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
      };

      const item3: WardrobeItem = {
        id: 'guest-dupatta-3',
        name: 'Phulkari Dupatta',
        category: 'Ethnic',
        subcategory: 'dupatta',
        colors: ['red', 'yellow'],
        seasons: ['summer'],
        occasions: ['festive', 'wedding guest'],
        formality: 4,
        status: 'clean',
        favorite: true,
        note: '',
        timesWorn: 0,
      };

      await wardrobeRepository.clear();
      await calendarRepository.clear();
      await wearEventsRepository.clear();
      await wardrobeRepository.addItem(item1);
      await wardrobeRepository.addItem(item2);
      await wardrobeRepository.addItem(item3);

      // 2. Plan outfit and mark worn
      const plan: OutfitPlan = {
        id: 'plan-guest-festive',
        date: '2026-10-25',
        outfit: {
          template: 'Indo-Western Fusion',
          slots: { top: [item1], bottom: [item2], accessory: [item3] },
          score: 4.8,
          why: 'Fusion festive daytime look',
        },
        occasion: 'festive',
        status: 'worn',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calendarRepository.savePlan(plan);

      // 3. Create wear event for worn garment
      await wearEventsRepository.addEvent({
        id: 'wear-evt-guest-01',
        userId: 'guest',
        wardrobeItemId: 'guest-kurta-1',
        outfitId: 'plan-guest-festive',
        plannedDate: '2026-10-25',
        wornAt: Date.now(),
        createdAt: Date.now(),
      });

      // 4. Authenticate & Migrate
      mockUpsert.mockResolvedValue({ error: null });
      await syncService.migrateGuestData(targetUser);

      // 5. Simulate browser refresh / re-hydration
      const itemsAfterMigration = await wardrobeRepository.getItems();
      expect(itemsAfterMigration).toHaveLength(3);
      expect(itemsAfterMigration.find((i) => i.id === 'guest-kurta-1')?.favorite).toBe(true);
      expect(itemsAfterMigration.find((i) => i.id === 'guest-kurta-1')?.userId).toBe(targetUser.id);

      const plansAfterMigration = await calendarRepository.getPlans();
      expect(plansAfterMigration).toHaveLength(1);
      expect(plansAfterMigration[0].status).toBe('worn');

      const wearAfterMigration = await wearEventsRepository.getEvents();
      expect(wearAfterMigration).toHaveLength(1);
      expect(wearAfterMigration[0].wardrobeItemId).toBe('guest-kurta-1');

      // 6. Simulate logout (switching to unauthenticated session)
      syncService.setCurrentUser(null);

      // 7. Simulate login again with targetUser
      syncService.setCurrentUser(targetUser);
      const itemsAfterRelogin = await wardrobeRepository.getItems();
      expect(itemsAfterRelogin).toHaveLength(3);
      expect(itemsAfterRelogin.every((i) => i.userId === targetUser.id)).toBe(true);

      const wearAfterRelogin = await wearEventsRepository.getEvents();
      expect(wearAfterRelogin).toHaveLength(1);
    });
  });
});

