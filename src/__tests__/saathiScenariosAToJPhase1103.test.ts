import { describe, it, expect } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
} from '../engine/saathi/orchestrationEngine';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { SaathiToolContext } from '../engine/saathi/types';
import { WeatherSnapshot, PersonalStyleProfile, StylePreferences } from '../types';

describe('Phase 1.10.3 — Mandatory Conversation Scenarios A through J Verification', () => {
  const mockWeather: WeatherSnapshot = {
    temperature: 24,
    condition: 'clear',
    conditionText: 'Clear Evening',
    feelsLike: 24,
    humidity: 50,
    windSpeed: 10,
    precipitationProbability: 0,
    uvIndex: 1,
    observedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { black: 0.9, blue: 0.85, white: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0, Ethnic: 1.0, Footwear: 1.0 } as any,
    formalityPreference: 3.5 as any,
    occasionAffinities: { party: { score: 0.8, confidence: 0.5 }, college: { score: 0.85, confidence: 0.6 } } as any,
    combinationAffinities: {} as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const mockPreferences: StylePreferences = {
    preferredContexts: ['everyday', 'office', 'party', 'college'],
    preferredAesthetics: ['minimalist', 'contemporary'],
    stylingMode: 'variety',
    updatedAt: Date.now(),
    preferredColors: ['black', 'blue'],
  };

  const baseContext: SaathiToolContext = {
    wardrobe: sampleWardrobe,
    weather: mockWeather,
    styleProfile: mockStyleProfile,
    preferences: mockPreferences,
    wearEvents: [
      {
        id: 'wear_1',
        userId: 'user_test',
        wardrobeItemId: 'sample-white-tee',
        outfitId: 'outfit_1',
        wornAt: Date.now() - 5000000,
        createdAt: Date.now() - 5000000,
        occasion: 'casual outing',
      },
      {
        id: 'wear_2',
        userId: 'user_test',
        wardrobeItemId: 'sample-blue-jeans',
        outfitId: 'outfit_2',
        wornAt: Date.now() - 3000000,
        createdAt: Date.now() - 3000000,
        occasion: 'college',
      },
    ],
    outfitPlans: [],
    referenceTimestamp: Date.now(),
    localDate: '2026-11-19',
  };

  it('runs all 10 scenarios in sequence verifying intent, entities, anchors, and domain grounding', async () => {
    let state = createInitialConversationState('phase1103_scenarios');

    // A. "I'm going to a party tonight. Do I need to buy anything?"
    const turnA = await processSaathiTurn("I'm going to a party tonight. Do I need to buy anything?", state, baseContext);
    expect(turnA.intent).toBe('ASSESS_PURCHASE_NEED');
    expect(turnA.domainResult?.purchaseAssessment).toBeDefined();
    const paA = turnA.domainResult!.purchaseAssessment as any;
    expect(paA.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(paA.occasion).toBe('party');
    expect(turnA.message).toContain('No Purchase Needed');
    expect(turnA.message).not.toContain('All 3 of your active routines are fully covered');
    state = turnA.updatedState;

    // B. "I want to wear my blue kurti to the party."
    const turnB = await processSaathiTurn("I want to wear my blue kurti to the party.", state, baseContext);
    expect(turnB.intent).toBe('STYLE_ITEM');
    expect(turnB.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turnB.updatedState.activeOccasion).toBe('party');
    expect(turnB.domainResult?.outfits).toBeDefined();
    expect(turnB.domainResult!.outfits!.length).toBeGreaterThan(0);
    state = turnB.updatedState;

    // C. "Show another look."
    const turnC = await processSaathiTurn("Show another look.", state, baseContext);
    expect(turnC.intent).toBe('SHOW_ALTERNATIVE');
    expect(turnC.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turnC.updatedState.activeOccasion).toBe('party');
    state = turnC.updatedState;

    // D. "Different footwear, but keep everything else the same."
    const turnD = await processSaathiTurn("Different footwear, but keep everything else the same.", state, baseContext);
    expect(turnD.intent).toBe('SWAP_PIECE');
    expect(turnD.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    state = turnD.updatedState;

    // E. "Actually, this is a birthday party."
    const turnE = await processSaathiTurn("Actually, this is a birthday party.", state, baseContext);
    expect(turnE.intent).toBe('RECOMMEND_OUTFIT');
    expect(turnE.updatedState.activeOccasion).toBe('celebration');
    expect(turnE.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    state = turnE.updatedState;

    // F. "I don't want to buy anything."
    const turnF = await processSaathiTurn("I don't want to buy anything.", state, baseContext);
    expect(turnF.intent).toBe('EXPLICIT_NO_PURCHASE');
    state = turnF.updatedState;

    // G. "Show me something more elegant."
    const turnG = await processSaathiTurn("Show me something more elegant.", state, baseContext);
    expect(turnG.intent).toBe('PREMIUM_UPGRADE');
    expect(turnG.message).toContain('Quiet Luxury');
    state = turnG.updatedState;

    // H. "Which of my existing clothes are suitable for college?"
    const turnH = await processSaathiTurn("Which of my existing clothes are suitable for college?", state, baseContext);
    expect(turnH.intent).toBe('CHECK_WARDROBE');
    expect(turnH.domainResult?.items).toBeDefined();
    expect(turnH.message).toContain('college');
    state = turnH.updatedState;

    // I. "What do I wear most often?"
    const turnI = await processSaathiTurn("What do I wear most often?", state, baseContext);
    expect(turnI.intent).toBe('ANALYZE_WEAR');
    expect(turnI.domainResult?.wearReport).toBeDefined();
    expect(turnI.message).toContain('wear rotation insights');
    state = turnI.updatedState;

    // J. "Show my styling aesthetic preferences."
    const turnJ = await processSaathiTurn("Show my styling aesthetic preferences.", state, baseContext);
    expect(turnJ.intent).toBe('UNDERSTAND_STYLE');
    expect(turnJ.message).toContain('Style Brain profile');
    state = turnJ.updatedState;
  });
});
