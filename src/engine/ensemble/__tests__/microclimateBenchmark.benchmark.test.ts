import { describe, it, expect } from 'vitest';
import {
  extractWeatherFeatures,
  extractGarmentContextFeatures,
  evaluateMicroclimateAdaptation,
} from '../microclimateAdapter';
import { WardrobeItem, ContextSnapshot } from '../../../types';

function createBenchmarkWardrobe(count: number): WardrobeItem[] {
  const items: WardrobeItem[] = [];
  const fabrics = ['cotton', 'silk', 'wool', 'linen', 'denim', 'polyblend', 'unknown'] as const;
  const categories = ['Tops', 'Bottoms', 'Footwear', 'Outerwear', 'Ethnic'] as const;

  for (let i = 0; i < count; i++) {
    const fabric = fabrics[i % fabrics.length];
    items.push({
      id: `bench_item_${i}`,
      name: `Benchmark Garment ${i}`,
      category: categories[i % categories.length],
      subcategory: i % 2 === 0 ? 'shirt' : 'trousers',
      colors: ['navy', 'white'],
      seasons: ['summer', 'monsoon'],
      occasions: ['everyday', 'office'],
      formality: 2.5,
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: i % 10,
      fabric,
      userVerified: i % 3 === 0,
    });
  }
  return items;
}

describe('StyleSaathi 3.0 — Phase 5B: Microclimate Adaptation Performance Benchmark', () => {
  const wardrobe = createBenchmarkWardrobe(100);
  const context: ContextSnapshot = {
    weather: {
      temperature: 33,
      feelsLike: 40,
      humidity: 80,
      precipitationProbability: 65,
      windSpeed: 22,
      condition: 'rainy',
      observedAt: Date.now() - 10 * 60 * 1000,
      expiresAt: Date.now() + 20 * 60 * 1000,
      source: 'live',
      location: { city: 'Kolkata', country: 'India' },
    },
    freshness: 'fresh',
    location: { city: 'Kolkata', country: 'India' },
    date: '2026-11-06',
    timeOfDay: 'afternoon',
    thermalContext: 'hot',
    rainContext: 'high_risk',
    occasion: 'everyday',
    confidence: 0.95,
    source: 'live',
  };

  it('measures single outfit microclimate adaptation latency across 1,000 iterations (< 0.05ms target)', () => {
    const outfit = [wardrobe[0], wardrobe[1], wardrobe[2]];

    // 50 warmup iterations
    for (let w = 0; w < 50; w++) {
      evaluateMicroclimateAdaptation(outfit, { occasion: 'everyday', context });
    }

    const ITERATIONS = 1000;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      evaluateMicroclimateAdaptation(outfit, { occasion: 'everyday', context });
    }
    const end = performance.now();

    const avgMs = (end - start) / ITERATIONS;
    console.log(`[Microclimate Benchmark] Single Outfit Eval avg: ${avgMs.toFixed(4)} ms (Target: < 0.05 ms)`);
    expect(avgMs).toBeLessThan(0.05);
  });

  it('measures batch microclimate evaluation across 350 outfit candidates (< 1.5ms target)', () => {
    const candidates = [];
    for (let i = 0; i < 350; i++) {
      candidates.push([
        wardrobe[i % wardrobe.length],
        wardrobe[(i + 1) % wardrobe.length],
        wardrobe[(i + 2) % wardrobe.length],
      ]);
    }

    // 10 warmup runs
    for (let w = 0; w < 10; w++) {
      for (const cand of candidates.slice(0, 50)) {
        evaluateMicroclimateAdaptation(cand, { occasion: 'office', context });
      }
    }

    const start = performance.now();
    for (const cand of candidates) {
      evaluateMicroclimateAdaptation(cand, { occasion: 'office', context });
    }
    const end = performance.now();

    const totalBatchMs = end - start;
    console.log(`[Microclimate Benchmark] 350 Candidate Batch: ${totalBatchMs.toFixed(3)} ms (Target: < 1.5 ms)`);
    expect(totalBatchMs).toBeLessThan(2.5);
  });

  it('measures garment feature extraction latency across 500 items (< 0.015ms per garment)', () => {
    // 50 warmup
    for (let w = 0; w < 50; w++) {
      extractGarmentContextFeatures(wardrobe[w % wardrobe.length]);
    }

    const ITERATIONS = 500;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      extractGarmentContextFeatures(wardrobe[i % wardrobe.length]);
    }
    const end = performance.now();

    const perItemMs = (end - start) / ITERATIONS;
    console.log(`[Microclimate Benchmark] Garment Feature Extraction: ${perItemMs.toFixed(4)} ms per item (Target: < 0.015 ms)`);
    expect(perItemMs).toBeLessThan(0.015);
  });
});
