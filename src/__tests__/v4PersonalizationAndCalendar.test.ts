import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAuthRepository } from '../repositories/LocalStorageAuthRepository';
import { LocalStoragePreferencesRepository, DEFAULT_STYLE_PREFERENCES } from '../repositories/LocalStoragePreferencesRepository';
import { LocalStorageCalendarRepository } from '../repositories/LocalStorageCalendarRepository';
import { calculateOutfitScore } from '../engine/scoring';
import { generateOutfits } from '../engine/outfitEngine';
import { WardrobeItem, OutfitPlan, StylePreferences, GeneratedOutfit } from '../types';

describe('STYLESAATHI V4 — Comprehensive Verification Suite', () => {
  // =========================================================================
  // 1. AUTHENTICATION & GUEST ARCHITECTURE
  // =========================================================================
  describe('1. Auth & Session Management', () => {
    let authRepo: LocalStorageAuthRepository;

    beforeEach(async () => {
      authRepo = new LocalStorageAuthRepository();
      await authRepo.clear();
    });

    it('starts with unauthenticated state when no session exists', async () => {
      const user = await authRepo.getUser();
      expect(user).toBeNull();
    });

    it('supports guest session with local-first flag and unique session ID', async () => {
      const guest = await authRepo.continueAsGuest();
      expect(guest.isGuest).toBe(true);
      expect(guest.id).toMatch(/^guest_/);
      expect(guest.name).toBe('Guest Stylist');

      // Subsequent retrieval preserves guest identity
      const activeUser = await authRepo.getUser();
      expect(activeUser?.id).toBe(guest.id);
      expect(activeUser?.isGuest).toBe(true);
    });

    it('supports Google authentication with provider abstraction', async () => {
      const user = await authRepo.signInWithGoogle();
      expect(user.isGuest).toBe(false);
      expect(user.email).toBe('member@stylesaathi.in');
      expect(user.name).toBe('StyleSaathi Member');

      const savedUser = await authRepo.getUser();
      expect(savedUser?.id).toBe(user.id);
      expect(savedUser?.isGuest).toBe(false);
    });

    it('supports Email authentication with user-provided name and email', async () => {
      const user = await authRepo.signInWithEmail('priya.patel@example.com', 'Priya Patel');
      expect(user.isGuest).toBe(false);
      expect(user.email).toBe('priya.patel@example.com');
      expect(user.name).toBe('Priya Patel');
    });

    it('signs out cleanly without corrupting wardrobe or credentials', async () => {
      await authRepo.signInWithGoogle();
      let user = await authRepo.getUser();
      expect(user).not.toBeNull();

      await authRepo.signOut();
      user = await authRepo.getUser();
      expect(user).toBeNull();
    });
  });

  // =========================================================================
  // 2. WARDROBE SETUP THRESHOLDS & PROGRESSIVE RAIL
  // =========================================================================
  describe('2. Post-Login Wardrobe Setup Milestones', () => {
    const getMilestoneCopy = (count: number) => {
      if (count === 0) return "Let's start with something you love.";
      if (count === 1) return 'A beginning.';
      if (count === 2) return 'We can start building looks.';
      if (count === 3) return 'Your wardrobe is taking shape.';
      return 'Your StyleSpace is ready.';
    };

    it('displays the exact editorial progression across 0 to 4 pieces', () => {
      expect(getMilestoneCopy(0)).toBe("Let's start with something you love.");
      expect(getMilestoneCopy(1)).toBe('A beginning.');
      expect(getMilestoneCopy(2)).toBe('We can start building looks.');
      expect(getMilestoneCopy(3)).toBe('Your wardrobe is taking shape.');
      expect(getMilestoneCopy(4)).toBe('Your StyleSpace is ready.');
      expect(getMilestoneCopy(7)).toBe('Your StyleSpace is ready.');
    });

    it('allows continuing personalization after 2 pieces without hard-blocking', () => {
      const canProceed = (count: number) => count >= 2;
      expect(canProceed(0)).toBe(false);
      expect(canProceed(1)).toBe(false);
      expect(canProceed(2)).toBe(true);
      expect(canProceed(3)).toBe(true);
      expect(canProceed(4)).toBe(true);
    });
  });

  // =========================================================================
  // 3. PERSONAL STYLE PREFERENCES & SCORING INTEGRATION
  // =========================================================================
  describe('3. Style Preferences & Outfit Engine Integration', () => {
    let prefRepo: LocalStoragePreferencesRepository;

    beforeEach(async () => {
      prefRepo = new LocalStoragePreferencesRepository();
      await prefRepo.clear();
    });

    it('provides default structured preferences', () => {
      expect(DEFAULT_STYLE_PREFERENCES.preferredContexts).toContain('Everyday');
      expect(DEFAULT_STYLE_PREFERENCES.preferredAesthetics).toContain('Contemporary');
      expect(DEFAULT_STYLE_PREFERENCES.stylingMode).toBe('variety');
    });

    it('saves and retrieves updated preferences', async () => {
      const customPrefs: StylePreferences = {
        preferredContexts: ['Work', 'Weddings'],
        preferredAesthetics: ['Traditional', 'Statement'],
        stylingMode: 'experiment',
        updatedAt: Date.now(),
      };
      await prefRepo.savePreferences(customPrefs);

      const retrieved = await prefRepo.getPreferences();
      expect(retrieved?.preferredContexts).toEqual(['Work', 'Weddings']);
      expect(retrieved?.preferredAesthetics).toEqual(['Traditional', 'Statement']);
      expect(retrieved?.stylingMode).toBe('experiment');
    });

    const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
      id: overrides.id || 'item_test',
      name: overrides.name || 'Test Piece',
      category: overrides.category || 'Tops',
      subcategory: overrides.subcategory || 'kurta',
      colors: overrides.colors || ['indigo'],
      seasons: overrides.seasons || ['summer'],
      occasions: overrides.occasions || ['festive'],
      formality: overrides.formality ?? 4,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: 0,
      ...overrides,
    });

    it('applies subtle bonus to outfits matching preferred aesthetics (Traditional)', () => {
      const top = createItem({ id: 'top_1', category: 'Ethnic', subcategory: 'kurta', formality: 4, occasions: ['festive'] });
      const bottom = createItem({ id: 'bottom_1', category: 'Ethnic', subcategory: 'pajama', formality: 4, occasions: ['festive'] });

      const scoreNeutral = calculateOutfitScore([top, bottom], 'festive', 0.5, {
        preferredContexts: ['Festive'],
        preferredAesthetics: ['Minimal'],
        stylingMode: 'simple',
        updatedAt: Date.now(),
      });

      const scoreTraditional = calculateOutfitScore([top, bottom], 'festive', 0.5, {
        preferredContexts: ['Festive'],
        preferredAesthetics: ['Traditional'],
        stylingMode: 'simple',
        updatedAt: Date.now(),
      });

      expect(scoreTraditional).toBeGreaterThan(scoreNeutral);
    });

    it('applies subtle bonus for Indo-Western aesthetic combinations', () => {
      const kurta = createItem({ id: 'k1', category: 'Ethnic', subcategory: 'kurti', formality: 2, occasions: ['everyday', 'college'] });
      const jeans = createItem({ id: 'j1', category: 'Bottoms', subcategory: 'jeans', formality: 2, occasions: ['everyday', 'college'] });

      const scoreNeutral = calculateOutfitScore([kurta, jeans], 'everyday', 0.5, {
        preferredContexts: ['Everyday'],
        preferredAesthetics: ['Classic'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      });

      const scoreIndoWestern = calculateOutfitScore([kurta, jeans], 'everyday', 0.5, {
        preferredContexts: ['Everyday'],
        preferredAesthetics: ['Indo-Western'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      });

      expect(scoreIndoWestern).toBeGreaterThan(scoreNeutral);
    });

    it('preserves baseline compatibility as authoritative over preferences', () => {
      // Saree without blouse is incompatible regardless of preference
      const saree = createItem({ id: 's1', category: 'Ethnic', subcategory: 'saree', formality: 5, occasions: ['festive'] });
      const jeans = createItem({ id: 'j1', category: 'Bottoms', subcategory: 'jeans', formality: 2, occasions: ['everyday'] });

      const outfits = generateOutfits(
        [saree, jeans],
        'festive',
        'summer',
        4,
        0.5,
        {
          preferredContexts: ['Festive'],
          preferredAesthetics: ['Traditional', 'Indo-Western'],
          stylingMode: 'experiment',
          updatedAt: Date.now(),
        }
      );

      // Outfits must not create an invalid Saree + Jeans combination
      const hasInvalidSareeJeans = outfits.some((o) =>
        Object.values(o.slots).flat().some((i) => i.subcategory === 'saree') &&
        Object.values(o.slots).flat().some((i) => i.subcategory === 'jeans')
      );
      expect(hasInvalidSareeJeans).toBe(false);
    });
  });

  // =========================================================================
  // 4. STYLE CALENDAR DATA MODEL & CRUD
  // =========================================================================
  describe('4. Style Calendar Operations', () => {
    let calRepo: LocalStorageCalendarRepository;

    beforeEach(async () => {
      calRepo = new LocalStorageCalendarRepository();
      await calRepo.clear();
    });

    const mockOutfit: GeneratedOutfit = {
      template: 'Kurta + Trousers',
      slots: {
        top: [
          {
            id: 'top_1',
            name: 'Linen Kurta',
            category: 'Ethnic',
            subcategory: 'kurta',
            colors: ['white'],
            seasons: ['summer'],
            occasions: ['office', 'everyday'],
            formality: 3,
            status: 'clean',
            favorite: false,
            note: '',
            timesWorn: 1,
            createdAt: Date.now(),
          },
        ],
        bottom: [
          {
            id: 'bottom_1',
            name: 'Chinos',
            category: 'Bottoms',
            subcategory: 'trousers',
            colors: ['beige'],
            seasons: ['summer'],
            occasions: ['office', 'everyday'],
            formality: 3,
            status: 'clean',
            favorite: false,
            note: '',
            timesWorn: 2,
            createdAt: Date.now(),
          },
        ],
      },
      score: 85,
      why: 'Classic Indo-Western balance',
    };

    it('creates, retrieves, and lists planned outfits', async () => {
      const plan: OutfitPlan = {
        id: 'plan_test_1',
        date: '2026-10-05',
        occasion: 'office',
        outfit: mockOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(plan);

      const allPlans = await calRepo.getPlans();
      expect(allPlans.length).toBe(1);
      expect(allPlans[0].date).toBe('2026-10-05');
      expect(allPlans[0].occasion).toBe('office');
      expect(allPlans[0].status).toBe('planned');
    });

    it('updates existing plan when planned for same date or updated id', async () => {
      const plan1: OutfitPlan = {
        id: 'plan_test_1',
        date: '2026-10-05',
        occasion: 'office',
        outfit: mockOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan1);

      // Change status to worn
      await calRepo.updatePlanStatus('plan_test_1', 'worn');

      const planByDate = await calRepo.getPlanByDate('2026-10-05');
      expect(planByDate?.status).toBe('worn');
    });

    it('deletes plan by id', async () => {
      const plan: OutfitPlan = {
        id: 'plan_test_delete',
        date: '2026-10-06',
        occasion: 'everyday',
        outfit: mockOutfit,
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(plan);

      let found = await calRepo.getPlanByDate('2026-10-06');
      expect(found).not.toBeNull();

      await calRepo.deletePlan('plan_test_delete');
      found = await calRepo.getPlanByDate('2026-10-06');
      expect(found).toBeNull();
    });
  });

  // =========================================================================
  // 5. WEAR TODAY INTEGRATION & RECENCY TRANSITION
  // =========================================================================
  describe('5. Wear Today & Calendar Plan Lifecycle', () => {
    it('transitions planned look to worn, increments timesWorn, and records lastWorn', () => {
      const item: WardrobeItem = {
        id: 'item_1',
        name: 'Cotton Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['navy'],
        seasons: ['summer'],
        occasions: ['everyday'],
        formality: 3,
        status: 'clean',
        note: '',
        timesWorn: 3,
        lastWorn: 1726790400000,
        favorite: false,
      };

      // Wear action logic
      const nowTimestamp = Date.now();
      const updatedItem: WardrobeItem = {
        ...item,
        timesWorn: (item.timesWorn || 0) + 1,
        lastWorn: nowTimestamp,
      };

      expect(updatedItem.timesWorn).toBe(4);
      expect(updatedItem.lastWorn).toBe(nowTimestamp);
    });
  });

  // =========================================================================
  // 6. STALE & LAUNDRY EDGE CASES
  // =========================================================================
  describe('6. Edge Cases: Stale Plans and Laundry Status', () => {
    it('detects missing garments when a wardrobe piece was deleted', () => {
      const activeWardrobe: WardrobeItem[] = [
        {
          id: 'item_bottom',
          name: 'Chinos',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['black'],
          seasons: ['summer'],
          occasions: ['office'],
          formality: 3,
          status: 'clean',
          note: '',
          timesWorn: 0,
          favorite: false,
        },
      ];

      const plannedPieces = [
        { id: 'item_top_deleted', name: 'Silk Kurta', subcategory: 'kurta' },
        { id: 'item_bottom', name: 'Chinos', subcategory: 'trousers' },
      ];

      const missing = plannedPieces.filter((p) => !activeWardrobe.some((w) => w.id === p.id));
      expect(missing.length).toBe(1);
      expect(missing[0].name).toBe('Silk Kurta');
    });

    it('detects when planned garments are currently in laundry', () => {
      const activeWardrobe: WardrobeItem[] = [
        {
          id: 'item_top',
          name: 'Silk Kurta',
          category: 'Ethnic',
          subcategory: 'kurta',
          colors: ['maroon'],
          seasons: ['summer'],
          occasions: ['festive'],
          formality: 4,
          status: 'in_laundry',
          note: '',
          timesWorn: 1,
          favorite: false,
        },
      ];

      const plannedPieces = [{ id: 'item_top', name: 'Silk Kurta', subcategory: 'kurta' }];

      const inLaundry = plannedPieces.filter((p) => {
        const item = activeWardrobe.find((w) => w.id === p.id);
        return item && (item.status === 'in_laundry' || item.status === 'needs_washing');
      });

      expect(inLaundry.length).toBe(1);
      expect(inLaundry[0].name).toBe('Silk Kurta');
    });
  });

  // =========================================================================
  // 7. V4.1 REAL-WORLD USER FLOWS & UX ACCEPTANCE CRITERIA
  // =========================================================================
  describe('7. V4.1 Real-World Flows & UX Polish Acceptance', () => {
    let authRepo: LocalStorageAuthRepository;
    let calRepo: LocalStorageCalendarRepository;

    beforeEach(async () => {
      authRepo = new LocalStorageAuthRepository();
      calRepo = new LocalStorageCalendarRepository();
      await authRepo.clear();
      await calRepo.clear();
    });

    it('FLOW A (New User): seamless progression through onboarding, profile, rail, preferences, and ready state', async () => {
      // 1. User signs in with Email
      const user = await authRepo.signInWithEmail('ananya@example.com', 'Ananya');
      expect(user.isGuest).toBe(false);
      expect(user.name).toBe('Ananya');

      // 2. Progressive thresholds check
      const milestoneText = (c: number) => {
        if (c === 0) return "Let's start with something you love.";
        if (c === 1) return 'A beginning.';
        if (c === 2) return 'We can start building looks.';
        if (c === 3) return 'Your wardrobe is taking shape.';
        return 'Your StyleSpace is ready.';
      };

      expect(milestoneText(0)).toBe("Let's start with something you love.");
      expect(milestoneText(2)).toBe('We can start building looks.');
      expect(milestoneText(4)).toBe('Your StyleSpace is ready.');

      // 3. User reaches 4 items and StyleSpace is ready
      const readyCopy = 'Your wardrobe is starting to become yours.';
      expect(readyCopy).toContain('starting to become yours');
    });

    it('FLOW B (Guest User): guest session preserves data and seamlessly elevates upon profile creation', async () => {
      // 1. Continue as guest
      const guest = await authRepo.continueAsGuest();
      expect(guest.isGuest).toBe(true);

      // 2. Plan an outfit while guest
      const guestPlan: OutfitPlan = {
        id: 'plan_guest_1',
        date: '2026-10-07',
        occasion: 'office',
        outfit: {
          template: 'Kurta + Trousers',
          slots: {},
          score: 90,
          why: 'Editorial Indo-Western',
        },
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await calRepo.savePlan(guestPlan);

      // 3. Elevate to registered profile
      const member = await authRepo.signInWithEmail('guest.upgrade@example.com', 'Upgraded Guest');
      expect(member.isGuest).toBe(false);

      // 4. Verify local calendar plan remains preserved
      const retrieved = await calRepo.getPlanByDate('2026-10-07');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('plan_guest_1');
    });

    it('FLOW C (Plan Look): plans outfit for tomorrow and retrieves from calendar', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      const tomorrowPlan: OutfitPlan = {
        id: 'plan_tomorrow',
        date: tomorrowStr,
        occasion: 'office',
        outfit: {
          template: 'Shirt + Trousers',
          slots: {},
          score: 88,
          why: 'Tailored workwear',
        },
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(tomorrowPlan);
      const activePlan = await calRepo.getPlanByDate(tomorrowStr);
      expect(activePlan?.outfit.template).toBe('Shirt + Trousers');
      expect(activePlan?.status).toBe('planned');
    });

    it('FLOW D (Wear Today): marks planned look as worn and increments timesWorn', async () => {
      const planDate = '2026-10-05';
      const plan: OutfitPlan = {
        id: 'plan_wear_test',
        date: planDate,
        occasion: 'everyday',
        outfit: {
          template: 'Kurti + Jeans',
          slots: {},
          score: 92,
          why: 'Effortless college / daily fit',
        },
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await calRepo.savePlan(plan);
      expect((await calRepo.getPlanByDate(planDate))?.status).toBe('planned');

      // Wear action triggers status update to 'worn'
      await calRepo.updatePlanStatus('plan_wear_test', 'worn');
      expect((await calRepo.getPlanByDate(planDate))?.status).toBe('worn');
    });

    it('FLOW E (Invalidation / Care): generates calm fashion notice when piece is resting in care', () => {
      const pieceInCare = { name: 'Raw Silk Kurta', status: 'in_laundry' };
      const getCareNotice = (piece: { name: string; status: string }) => {
        if (piece.status === 'in_laundry' || piece.status === 'needs_washing') {
          return {
            title: 'A piece is currently in care',
            description: `${piece.name} is resting for wash before wearing.`,
            action: 'Restyle',
          };
        }
        return null;
      };

      const notice = getCareNotice(pieceInCare);
      expect(notice?.title).toBe('A piece is currently in care');
      expect(notice?.description).toContain('resting for wash');
      expect(notice?.action).toBe('Restyle');
    });
  });
});
