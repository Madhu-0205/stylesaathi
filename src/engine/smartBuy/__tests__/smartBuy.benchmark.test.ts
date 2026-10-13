import { describe, it, expect } from 'vitest';
import { computeWardrobeGaps } from '../smartBuyEngine';
import { WardrobeItem, OutfitPlan } from '../../../types';
import { WearAnalyticsReport } from '../../analytics/types';

describe('Phase 9 — Smart Buy 2.0: Performance Benchmark', () => {
  const FIXED_TIMESTAMP = 1718000000000;

  function generateSyntheticWardrobe(count: number): WardrobeItem[] {
    const categories: ('Tops' | 'Bottoms' | 'Ethnic' | 'Footwear' | 'Outerwear' | 'Dresses')[] = [
      'Tops',
      'Bottoms',
      'Ethnic',
      'Footwear',
      'Outerwear',
      'Dresses',
    ];
    const subcats: Record<string, string[]> = {
      Tops: ['shirt', 't-shirt', 'top'],
      Bottoms: ['jeans', 'trousers', 'palazzo'],
      Ethnic: ['kurta', 'dupatta', 'saree', 'blouse'],
      Footwear: ['sneakers', 'formal shoes', 'loafers', 'flats'],
      Outerwear: ['jacket', 'blazer', 'cardigan'],
      Dresses: ['dress', 'maxi dress'],
    };

    const items: WardrobeItem[] = [];
    for (let i = 0; i < count; i++) {
      const cat = categories[i % categories.length];
      const sub = subcats[cat][i % subcats[cat].length];
      items.push({
        id: `bench_item_${i}`,
        name: `Synthetic ${cat} ${i}`,
        category: cat,
        subcategory: sub as any,
        status: i % 10 === 0 ? 'in_laundry' : 'clean',
        timesWorn: (i % 20) + 1,
        createdAt: FIXED_TIMESTAMP - (i % 300) * 86400000,
        lastWorn: FIXED_TIMESTAMP - (i % 60) * 86400000,
        colors: ['navy'],
        formality: (i % 4) + 1,
        favorite: false,
        note: '',
        seasons: ['summer', 'winter'],
        occasions: ['everyday', 'office', 'casual outing'],
      });
    }
    return items;
  }

  function generateSyntheticWearAnalytics(
    items: WardrobeItem[],
    totalWears: number
  ): WearAnalyticsReport {
    const reconciledWears: Record<string, any> = {};
    for (const item of items) {
      reconciledWears[item.id] = {
        itemId: item.id,
        counterTimesWorn: item.timesWorn || 1,
        canonicalEventCount: item.timesWorn || 1,
        legacyWearsDelta: 0,
        reconciliationCase: 'A_MATCH',
        effectiveLifetimeWears: item.timesWorn || 1,
      };
    }

    return {
      generatedAt: FIXED_TIMESTAMP,
      referenceTimestamp: FIXED_TIMESTAMP,
      totalLifetimeWears: totalWears,
      uniqueWornItemsCount: items.length,
      mostWornItems: [],
      dormantItems: [],
      reconciledWears,
      snapshots: {} as any,
      evolution: {} as any,
      rotation: {
        isEligible: true,
        confidence: 0.8,
        totalCleanItems: items.length,
        activeCount: Math.floor(items.length * 0.7),
        occasionalCount: Math.floor(items.length * 0.2),
        dormantCount: Math.floor(items.length * 0.1),
        neverWornCount: 0,
        itemsByState: {
          active: [],
          occasional: [],
          dormant: [],
          never_worn: [],
        },
      },
      concentration: {
        isEligible: true,
        confidence: 0.8,
        kItemsCount: 5,
        totalWardrobeCount: items.length,
        topKWears: 20,
        totalLifetimeWears: totalWears,
        interpretation: 'Balanced Rotation',
        explanation: 'Balanced wear distribution.',
      },
      orphans: {
        unresolvedOrphanCount: 0,
        explanation: 'No orphan events.',
      },
    };
  }

  function benchmarkTier(itemCount: number, wearCount: number) {
    const wardrobe = generateSyntheticWardrobe(itemCount);
    const wearAnalytics = generateSyntheticWearAnalytics(wardrobe, wearCount);
    const outfitPlans: OutfitPlan[] = [
      {
        id: 'p1',
        date: '2026-10-15',
        occasion: 'office',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
      {
        id: 'p2',
        date: '2026-10-16',
        occasion: 'casual outing',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
      {
        id: 'p3',
        date: '2026-10-17',
        occasion: 'everyday',
        status: 'planned',
        outfit: {} as any,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      },
    ];

    const input = {
      wardrobe,
      wearAnalytics,
      outfitPlans,
      referenceTimestamp: FIXED_TIMESTAMP,
    };

    // 10 Warmups
    for (let i = 0; i < 10; i++) {
      computeWardrobeGaps(input);
    }

    // 50 Timed iterations
    const durations: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      computeWardrobeGaps(input);
      const t1 = performance.now();
      durations.push(t1 - t0);
    }

    const meanMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    return { meanMs, durations };
  }

  it('Tier 1: 15 items, 50 wears (Target: < 0.5 ms)', () => {
    const { meanMs } = benchmarkTier(15, 50);
    console.log(`[Benchmark Tier 1] 15 items, 50 wears: ${meanMs.toFixed(3)} ms (Target: < 0.5 ms)`);
    expect(meanMs).toBeLessThan(0.5);
  });

  it('Tier 2: 50 items, 250 wears (Target: < 1.0 ms)', () => {
    const { meanMs } = benchmarkTier(50, 250);
    console.log(`[Benchmark Tier 2] 50 items, 250 wears: ${meanMs.toFixed(3)} ms (Target: < 1.0 ms)`);
    expect(meanMs).toBeLessThan(1.0);
  });

  it('Tier 3: 150 items, 1,000 wears (Target: < 2.0 ms)', () => {
    const { meanMs } = benchmarkTier(150, 1000);
    console.log(`[Benchmark Tier 3] 150 items, 1,000 wears: ${meanMs.toFixed(3)} ms (Target: < 2.0 ms)`);
    expect(meanMs).toBeLessThan(2.0);
  });

  it('Tier 4: 500 items, 5,000 wears (Target: < 4.0 ms)', () => {
    const { meanMs } = benchmarkTier(500, 5000);
    console.log(`[Benchmark Tier 4] 500 items, 5,000 wears: ${meanMs.toFixed(3)} ms (Target: < 4.0 ms)`);
    expect(meanMs).toBeLessThan(4.0);
  });

  it('Tier 5: 1,000 items, 10,000 wears (Target: < 8.0 ms)', () => {
    const { meanMs } = benchmarkTier(1000, 10000);
    console.log(`[Benchmark Tier 5] 1,000 items, 10,000 wears: ${meanMs.toFixed(3)} ms (Target: < 8.0 ms)`);
    expect(meanMs).toBeLessThan(8.0);
  });
});
