import { describe, it, expect } from 'vitest';
import { generateEnsembleCandidates } from '../candidateGenerator';
import { ENSEMBLE_FIXTURE_ITEMS } from '../evaluation/ensembleDataset';

describe('StyleSaathi 3.0 — Anchor-Based Candidate Generator', () => {
  const sampleWardrobe = [
    ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed,
    ENSEMBLE_FIXTURE_ITEMS.silkBlouseGold,
    ENSEMBLE_FIXTURE_ITEMS.goldJuttis,
    ENSEMBLE_FIXTURE_ITEMS.mustardKurtiCotton,
    ENSEMBLE_FIXTURE_ITEMS.slimBlueJeans,
    ENSEMBLE_FIXTURE_ITEMS.whiteSneakers,
    ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
    ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer,
    ENSEMBLE_FIXTURE_ITEMS.linenShirtWhite,
    ENSEMBLE_FIXTURE_ITEMS.chinosBeige,
    ENSEMBLE_FIXTURE_ITEMS.brownLoafers,
  ];

  it('generates valid candidates when no anchor is specified', () => {
    const candidates = generateEnsembleCandidates(sampleWardrobe, {
      occasion: 'everyday',
      season: 'summer',
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const cand of candidates) {
      expect(cand.pieces.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('strictly preserves locked anchor in 100% of generated candidates', () => {
    const anchor = ENSEMBLE_FIXTURE_ITEMS.mustardKurtiCotton;
    const candidates = generateEnsembleCandidates(sampleWardrobe, {
      anchor: {
        item: anchor,
        role: 'top',
        isLocked: true,
        origin: 'user_selected',
      },
      occasion: 'college',
      season: 'summer',
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const cand of candidates) {
      const hasAnchor = cand.pieces.some((p) => p.id === anchor.id);
      expect(hasAnchor).toBe(true);
    }
  });

  it('never replaces user-selected locked saree anchor', () => {
    const saree = ENSEMBLE_FIXTURE_ITEMS.kanjivaramSareeRed;
    const candidates = generateEnsembleCandidates(sampleWardrobe, {
      anchor: {
        item: saree,
        role: 'dress',
        isLocked: true,
        origin: 'user_selected',
      },
      occasion: 'wedding guest',
      season: 'winter',
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const cand of candidates) {
      expect(cand.template.name).toBe('Saree look');
      const hasSaree = cand.pieces.some((p) => p.id === saree.id);
      expect(hasSaree).toBe(true);
    }
  });

  it('promotes outerwear anchor to required slot in layered templates', () => {
    const blazer = ENSEMBLE_FIXTURE_ITEMS.navyTailoredBlazer;
    const candidates = generateEnsembleCandidates(sampleWardrobe, {
      anchor: {
        item: blazer,
        role: 'layer',
        isLocked: true,
        origin: 'user_selected',
      },
      occasion: 'office',
      season: 'winter',
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const cand of candidates) {
      const hasBlazer = cand.pieces.some((p) => p.id === blazer.id);
      expect(hasBlazer).toBe(true);
    }
  });

  it('caps total candidates within safety budget to avoid combinatorial explosion', () => {
    // Large synthetic wardrobe (50 items)
    const largeWardrobe = Array.from({ length: 50 }, (_, i) => ({
      ...ENSEMBLE_FIXTURE_ITEMS.basicWhiteTee,
      id: `synthetic-item-${i}`,
      category: (i % 3 === 0 ? 'Tops' : i % 3 === 1 ? 'Bottoms' : 'Footwear') as any,
    }));

    const candidates = generateEnsembleCandidates(largeWardrobe, {
      occasion: 'everyday',
      season: 'summer',
      maxCandidates: 100,
    });

    expect(candidates.length).toBeLessThanOrEqual(100);
  });
});
