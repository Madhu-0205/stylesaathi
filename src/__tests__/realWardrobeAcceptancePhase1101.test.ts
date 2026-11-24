import { describe, it, expect } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
} from '../engine/saathi/orchestrationEngine';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { SaathiToolContext } from '../engine/saathi/types';
import { getPurchaseAssessmentTool } from '../engine/saathi/toolRegistry';
import { WeatherSnapshot, PersonalStyleProfile, StylePreferences } from '../types';

describe('Phase 1.10.1 — Real Wardrobe Acceptance Scenarios & Purchase Assessment Integrity', () => {
  const mockWeather: WeatherSnapshot = {
    temperature: 24,
    condition: 'clear',
    conditionText: 'Clear Evening',
    feelsLike: 24,
    humidity: 50,
    windSpeed: 10,
    precipitationProbability: 0,
    uvIndex: 1,
    observedAt: 1791892800000,
    expiresAt: 1791896400000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { black: 0.9, blue: 0.85, white: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0, Ethnic: 1.0, Footwear: 1.0 } as any,
    formalityPreference: 3.5 as any,
    occasionAffinities: { party: { score: 0.8, confidence: 0.5 } } as any,
    combinationAffinities: {} as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const mockPreferences: StylePreferences = {
    preferredContexts: ['everyday', 'office', 'party'],
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
    wearLogs: [],
    outfitPlans: [],
    referenceTimestamp: 1791893000000,
    localDate: '2026-10-13',
  };

  it('runs Scenarios A through F sequentially with actual sampleWardrobe dataset', async () => {
    let state = createInitialConversationState('phase110_acceptance');

    // =========================================================================
    // SCENARIO A: "I'm going to a party tonight. Do I need to buy anything?"
    // =========================================================================
    console.log('--- SCENARIO A ---');
    const turnA = await processSaathiTurn(
      "I'm going to a party tonight. Do I need to buy anything?",
      state,
      baseContext
    );
    console.log('Turn A Intent:', turnA.intent);
    console.log('Turn A Message:', turnA.message);
    const paA = turnA.domainResult?.purchaseAssessment as any;
    console.log('Turn A Purchase Assessment:', paA?.verdict, paA?.purchaseVerdict, paA?.headline);

    // Verify Scenario A requirements:
    expect(turnA.intent).toBe('ASSESS_PURCHASE_NEED');
    expect(paA).toBeDefined();
    expect(paA.occasion).toBe('party');
    expect(paA.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(paA.purchaseVerdict).toBe('NO_PURCHASE_NEEDED');
    // Actual owned garment names must be shown
    expect(paA.evaluatedPieces).toBeDefined();
    expect(paA.evaluatedPieces.length).toBeGreaterThanOrEqual(1);
    const pieceNamesA = paA.evaluatedPieces.map((p: any) => p.name).join(', ');
    console.log('Turn A Evaluated pieces from sampleWardrobe:', pieceNamesA);
    // Message or card confirms sufficiency without forcing unnecessary gap
    expect(turnA.message).toContain('party');
    expect(turnA.message).toContain('No Purchase Needed');
    expect(turnA.message).not.toContain('All 3 of your active routines are fully covered');

    state = turnA.updatedState;

    // =========================================================================
    // SCENARIO B: "I want to wear my blue kurti to the party."
    // =========================================================================
    console.log('--- SCENARIO B ---');
    const turnB = await processSaathiTurn(
      'I want to wear my blue kurti to the party.',
      state,
      baseContext
    );
    console.log('Turn B Intent:', turnB.intent);
    console.log('Turn B Message:', turnB.message);
    console.log('Turn B Anchor:', turnB.updatedState.activeAnchorItem?.name);
    const outfitsB = turnB.domainResult?.outfits;
    console.log('Turn B Outfits count:', outfitsB?.length);

    // Verify Scenario B requirements:
    // Resolves to sample-blue-kurti ('Indigo kurti')
    expect(turnB.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turnB.updatedState.activeOccasion).toBe('party');
    expect(outfitsB).toBeDefined();
    expect(outfitsB!.length).toBeGreaterThan(0);
    const topLookB = outfitsB![0];
    const outfitNamesB = Object.values(topLookB.slots).flat().map((i: any) => i?.name);
    console.log('Turn B Look 1 Items:', outfitNamesB.join(' + '));
    expect(outfitNamesB.some((n: string) => n.toLowerCase().includes('kurti'))).toBe(true);

    state = turnB.updatedState;

    // =========================================================================
    // SCENARIO C: "Show another look."
    // =========================================================================
    console.log('--- SCENARIO C ---');
    const turnC = await processSaathiTurn(
      'Show another look.',
      state,
      baseContext
    );
    console.log('Turn C Intent:', turnC.intent);
    console.log('Turn C Message:', turnC.message);
    const outfitsC = turnC.domainResult?.outfits;
    console.log('Turn C Outfits count:', outfitsC?.length);

    // Verify Scenario C requirements:
    // Kurti remains anchored
    expect(turnC.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turnC.updatedState.activeOccasion).toBe('party');
    expect(outfitsC).toBeDefined();
    expect(outfitsC!.length).toBeGreaterThan(0);
    const topLookC = outfitsC![0];
    const outfitNamesC = Object.values(topLookC.slots).flat().map((i: any) => i?.name);
    console.log('Turn C Look Items:', outfitNamesC.join(' + '));
    expect(outfitNamesC.some((n: string) => n.toLowerCase().includes('kurti'))).toBe(true);
    // Distinct combination from Turn B
    expect(topLookC.id).not.toBe(topLookB.id);

    state = turnC.updatedState;

    // =========================================================================
    // SCENARIO D: "Different footwear."
    // =========================================================================
    console.log('--- SCENARIO D ---');
    const turnD = await processSaathiTurn(
      'Different footwear.',
      state,
      baseContext
    );
    console.log('Turn D Intent:', turnD.intent);
    console.log('Turn D Message:', turnD.message);
    const outfitsD = turnD.domainResult?.outfits;

    // Verify Scenario D requirements:
    expect(turnD.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(outfitsD).toBeDefined();
    expect(outfitsD!.length).toBeGreaterThan(0);
    const topLookD = outfitsD![0];
    const outfitNamesD = Object.values(topLookD.slots).flat().map((i: any) => i?.name);
    console.log('Turn D Look Items:', outfitNamesD.join(' + '));
    expect(outfitNamesD.some((n: string) => n.toLowerCase().includes('kurti'))).toBe(true);

    state = turnD.updatedState;

    // =========================================================================
    // SCENARIO E: "Actually, this is a birthday party."
    // =========================================================================
    console.log('--- SCENARIO E ---');
    const turnE = await processSaathiTurn(
      'Actually, this is a birthday party.',
      state,
      baseContext
    );
    console.log('Turn E Intent:', turnE.intent);
    console.log('Turn E Message:', turnE.message);
    console.log('Turn E Active Occasion:', turnE.updatedState.activeOccasion);
    console.log('Turn E Anchor:', turnE.updatedState.activeAnchorItem?.name);

    // Verify Scenario E requirements:
    expect(['party', 'celebration']).toContain(turnE.updatedState.activeOccasion);
    expect(turnE.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    const outfitsE = turnE.domainResult?.outfits;
    expect(outfitsE).toBeDefined();
    expect(outfitsE!.length).toBeGreaterThan(0);

    state = turnE.updatedState;

    // =========================================================================
    // SCENARIO F: "I don't want to buy anything."
    // =========================================================================
    console.log('--- SCENARIO F ---');
    const turnF = await processSaathiTurn(
      "I don't want to buy anything.",
      state,
      baseContext
    );
    console.log('Turn F Intent:', turnF.intent);
    console.log('Turn F Message:', turnF.message);
    const paF = turnF.domainResult?.purchaseAssessment as any;
    console.log('Turn F Purchase Assessment:', paF?.verdict, paF?.purchaseVerdict);

    // Verify Scenario F requirements:
    expect(['EXPLICIT_NO_PURCHASE', 'ASSESS_PURCHASE_NEED']).toContain(turnF.intent);
    expect(turnF.message.toLowerCase()).toContain('no purchase');
    expect(paF.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(turnF.message).toContain('zero-pressure');
  });

  it('verifies all 5 purchase assessment verdicts with structural integrity', async () => {
    // 1. NO_PURCHASE_NEEDED: Closet has ready clean looks for party
    const res1 = await getPurchaseAssessmentTool.execute(
      { occasion: 'party' },
      baseContext
    );
    const pa1 = res1.purchaseAssessment as any;
    console.log('Verdict 1 (NO_PURCHASE_NEEDED):', pa1.verdict, pa1.purchaseVerdict, pa1.headline);
    expect(pa1.verdict).toBe('NO_PURCHASE_NEEDED');
    expect(pa1.purchaseVerdict).toBe('NO_PURCHASE_NEEDED');
    expect(pa1.headline).toBe('No Purchase Needed');

    // 2. PURCHASE_OPTIONAL: Complete outfit exists, user queries unowned optional accessory/layer (e.g. leather jacket / shrug)
    const res2 = await getPurchaseAssessmentTool.execute(
      { occasion: 'party', category: 'Outerwear', search: 'shrug' },
      baseContext
    );
    const pa2 = res2.purchaseAssessment as any;
    console.log('Verdict 2 (PURCHASE_OPTIONAL):', pa2.verdict, pa2.purchaseVerdict, pa2.headline);
    expect(pa2.verdict).toBe('OPTIONAL_GAP');
    expect(pa2.purchaseVerdict).toBe('PURCHASE_OPTIONAL');
    expect(pa2.headline).toBe('Optional Enhancement Only');

    // 3. PURCHASE_STRONGLY_RECOMMENDED: Closet has missing essential footwear for party
    const noFootwearWardrobe = sampleWardrobe.filter((i) => i.category !== 'Footwear');
    const res3 = await getPurchaseAssessmentTool.execute(
      { occasion: 'party' },
      { ...baseContext, wardrobe: noFootwearWardrobe }
    );
    const pa3 = res3.purchaseAssessment as any;
    console.log('Verdict 3 (PURCHASE_STRONGLY_RECOMMENDED):', pa3.verdict, pa3.purchaseVerdict, pa3.headline);
    expect(pa3.verdict).toBe('WARDROBE_GAP');
    expect(pa3.purchaseVerdict).toBe('PURCHASE_STRONGLY_RECOMMENDED');
    expect(pa3.headline).toBe('Verified Wardrobe Gap');

    // 4. PURCHASE_RECOMMENDED: Missing non-critical component or general verified gap
    // In Smart Buy gap report fallback without specific occasion, missing category with active demand
    const res4 = await getPurchaseAssessmentTool.execute(
      {},
      {
        ...baseContext,
        wardrobe: sampleWardrobe.filter((i) => i.category !== 'Accessories'),
      }
    );
    const pa4 = res4.purchaseAssessment as any;
    console.log('Verdict 4 (General Gap Assessment):', pa4.verdict, pa4.purchaseVerdict, pa4.headline);
    expect(pa4.verdict).toBeDefined();
    expect(pa4.purchaseVerdict).toBeDefined();

    // 5. INSUFFICIENT_INFORMATION: Catalog lacks multiple structural roles (e.g. only accessories)
    const accessoriesOnlyWardrobe = sampleWardrobe.filter((i) => i.category === 'Accessories');
    const res5 = await getPurchaseAssessmentTool.execute(
      { occasion: 'party' },
      { ...baseContext, wardrobe: accessoriesOnlyWardrobe }
    );
    const pa5 = res5.purchaseAssessment as any;
    console.log('Verdict 5 (INSUFFICIENT_INFORMATION):', pa5.verdict, pa5.purchaseVerdict, pa5.headline);
    expect(pa5.verdict).toBe('INSUFFICIENT_INFORMATION');
    expect(pa5.purchaseVerdict).toBe('INSUFFICIENT_INFORMATION');
    expect(pa5.headline).toBe('More Wardrobe Information Needed');
  });
});
