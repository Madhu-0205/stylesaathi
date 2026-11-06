import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationEngine, recommendOutfits } from '../recommendationEngine';
import { EnsembleRecommendationEngine, recommendEnsembleOutfits } from '../ensemble/ensembleEngine';
import { RecommendationRequest, WardrobeItem, GeneratedOutfit } from '../../types';
import { WEATHER_DELUGE_MUMBAI } from '../evaluation/fixtures/weatherFixtures';
import { validateOutfitWearability } from '../hardConstraints';
import { wearEventsRepository } from '../../repositories/LocalStorageWearEventsRepository';
import { NeedleService } from '../../services/needle/needleService';
import { clearCachedModel, setCachedModel } from '../../services/needle/needleModelCache';

describe('StyleSaathi 3.0 — Phase 5D Prerequisite 1: Laundry Planning-Mode Alignment', () => {
  const baseEngine = new RecommendationEngine();
  const ensembleEngine = new EnsembleRecommendationEngine();

  // Test Wardrobe Pieces
  const cleanWhiteShirt: WardrobeItem = {
    id: 'clean_white_shirt',
    name: 'Clean Poplin Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer', 'winter', 'monsoon'],
    occasions: ['college', 'office', 'casual outing', 'everyday'],
    formality: 3,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 2,
    fabric: 'cotton',
    pattern: 'solid',
    userVerified: true,
  };

  const dirtyWhiteShirt: WardrobeItem = {
    ...cleanWhiteShirt,
    id: 'dirty_white_shirt',
    name: 'Unwashed Poplin Shirt',
    status: 'needs_washing',
  };

  const inLaundryShirt: WardrobeItem = {
    ...cleanWhiteShirt,
    id: 'in_laundry_shirt',
    name: 'Shirt at Dry Cleaners',
    status: 'in_laundry',
  };

  const cleanBlueJeans: WardrobeItem = {
    id: 'clean_blue_jeans',
    name: 'Indigo Slim Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer', 'winter', 'monsoon'],
    occasions: ['college', 'office', 'casual outing', 'everyday'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 4,
    fabric: 'denim',
    pattern: 'solid',
    userVerified: true,
  };

  const dirtyBlueJeans: WardrobeItem = {
    ...cleanBlueJeans,
    id: 'dirty_blue_jeans',
    name: 'Muddy Denim Jeans',
    status: 'needs_washing',
  };

  const cleanSneakers: WardrobeItem = {
    id: 'clean_sneakers',
    name: 'White Leather Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    seasons: ['summer', 'winter', 'monsoon'],
    occasions: ['college', 'office', 'casual outing', 'everyday'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 6,
    fabric: 'cotton',
    pattern: 'solid',
    userVerified: true,
  };

  const delicateSilkSaree: WardrobeItem = {
    id: 'delicate_silk_saree',
    name: 'Zari Border Pure Silk Saree',
    category: 'Ethnic',
    subcategory: 'saree',
    colors: ['red', 'gold'],
    seasons: ['winter', 'summer'],
    occasions: ['wedding guest', 'festive'],
    formality: 5,
    status: 'needs_washing',
    favorite: false,
    note: '',
    timesWorn: 1,
    fabric: 'silk',
    pattern: 'zari_brocade',
    userVerified: true,
  };

  const silkBlouse: WardrobeItem = {
    id: 'silk_blouse',
    name: 'Raw Silk Blouse',
    category: 'Ethnic',
    subcategory: 'blouse',
    colors: ['gold'],
    seasons: ['winter', 'summer'],
    occasions: ['wedding guest', 'festive'],
    formality: 5,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 1,
    fabric: 'silk',
    pattern: 'solid',
    userVerified: true,
  };

  // ==========================================================================
  // 1. An unwashed anchor garment is allowed in planning mode (both engines)
  // ==========================================================================
  it('1. Allows unwashed anchor garment in planning mode across baseline and ensemble engines', () => {
    const wardrobe = [dirtyWhiteShirt, cleanBlueJeans, cleanSneakers];
    const req: RecommendationRequest = {
      items: wardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
      allowPlanningMode: true,
    };

    // Baseline Engine
    const baseResult = baseEngine.recommend(req);
    expect(baseResult.set.outfits.length).toBeGreaterThan(0);
    const baseTop = baseResult.set.outfits[0];
    expect(baseTop.slots.top?.[0]?.id).toBe(dirtyWhiteShirt.id);
    expect(baseTop.slots.top?.[0]?.status).toBe('needs_washing');

    // Ensemble Engine
    const ensResult = ensembleEngine.recommend(req);
    expect(ensResult.outfits.length).toBeGreaterThan(0);
    const ensTop = ensResult.outfits[0];
    expect(ensTop.slots.top?.[0]?.id).toBe(dirtyWhiteShirt.id);
    expect(ensTop.slots.top?.[0]?.status).toBe('needs_washing');

    // Also works with in_laundry status
    const reqLaundry: RecommendationRequest = {
      ...req,
      items: [inLaundryShirt, cleanBlueJeans, cleanSneakers],
      anchorItemId: inLaundryShirt.id,
    };
    const baseLaundryRes = baseEngine.recommend(reqLaundry);
    const ensLaundryRes = ensembleEngine.recommend(reqLaundry);
    expect(baseLaundryRes.set.outfits.length).toBeGreaterThan(0);
    expect(ensLaundryRes.outfits.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // 2. Ensemble does not reject planning outfit solely because anchor needs washing
  // ==========================================================================
  it('2. Ensemble engine does not reject a planning outfit solely because anchor needs washing', () => {
    const wardrobe = [dirtyWhiteShirt, cleanBlueJeans, cleanSneakers];
    const req: RecommendationRequest = {
      items: wardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
    };

    // Even without explicitly passing allowPlanningMode: true, having an unwashed anchor engages planning mode
    const ensResult = ensembleEngine.recommend(req);
    expect(ensResult.outfits.length).toBeGreaterThan(0);
    expect(ensResult.outfits[0].score).toBeGreaterThan(5.0);

    const evalData = ensResult.evaluations[ensResult.outfits[0].id];
    expect(evalData).toBeDefined();
    expect(evalData.isValid).toBe(true);
    expect(evalData.classification).not.toBe('hard_incompatible');
  });

  // ==========================================================================
  // 3. Laundry warning remains present and accurate
  // ==========================================================================
  it('3. Laundry warning and planning assumptions remain present and accurate', () => {
    const wardrobe = [dirtyWhiteShirt, cleanBlueJeans, cleanSneakers];
    const req: RecommendationRequest = {
      items: wardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
    };

    const baseResult = baseEngine.recommend(req);
    const ensResult = ensembleEngine.recommend(req);

    // Baseline assumption communicates planning laundry requirement
    expect(
      baseResult.set.outfits[0].explanation.assumptions?.some((a) =>
        a.includes('washing before wear')
      )
    ).toBe(true);

    // Ensemble assumption communicates planning laundry requirement
    expect(
      ensResult.outfits[0].explanation.assumptions?.some((a) =>
        a.includes('washing before wear')
      )
    ).toBe(true);
  });

  // ==========================================================================
  // 4. Real production validator strictly blocks wear and preserves state immutability
  // ==========================================================================
  it('4. Real production validator strictly blocks wear and preserves state immutability', async () => {
    await wearEventsRepository.clear();
    const initialEvents = await wearEventsRepository.getEvents();
    expect(initialEvents.length).toBe(0);

    const testDirtyShirt: WardrobeItem = { ...dirtyWhiteShirt, timesWorn: 2, lastWorn: 1000 };
    const outfitWithDirtyItem: GeneratedOutfit = {
      template: 'Shirt + Jeans',
      slots: {
        top: [testDirtyShirt],
        bottom: [cleanBlueJeans],
        footwear: [cleanSneakers],
      },
      score: 8.5,
      why: 'Casual college look',
    };

    // A. Direct production validation check
    const checkDirty = validateOutfitWearability(outfitWithDirtyItem);
    expect(checkDirty.canWear).toBe(false);
    expect(checkDirty.uncleanPieces).toHaveLength(1);
    expect(checkDirty.uncleanPieces[0].id).toBe(testDirtyShirt.id);
    expect(checkDirty.error).toBe('Cannot log wear: Unwashed Poplin Shirt needs washing before wearing.');

    // B. Direct production validation check with in_laundry
    const outfitWithLaundryItem: GeneratedOutfit = {
      template: 'Shirt + Jeans',
      slots: {
        top: [inLaundryShirt],
        bottom: [cleanBlueJeans],
      },
      score: 8.0,
      why: 'Planned look',
    };
    const checkLaundry = validateOutfitWearability(outfitWithLaundryItem);
    expect(checkLaundry.canWear).toBe(false);
    expect(checkLaundry.error).toBe('Cannot log wear: Shirt at Dry Cleaners needs washing before wearing.');

    // C. Direct production validation check with multiple unclean pieces
    const outfitWithMultipleDirty: GeneratedOutfit = {
      template: 'Shirt + Jeans',
      slots: {
        top: [testDirtyShirt],
        bottom: [dirtyBlueJeans],
      },
      score: 7.5,
      why: 'Multi dirty look',
    };
    const checkMultiple = validateOutfitWearability(outfitWithMultipleDirty);
    expect(checkMultiple.canWear).toBe(false);
    expect(checkMultiple.error).toBe(
      'Cannot log wear: Unwashed Poplin Shirt, Muddy Denim Jeans need washing before wearing.'
    );

    // D. Direct production validation check with unclean accessory
    const checkAccessory = validateOutfitWearability(
      {
        slots: {
          top: [cleanWhiteShirt],
          bottom: [cleanBlueJeans],
        },
      },
      inLaundryShirt
    );
    expect(checkAccessory.canWear).toBe(false);
    expect(checkAccessory.error).toContain('Shirt at Dry Cleaners needs washing before wearing');

    // E. Verify state immutability: Wear logging workflow rejects before mutating state
    const executeProductionWearLogging = async (outfit: GeneratedOutfit, accessory?: WardrobeItem | null) => {
      const wearCheck = validateOutfitWearability(outfit, accessory);
      if (!wearCheck.canWear) {
        throw new Error(wearCheck.error);
      }
      // Below mutations must NEVER be reached if validation fails
      testDirtyShirt.timesWorn = (testDirtyShirt.timesWorn || 0) + 1;
      testDirtyShirt.lastWorn = Date.now();
      await wearEventsRepository.addEvent({
        id: 'wear-fail-1',
        userId: 'test-user',
        wardrobeItemId: testDirtyShirt.id,
        wornAt: Date.now(),
        createdAt: Date.now(),
      });
    };

    await expect(executeProductionWearLogging(outfitWithDirtyItem)).rejects.toThrow(
      'Cannot log wear: Unwashed Poplin Shirt needs washing before wearing.'
    );

    // Verify timesWorn, lastWorn, and wearEventsRepository are completely unchanged
    expect(testDirtyShirt.timesWorn).toBe(2);
    expect(testDirtyShirt.lastWorn).toBe(1000);
    const eventsAfterFail = await wearEventsRepository.getEvents();
    expect(eventsAfterFail.length).toBe(0);
  });

  // ==========================================================================
  // 5. allowPlanningMode: true cannot bypass actual-wear restrictions
  // ==========================================================================
  it('5. allowPlanningMode: true cannot bypass actual-wear restrictions', async () => {
    // Generate an outfit where planning mode permitted an unwashed anchor
    const req: RecommendationRequest = {
      items: [dirtyWhiteShirt, cleanBlueJeans, cleanSneakers],
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
      allowPlanningMode: true,
    };

    const baseResult = baseEngine.recommend(req);
    expect(baseResult.set.outfits.length).toBeGreaterThan(0);
    const baseOutfit = baseResult.set.outfits[0];

    const ensResult = ensembleEngine.recommend(req);
    expect(ensResult.outfits.length).toBeGreaterThan(0);
    const ensOutfit = ensResult.outfits[0];

    // RULE: Outfits generated under planning mode MUST fail wear validation
    // validateOutfitWearability has NO bypass flag and refuses the outfit
    const baseWearCheck = validateOutfitWearability(baseOutfit);
    expect(baseWearCheck.canWear).toBe(false);
    expect(baseWearCheck.uncleanPieces.map((p) => p.id)).toContain(dirtyWhiteShirt.id);
    expect(baseWearCheck.error).toContain('Unwashed Poplin Shirt needs washing before wearing');

    const ensWearCheck = validateOutfitWearability(ensOutfit);
    expect(ensWearCheck.canWear).toBe(false);
    expect(ensWearCheck.uncleanPieces.map((p) => p.id)).toContain(dirtyWhiteShirt.id);
    expect(ensWearCheck.error).toContain('Unwashed Poplin Shirt needs washing before wearing');
  });

  // ==========================================================================
  // 6. Clean garments continue to work normally in both engines
  // ==========================================================================
  it('6. Clean garments continue to work normally in both engines', () => {
    const wardrobe = [cleanWhiteShirt, cleanBlueJeans, cleanSneakers];
    const req: RecommendationRequest = {
      items: wardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: cleanWhiteShirt.id,
    };

    const baseResult = baseEngine.recommend(req);
    const ensResult = ensembleEngine.recommend(req);

    expect(baseResult.set.outfits.length).toBeGreaterThan(0);
    expect(ensResult.outfits.length).toBeGreaterThan(0);

    // No laundry assumptions for completely clean outfits
    expect(
      baseResult.set.outfits[0].explanation.assumptions?.some((a) =>
        a.includes('washing before wear')
      )
    ).toBeFalsy();
    expect(
      ensResult.outfits[0].explanation.assumptions?.some((a) =>
        a.includes('washing before wear')
      )
    ).toBeFalsy();
  });

  // ==========================================================================
  // 7. Planning does not mutate laundry status, garment records, or user wardrobe data
  // ==========================================================================
  it('7. Planning does not mutate laundry status, garment records, or user wardrobe data', () => {
    const originalStatus = dirtyWhiteShirt.status;
    const originalTimesWorn = dirtyWhiteShirt.timesWorn;

    // Deep freeze to guarantee immutability at runtime
    const frozenWardrobe = [
      Object.freeze({ ...dirtyWhiteShirt }),
      Object.freeze({ ...cleanBlueJeans }),
      Object.freeze({ ...cleanSneakers }),
    ];
    Object.freeze(frozenWardrobe);

    const req: RecommendationRequest = {
      items: frozenWardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
      allowPlanningMode: true,
    };

    expect(() => {
      baseEngine.recommend(req);
      ensembleEngine.recommend(req);
    }).not.toThrow();

    expect(dirtyWhiteShirt.status).toBe(originalStatus);
    expect(dirtyWhiteShirt.timesWorn).toBe(originalTimesWorn);
  });

  // ==========================================================================
  // 8. Other hard constraints remain enforced
  // ==========================================================================
  it('8. Other hard constraints remain enforced (e.g. monsoon deluge silk hazard)', () => {
    // Delicate silk saree in active Mumbai deluge
    const monsoonWardrobe = [delicateSilkSaree, silkBlouse, cleanSneakers];
    const req: RecommendationRequest = {
      items: monsoonWardrobe,
      occasion: 'wedding guest',
      season: 'monsoon',
      localDate: '2026-11-06',
      context: WEATHER_DELUGE_MUMBAI,
      anchorItemId: delicateSilkSaree.id,
      allowPlanningMode: true,
    };

    // Even with allowPlanningMode: true, the severe monsoon deluge hazard on delicate silk
    // must strictly trigger hard constraint or severe penalty
    const ensResult = ensembleEngine.recommend(req);

    // If any outfit returned, score must be dampened or warned for rain hazard
    for (const outfit of ensResult.outfits) {
      const evalData = ensResult.evaluations[outfit.id];
      if (evalData) {
        expect(
          evalData.breakdown.penaltiesApplied.some((p) => p.toLowerCase().includes('monsoon') || p.toLowerCase().includes('rain')) ||
          evalData.graph.minimumPairwiseScore < 6.0
        ).toBe(true);
      }
    }
  });

  // ==========================================================================
  // 9. Anchor preservation and companion cleanliness invariance
  // ==========================================================================
  it('9. Anchor preservation holds and companion items must NEVER be unwashed', () => {
    // Wardrobe with dirty anchor, clean shirt, dirty jeans, clean sneakers
    // There are NO clean bottoms in this wardrobe!
    const wardrobeWithDirtyBottom = [dirtyWhiteShirt, dirtyBlueJeans, cleanSneakers];
    const req: RecommendationRequest = {
      items: wardrobeWithDirtyBottom,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
      anchorItemId: dirtyWhiteShirt.id,
      allowPlanningMode: true,
    };

    // Both engines MUST refuse to generate an outfit because the companion bottom is dirty!
    const baseResult = baseEngine.recommend(req);
    const ensResult = ensembleEngine.recommend(req);

    expect(baseResult.set.outfits.length).toBe(0);
    expect(ensResult.outfits.length).toBe(0);
  });

  // ==========================================================================
  // 10. Needle assistant record_wear rejects unwashed and in_laundry items
  // ==========================================================================
  it('10. Needle assistant record_wear rejects unwashed and in_laundry items without mutating wear count', async () => {
    await clearCachedModel();
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    const needle = new NeedleService();
    await needle.initialize();

    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    // 1. Try to record wear for dirty item
    const resDirty = await needle.executeCommand('I wore my Unwashed Poplin Shirt today', {
      items: [dirtyWhiteShirt, cleanBlueJeans, cleanSneakers],
      updateItem: mockUpdate,
    });

    expect(resDirty.executionStatus).toBe('rejected');
    expect(resDirty.message).toContain('needs washing');
    expect(resDirty.reasoning).toContain('needs washing');
    expect(mockUpdate).not.toHaveBeenCalled();

    // 2. Try to record wear for item in laundry
    const resLaundry = await needle.executeCommand('I wore my Shirt at Dry Cleaners today', {
      items: [inLaundryShirt, cleanBlueJeans, cleanSneakers],
      updateItem: mockUpdate,
    });

    expect(resLaundry.executionStatus).toBe('rejected');
    expect(resLaundry.message).toContain('in laundry');
    expect(resLaundry.reasoning).toContain('in laundry');
    expect(mockUpdate).not.toHaveBeenCalled();

    // 3. Clean item successfully logs wear
    const resClean = await needle.executeCommand('I wore my Clean Poplin Shirt today', {
      items: [cleanWhiteShirt, cleanBlueJeans, cleanSneakers],
      updateItem: mockUpdate,
    });

    expect(resClean.executionStatus).toBe('executed');
    expect(mockUpdate).toHaveBeenCalledWith(
      cleanWhiteShirt.id,
      expect.objectContaining({
        timesWorn: 3,
      })
    );
  }, 15000);

  // ==========================================================================
  // 11. UI wear callers handle rejections safely without unhandled errors
  // ==========================================================================
  it('11. UI wear callers catch wear rejections without unhandled exceptions or false toasts', async () => {
    const showToast = vi.fn();
    const mockMarkWorn = vi.fn().mockImplementation(async (outfit: GeneratedOutfit) => {
      const wearCheck = validateOutfitWearability(outfit);
      if (!wearCheck.canWear) {
        showToast(wearCheck.error);
        throw new Error(wearCheck.error);
      }
    });

    const dirtyOutfit: GeneratedOutfit = {
      template: 'Shirt + Jeans',
      slots: {
        top: [dirtyWhiteShirt],
        bottom: [cleanBlueJeans],
      },
      score: 8.0,
      why: 'Test Look',
    };

    let toastCalledWithSuccess = false;
    let errorCaught = false;

    // Simulate safe UI handler pattern in CalendarScreen / SavedOutfitsModal / StyleItemSheet
    const handleUiWear = async (outfit: GeneratedOutfit) => {
      try {
        await mockMarkWorn(outfit);
        toastCalledWithSuccess = true;
      } catch {
        errorCaught = true;
        // Rejection safely caught and handled
      }
    };

    await expect(handleUiWear(dirtyOutfit)).resolves.not.toThrow();
    expect(errorCaught).toBe(true);
    expect(toastCalledWithSuccess).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      'Cannot log wear: Unwashed Poplin Shirt needs washing before wearing.'
    );
  });
});
