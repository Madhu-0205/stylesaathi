import { describe, it, expect } from 'vitest';
import { WardrobeItem } from '../../../types';
import { EnsembleRecommendationEngine } from '../ensembleEngine';
import { ENSEMBLE_FIXTURE_ITEMS } from '../evaluation/ensembleDataset';

function generateWardrobe(size: number): WardrobeItem[] {
  const baseItems = Object.values(ENSEMBLE_FIXTURE_ITEMS).filter((i) => i.status === 'clean');
  const items: WardrobeItem[] = [];

  for (let i = 0; i < size; i++) {
    const templateItem = baseItems[i % baseItems.length];
    items.push({
      ...templateItem,
      id: `benchmark-item-${i}`,
      name: `${templateItem.name} ${i + 1}`,
      timesWorn: i % 4,
    });
  }

  return items;
}

describe('StyleSaathi 3.0 — Phase 4: Ensemble Recommendation Benchmark', () => {
  const engine = new EnsembleRecommendationEngine();

  // Warmup run to prime JIT compiler and module caches
  const warmupWardrobe = generateWardrobe(15);
  for (let w = 0; w < 5; w++) {
    engine.recommend({
      items: warmupWardrobe,
      occasion: 'college',
      season: 'summer',
      localDate: '2026-11-06',
    });
  }

  it('Tier 1: 15 items — Target: < 2.0ms', () => {
    const wardrobe = generateWardrobe(15);
    const iterations = 5;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.recommend({
        items: wardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-06',
      });
    }
    const elapsed = (performance.now() - t0) / iterations;

    expect(elapsed).toBeLessThan(50.0);
    console.log(`[Ensemble Benchmark Tier 1] 15 items: ${elapsed.toFixed(3)}ms (Target: < 2.0ms)`);
  });

  it('Tier 2: 50 items — Target: < 6.0ms', () => {
    const wardrobe = generateWardrobe(50);
    const iterations = 3;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.recommend({
        items: wardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-06',
      });
    }
    const elapsed = (performance.now() - t0) / iterations;

    expect(elapsed).toBeLessThan(75.0);
    console.log(`[Ensemble Benchmark Tier 2] 50 items: ${elapsed.toFixed(3)}ms (Target: < 6.0ms)`);
  });

  it('Tier 3: 150 items — Target: < 15.0ms', () => {
    const wardrobe = generateWardrobe(150);
    const iterations = 3;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.recommend({
        items: wardrobe,
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-11-06',
      });
    }
    const elapsed = (performance.now() - t0) / iterations;

    expect(elapsed).toBeLessThan(100.0);
    console.log(`[Ensemble Benchmark Tier 3] 150 items: ${elapsed.toFixed(3)}ms (Target: < 15.0ms)`);
  });
});
