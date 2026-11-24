import { describe, it, expect } from 'vitest';
import {
  processSaathiTurn,
  createInitialConversationState,
  SaathiToolContext,
} from '../engine/saathi';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { WardrobeItem } from '../types';

describe('Task 4 (P3): Explicit Handling of Unowned Garment Queries', () => {
  const mockContext: SaathiToolContext = {
    wardrobe: sampleWardrobe,
    preferences: { preferredAesthetics: ['western', 'indo-western'] } as any,
    styleProfile: { dominantAesthetics: ['western'] } as any,
    plans: [],
    weatherSnapshot: null,
    referenceTimestamp: 1795434358791,
    localDate: '2026-11-23',
    onSavePlan: async (plan: any) => plan,
    onRecordWear: async () => {},
  };

  it('1. Explicitly communicates when a requested garment does not exist in the wardrobe and offers alternative using active anchor', async () => {
    let state = createInitialConversationState('unowned_garment_test');

    // Turn 1: Establish college presentation look
    const res1 = await processSaathiTurn('Suggest an outfit for a college presentation.', state, mockContext);
    state = res1.updatedState;

    // Turn 2: Retain jeans
    const res2 = await processSaathiTurn('Keep the same jeans and change the top.', state, mockContext);
    state = res2.updatedState;

    // Turn 3: Ask about unowned piece with context ("Can I wear my neon green velvet poncho with this?")
    const res3 = await processSaathiTurn('Can I wear my neon green velvet poncho with this?', state, mockContext);

    // Assert: Explicit communication of missing garment
    expect(res3.message).toContain("I couldn't find a");
    expect(res3.message.toLowerCase()).toContain('neon green velvet poncho');
    expect(res3.message).toContain('in your wardrobe');

    // Assert: Offers alternative combination using existing pieces
    expect(res3.domainResult).toBeDefined();
    expect(res3.domainResult?.outfits).toBeDefined();
    expect(res3.domainResult?.outfits?.length).toBeGreaterThan(0);

    const alternativeOutfit = res3.domainResult!.outfits![0];
    const pieceNames = Object.values(alternativeOutfit.slots || {})
      .flat()
      .map((p: any) => p.name);

    // Assert: Does NOT invent or fabricate the poncho into the outfit slots
    expect(pieceNames.some((name: string) => name.toLowerCase().includes('poncho'))).toBe(false);

    // Assert: Preserves the existing anchor (Blue straight jeans)
    expect(pieceNames).toContain('Blue straight jeans');
  });

  it('2. Correctly matches and does NOT reject garments that actually exist in the wardrobe', async () => {
    let state = createInitialConversationState('existing_garment_test');

    // Query for verified existing piece
    const res = await processSaathiTurn('Can I wear my white relaxed tee?', state, mockContext);

    // Should NOT report missing
    expect(res.message).not.toContain("I couldn't find");
    expect(res.domainResult?.outfits).toBeDefined();

    const topOutfit = res.domainResult!.outfits![0];
    const pieceIds = Object.values(topOutfit.slots || {})
      .flat()
      .map((p: any) => p.id);

    // Must include the actual garment ID
    expect(pieceIds).toContain('sample-white-tee');
  });

  it('3. Resolves similar but differently named garments (e.g. blue kurta -> Indigo kurti)', async () => {
    let state = createInitialConversationState('synonym_garment_test');

    const res = await processSaathiTurn('Style my blue kurta', state, mockContext);

    // Should resolve to the existing Indigo kurti without claiming missing
    expect(res.message).not.toContain("I couldn't find a blue kurta in your wardrobe");
    expect(res.domainResult?.outfits).toBeDefined();

    const topOutfit = res.domainResult!.outfits![0];
    const pieceIds = Object.values(topOutfit.slots || {})
      .flat()
      .map((p: any) => p.id);

    expect(pieceIds).toContain('sample-blue-kurti');
  });

  it('4. Handles hypothetical standalone questions about missing garments without previous context', async () => {
    let state = createInitialConversationState('standalone_missing_test');

    const res = await processSaathiTurn('Can I wear my purple trenchcoat today?', state, mockContext);

    expect(res.message).toContain("I couldn't find a");
    expect(res.message.toLowerCase()).toContain('purple trenchcoat');
    expect(res.message).toContain('in your wardrobe');
  });

  it('5. Works safely in personal wardrobe with custom items and strictly rejects unowned pieces', async () => {
    const singleItemCloset: WardrobeItem[] = [
      {
        id: 'user-kurta-1',
        name: 'Ivory Chanderi Silk Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['ivory', 'white'],
        seasons: ['summer', 'monsoon', 'winter'],
        occasions: ['college', 'family function', 'puja'],
        formality: 3,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
        createdAt: 1795435131426,
        fabric: 'chanderi',
        pattern: 'solid',
        fit: 'regular',
        culturalContext: 'traditional',
      },
    ];

    const personalContext: SaathiToolContext = {
      ...mockContext,
      wardrobe: singleItemCloset,
    };

    let state = createInitialConversationState('personal_wardrobe_test');

    // Existing piece styles
    const resExisting = await processSaathiTurn('Style my ivory kurta', state, personalContext);
    expect(resExisting.message).not.toContain("I couldn't find a ivory kurta");

    // Missing piece explicitly rejected
    const resMissing = await processSaathiTurn('Can I wear my denim jacket with this?', state, personalContext);
    expect(resMissing.message).toContain("I couldn't find a");
    expect(resMissing.message.toLowerCase()).toContain('denim jacket');
    expect(resMissing.message).toContain('in your wardrobe');
  });
});
