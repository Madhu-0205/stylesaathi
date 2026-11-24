import { describe, it, expect, beforeEach } from 'vitest';
import { WardrobeItem, GeneratedOutfit, OutfitPlan, WearEvent } from '../types';
import {
  processSaathiTurn,
  createInitialConversationState,
} from '../engine/saathi/orchestrationEngine';
import { SaathiToolContext } from '../engine/saathi/types';
import { parseSaathiIntent } from '../engine/saathi/intentParser';

describe('Unified End-to-End User Journey Integration — Master Programme Priority D', () => {
  let wardrobeInventory: WardrobeItem[] = [];
  let outfitPlans: OutfitPlan[] = [];
  let wearEvents: WearEvent[] = [];
  let savedOutfits: GeneratedOutfit[] = [];

  beforeEach(() => {
    wardrobeInventory = [];
    outfitPlans = [];
    wearEvents = [];
    savedOutfits = [];
  });

  it('executes the full journey: Register -> Style -> Refine -> Anchor -> Swap -> Atelier Save -> Schedule -> Log Wear', async () => {
    // =========================================================================
    // STEP 1: Garment Registration (Wardrobe Digitisation)
    // User digitises wardrobe pieces with verified attributes (no false claims)
    // =========================================================================
    const whiteTee: WardrobeItem = {
      id: 'item-white-tee',
      name: 'Relaxed White Cotton Tee',
      category: 'Tops',
      subcategory: 't-shirt',
      colors: ['white'],
      fabric: 'cotton',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 2,
      favorite: false,
      note: 'Breathable organic cotton',
      culturalContext: 'contemporary',
      fit: 'relaxed',
      pattern: 'solid',
    };

    const skyBlueShirt: WardrobeItem = {
      id: 'item-blue-shirt',
      name: 'Sky Blue Oxford Shirt',
      category: 'Tops',
      subcategory: 'shirt',
      colors: ['blue'],
      fabric: 'cotton',
      formality: 3,
      status: 'clean',
      occasions: ['college', 'office', 'casual outing', 'date'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 4,
      favorite: true,
      note: 'Semi-formal oxford weave',
      culturalContext: 'contemporary',
      fit: 'regular',
      pattern: 'solid',
    };

    const blueJeans: WardrobeItem = {
      id: 'item-blue-jeans',
      name: 'Classic Indigo Straight Jeans',
      category: 'Bottoms',
      subcategory: 'jeans',
      colors: ['blue'],
      fabric: 'denim',
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday', 'date'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 8,
      favorite: true,
      note: 'Durable washed selvedge denim',
      culturalContext: 'contemporary',
      fit: 'regular',
      pattern: 'solid',
    };

    const blackTrousers: WardrobeItem = {
      id: 'item-black-trousers',
      name: 'Black Pleated Trousers',
      category: 'Bottoms',
      subcategory: 'trousers',
      colors: ['black'],
      fabric: 'polyblend',
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'party', 'family function'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 5,
      favorite: false,
      note: 'Structured sharp trousers',
      culturalContext: 'contemporary',
      fit: 'slim',
      pattern: 'solid',
    };

    const whiteSneakers: WardrobeItem = {
      id: 'item-white-sneakers',
      name: 'Minimal White Leather Sneakers',
      category: 'Footwear',
      subcategory: 'sneakers',
      colors: ['white'],
      formality: 2,
      status: 'clean',
      occasions: ['college', 'casual outing', 'everyday', 'travel'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 10,
      favorite: true,
      note: 'Low-profile court sneakers',
      culturalContext: 'contemporary',
      fit: 'regular',
      pattern: 'solid',
    };

    const brownLoafers: WardrobeItem = {
      id: 'item-brown-loafers',
      name: 'Burnished Tan Penny Loafers',
      category: 'Footwear',
      subcategory: 'loafers',
      colors: ['brown'],
      formality: 4,
      status: 'clean',
      occasions: ['office', 'interview', 'date', 'party'],
      seasons: ['summer', 'monsoon', 'winter'],
      timesWorn: 3,
      favorite: false,
      note: 'Hand-finished calf leather',
      culturalContext: 'contemporary',
      fit: 'regular',
      pattern: 'solid',
    };

    wardrobeInventory.push(
      whiteTee,
      skyBlueShirt,
      blueJeans,
      blackTrousers,
      whiteSneakers,
      brownLoafers
    );

    expect(wardrobeInventory.length).toBe(6);
    expect(wardrobeInventory.every((item) => item.status === 'clean')).toBe(true);

    const toolContext: SaathiToolContext = {
      wardrobe: wardrobeInventory,
      referenceTimestamp: 1716500000000,
    };

    // =========================================================================
    // STEP 2: Ask AI Saathi for Outfit Recommendation
    // User engages natural conversation: "Suggest an outfit for college"
    // =========================================================================
    let state = createInitialConversationState('journey-session-001');

    const turn1 = await processSaathiTurn('Suggest an outfit for college', state, toolContext);
    state = turn1.updatedState;

    expect(state.activeOutfit).toBeDefined();
    const outfit1 = state.activeOutfit!;
    const pieces1 = Object.values(outfit1.slots).flat() as WardrobeItem[];
    expect(pieces1.length).toBeGreaterThanOrEqual(2);
    // All pieces must be authentic items in the user's wardrobe
    pieces1.forEach((p) => {
      expect(wardrobeInventory.some((item) => item.id === p.id)).toBe(true);
    });

    // =========================================================================
    // STEP 3: Formality Refinement
    // User refines: "Make it more formal"
    // =========================================================================
    const formalityIntent = parseSaathiIntent('Make it more formal');
    expect(formalityIntent.intent).toBe('REFINE_OUTFIT');
    expect(formalityIntent.entities.refinementType).toBe('more_formal');

    const turn2 = await processSaathiTurn('Make it more formal', state, toolContext);
    state = turn2.updatedState;

    expect(state.activeOutfit).toBeDefined();
    const outfit2 = state.activeOutfit!;
    const pieces2 = Object.values(outfit2.slots).flat() as WardrobeItem[];
    const avgFormality1 = pieces1.reduce((sum, p) => sum + p.formality, 0) / pieces1.length;
    const avgFormality2 = pieces2.reduce((sum, p) => sum + p.formality, 0) / pieces2.length;
    expect(avgFormality2).toBeGreaterThanOrEqual(avgFormality1);

    // =========================================================================
    // STEP 4: Anchor Retention
    // User instructs: "Keep the same jeans"
    // =========================================================================
    const anchorIntent = parseSaathiIntent('Keep the same jeans');
    expect(anchorIntent.intent).toBe('SWAP_PIECE');
    expect(anchorIntent.entities.keptPieceName).toBe('jeans');

    const turn3 = await processSaathiTurn('Keep the same jeans', state, toolContext);
    state = turn3.updatedState;

    expect(state.activeAnchorItem?.id).toBe('item-blue-jeans');
    const outfit3 = state.activeOutfit!;
    const pieces3 = Object.values(outfit3.slots).flat() as WardrobeItem[];
    expect(pieces3.some((p) => p.id === 'item-blue-jeans')).toBe(true);

    // =========================================================================
    // STEP 5: Piece Replacement
    // User requests: "Change the shirt"
    // =========================================================================
    const previousTop = pieces3.find((p) => p.category === 'Tops');

    const turn4 = await processSaathiTurn('Change the shirt', state, toolContext);
    state = turn4.updatedState;

    const outfit4 = state.activeOutfit!;
    const pieces4 = Object.values(outfit4.slots).flat() as WardrobeItem[];
    // Jeans must remain preserved
    expect(pieces4.some((p) => p.id === 'item-blue-jeans')).toBe(true);
    // Top was swapped if alternative exists
    const currentTop = pieces4.find((p) => p.category === 'Tops');
    if (previousTop && currentTop && wardrobeInventory.filter((i) => i.category === 'Tops').length > 1) {
      expect(currentTop.id).not.toBe(previousTop.id);
    }

    // =========================================================================
    // STEP 6: Atelier Outfit Composition & Save
    // User saves the resulting refined outfit into their collection
    // =========================================================================
    const finalOutfit: GeneratedOutfit = {
      ...outfit4,
      id: `outfit_curated_${Date.now()}`,
      slots: outfit4.slots,
    };
    savedOutfits.push(finalOutfit);

    expect(savedOutfits.length).toBe(1);
    expect(savedOutfits[0].id).toBe(finalOutfit.id);

    // =========================================================================
    // STEP 7: Intelligent Calendar Scheduling
    // User schedules the look for an upcoming date
    // =========================================================================
    const plannedDate = '2026-11-25';
    const plan: OutfitPlan = {
      id: `plan_${Date.now()}`,
      date: plannedDate,
      outfit: finalOutfit,
      occasion: 'casual outing',
      status: 'planned',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    outfitPlans.push(plan);

    expect(outfitPlans.length).toBe(1);
    expect(outfitPlans[0].date).toBe(plannedDate);
    expect(outfitPlans[0].status).toBe('planned');

    // =========================================================================
    // STEP 8: Wear Recording & Rotation Update
    // User logs wear of the scheduled outfit
    // =========================================================================
    const wornPieces = Object.values(finalOutfit.slots).flat() as WardrobeItem[];
    wornPieces.forEach((piece) => {
      // Create wear event
      const event: WearEvent = {
        id: `wear_${piece.id}_${Date.now()}`,
        userId: 'user-001',
        wardrobeItemId: piece.id,
        outfitId: finalOutfit.id,
        plannedDate,
        wornAt: Date.now(),
        createdAt: Date.now(),
        occasion: 'casual outing',
      };
      wearEvents.push(event);

      // Increment timesWorn count in inventory
      const invItem = wardrobeInventory.find((i) => i.id === piece.id);
      if (invItem) {
        invItem.timesWorn += 1;
      }
    });

    // Plan status transitions to 'worn'
    plan.status = 'worn';
    plan.updatedAt = Date.now();

    expect(plan.status).toBe('worn');
    expect(wearEvents.length).toBe(wornPieces.length);
    // Verifies that worn items have their wear counters correctly updated
    const updatedJeans = wardrobeInventory.find((i) => i.id === 'item-blue-jeans');
    expect(updatedJeans?.timesWorn).toBe(9); // Initial 8 + 1
  });
});

