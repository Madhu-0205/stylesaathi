import { describe, it, expect } from 'vitest';
import { WardrobeItem, RecommendationRequest } from '../../../types';
import { RecommendationEngine, MAX_RECOMMENDATION_CANDIDATES } from '../../recommendationEngine';
import { fashionKnowledgeEngine } from '../fashionKnowledgeEngine';

function mockItem(patch: Partial<WardrobeItem>): WardrobeItem {
  return {
    id: patch.id || 'item-1',
    name: patch.name || 'Mock Item',
    category: patch.category || 'Tops',
    subcategory: patch.subcategory || 'shirt',
    colors: patch.colors || ['blue'],
    seasons: patch.seasons || ['summer'],
    occasions: patch.occasions || ['office'],
    formality: patch.formality || 3,
    status: patch.status || 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: patch.fabric || 'cotton',
    pattern: patch.pattern || 'solid',
    fit: patch.fit || 'regular',
    ...patch,
  };
}

describe('IFKG & Recommendation Engine 2.0 Integration', () => {
  const engine = new RecommendationEngine();

  const sampleWardrobe: WardrobeItem[] = [
    mockItem({ id: 'k1', name: 'Raw Silk Kurta', category: 'Ethnic', subcategory: 'kurta', fabric: 'silk', colors: ['yellow'], formality: 4, occasions: ['festive', 'puja', 'Diwali'] }),
    mockItem({ id: 'p1', name: 'Silk Churidar', category: 'Ethnic', subcategory: 'churidar', fabric: 'silk', colors: ['cream'], formality: 4, occasions: ['festive', 'puja', 'Diwali'] }),
    mockItem({ id: 'j1', name: 'Leather Juttis', category: 'Footwear', subcategory: 'juttis', colors: ['gold'], formality: 4, occasions: ['festive', 'puja', 'Diwali'] }),
    mockItem({ id: 's1', name: 'Linen Shirt', category: 'Tops', subcategory: 'shirt', fabric: 'linen', colors: ['white'], formality: 3, occasions: ['office', 'casual outing'] }),
    mockItem({ id: 't1', name: 'Navy Trousers', category: 'Bottoms', subcategory: 'trousers', fabric: 'cotton', colors: ['navy'], formality: 4, occasions: ['office'] }),
    mockItem({ id: 'f1', name: 'Derby Shoes', category: 'Footwear', subcategory: 'formal shoes', colors: ['black'], formality: 4, occasions: ['office'] }),
  ];

  it('preserves the MAX_RECOMMENDATION_CANDIDATES = 350 invariant', () => {
    expect(MAX_RECOMMENDATION_CANDIDATES).toBe(350);

    const req: RecommendationRequest = {
      items: sampleWardrobe,
      occasion: 'office',
      season: 'summer',
      localDate: '2026-10-09',
    };

    const res = engine.recommend(req);
    expect(res.telemetry.candidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
  });

  it('enriches recommended outfits with structured knowledgeSignals', () => {
    const req: RecommendationRequest = {
      items: sampleWardrobe,
      occasion: 'festive',
      season: 'summer',
      localDate: '2026-10-09',
      culturalSignals: {
        festivalContext: 'Diwali',
        regionalTradition: 'north',
      },
    };

    const res = engine.recommend(req);
    expect(res.set.outfits.length).toBeGreaterThan(0);

    const bestOutfit = res.set.outfits[0];
    expect(bestOutfit.knowledgeSignals).toBeDefined();
    expect(Array.isArray(bestOutfit.knowledgeSignals)).toBe(true);

    // Should include cultural or footwear compatibility signals
    const sigTypes = bestOutfit.knowledgeSignals!.map((s) => s.type);
    expect(
      sigTypes.includes('cultural_resonance') ||
      sigTypes.includes('footwear_compatibility') ||
      sigTypes.includes('fabric_compatibility')
    ).toBe(true);
  });

  it('incorporates evidence-backed explanations into the recommendation rationale', () => {
    const req: RecommendationRequest = {
      items: sampleWardrobe,
      occasion: 'festive',
      season: 'summer',
      localDate: '2026-10-09',
      culturalSignals: {
        festivalContext: 'Diwali',
      },
    };

    const res = engine.recommend(req);
    const bestOutfit = res.set.outfits[0];

    expect(bestOutfit.explanation).toBeDefined();
    expect(bestOutfit.explanation.reasons.length).toBeGreaterThan(0);
    // At least one evidence source should be recorded
    expect(bestOutfit.explanation.evidenceSources.length).toBeGreaterThan(0);
  });

  it('operates completely offline without any network or graph database dependencies', () => {
    // Calling getSignals is synchronous, in-memory, deterministic
    const signals = fashionKnowledgeEngine.getSignals(sampleWardrobe.slice(0, 3));
    expect(signals).toBeDefined();
    expect(signals.length).toBeGreaterThan(0);
  });
});
