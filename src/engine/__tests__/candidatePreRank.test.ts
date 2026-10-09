import { describe, it, expect } from 'vitest';
import { WardrobeItem, PersonalStyleProfile } from '../../types';
import { preRankSlotCandidates } from '../candidatePreRank';

const mockItem = (overrides: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id: 'item-1',
  name: 'Test Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer'],
  occasions: ['office'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  ...overrides,
});

describe('Candidate Pre-Ranking (Stratified Quota Model)', () => {
  it('caps output at maximum 10 candidates per slot even with large item pools', () => {
    // Generate 30 items
    const pool: WardrobeItem[] = Array.from({ length: 30 }, (_, i) =>
      mockItem({
        id: `top-${String(i).padStart(2, '0')}`,
        name: `Top ${i}`,
        timesWorn: i,
        favorite: i % 5 === 0,
      })
    );

    const candidates = preRankSlotCandidates(pool, 'top', 'office', 'summer');
    expect(candidates.length).toBeLessThanOrEqual(10);
    expect(candidates.length).toBe(10);
  });

  it('preserves stratified representation for core favorites, rotation, and novelty', () => {
    const favorites = [
      mockItem({ id: 'fav-1', favorite: true, timesWorn: 10 }),
      mockItem({ id: 'fav-2', favorite: true, timesWorn: 8 }),
    ];
    const underWornRotation = [
      mockItem({ id: 'rot-1', favorite: false, timesWorn: 0, lastWorn: undefined }),
      mockItem({ id: 'rot-2', favorite: false, timesWorn: 1, lastWorn: 1000 }),
    ];
    const noveltyUnderExplored = [
      mockItem({ id: 'nov-1', favorite: false, timesWorn: 0, colors: ['teal'] }),
    ];
    const ordinary = Array.from({ length: 15 }, (_, i) =>
      mockItem({ id: `ord-${i}`, timesWorn: 5, favorite: false })
    );

    const pool = [...favorites, ...underWornRotation, ...noveltyUnderExplored, ...ordinary];
    const candidates = preRankSlotCandidates(pool, 'top', 'office', 'summer');

    const ids = candidates.map((c) => c.id);
    // Core favorites must be represented
    expect(ids).toContain('fav-1');
    expect(ids).toContain('fav-2');
    // Rotation under-worn must be represented
    expect(ids).toContain('rot-1');
    expect(ids).toContain('rot-2');
    // Novelty must be represented
    expect(ids).toContain('nov-1');
  });

  it('uses deterministic secondary tie-breaking by item ID', () => {
    const identicalItems: WardrobeItem[] = [
      mockItem({ id: 'c-item', name: 'Item C' }),
      mockItem({ id: 'a-item', name: 'Item A' }),
      mockItem({ id: 'b-item', name: 'Item B' }),
    ];

    const result1 = preRankSlotCandidates(identicalItems, 'top', 'office', 'summer');
    const result2 = preRankSlotCandidates(identicalItems, 'top', 'office', 'summer');

    expect(result1.map((i) => i.id)).toEqual(result2.map((i) => i.id));
    expect(result1[0].id).toBe('a-item');
    expect(result1[1].id).toBe('b-item');
    expect(result1[2].id).toBe('c-item');
  });

  it('excludes items with strong learned negative avoidance from novelty quota', () => {
    const dislikedItem = mockItem({
      id: 'disliked-1',
      category: 'Tops',
      colors: ['orange'],
      timesWorn: 0,
    });
    const regularItem = mockItem({
      id: 'regular-1',
      category: 'Tops',
      colors: ['blue'],
      timesWorn: 0,
    });

    const styleProfile: PersonalStyleProfile = {
      version: 1,
      userId: 'user-1',
      totalSignalsCount: 10,
      overallConfidence: 0.8,
      updatedAt: Date.now(),
      colorAffinities: {
        orange: { score: -0.8, sampleCount: 5, confidence: 0.8, lastInteractedAt: Date.now() },
        blue: { score: 0.3, sampleCount: 5, confidence: 0.8, lastInteractedAt: Date.now() },
      },
      fabricAffinities: {} as any,
      patternAffinities: {} as any,
      fitAffinities: {} as any,
      culturalAffinities: {} as any,
      occasionAffinities: {} as any,
      itemAffinities: {
        'disliked-1': { score: -0.5, sampleCount: 1, confidence: 0.8, lastInteractedAt: Date.now() },
        'regular-1': { score: 0.2, sampleCount: 1, confidence: 0.8, lastInteractedAt: Date.now() },
      },
      combinationAffinities: {},
      avoidedColors: ['orange'],
      avoidedFabrics: [],
      avoidedPatterns: [],
      avoidedCombinations: [],
      neutralPreferenceRatio: 0.5,
      formalityBias: 0.0,
      noveltyTolerance: 0.5,
      topColors: ['blue'],
      topFabrics: [],
      topFits: [],
      recentExplorations: [],
    };

    const candidates = preRankSlotCandidates(
      [dislikedItem, regularItem],
      'top',
      'office',
      'summer',
      undefined,
      styleProfile
    );

    // Regular item should rank ahead of strongly avoided orange item
    expect(candidates[0].id).toBe('regular-1');
  });
});
