import { describe, it, expect } from 'vitest';
import { computeWearAnalytics } from '../wearAnalyticsEngine';
import { WardrobeItem, WearEvent, Category, FabricType, PatternType, SilhouetteFit } from '../../../types';

const BASE_TS = 1700000000000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function generateBenchmarkDataset(
  numItems: number,
  numEvents: number
): { items: WardrobeItem[]; events: WearEvent[] } {
  const items: WardrobeItem[] = [];
  const fabrics: FabricType[] = ['cotton', 'silk', 'linen', 'denim', 'wool', 'viscose'];
  const patterns: PatternType[] = ['solid', 'striped', 'floral', 'bandhani', 'ikat'];
  const fits: SilhouetteFit[] = ['slim', 'regular', 'relaxed', 'tailored', 'oversized'];
  const categories: Category[] = ['Tops', 'Bottoms', 'Ethnic', 'Dresses', 'Outerwear'];

  for (let i = 0; i < numItems; i++) {
    items.push({
      id: `bench-item-${i}`,
      name: `Benchmark Garment ${i}`,
      category: categories[i % categories.length],
      subcategory: 'shirt',
      colors: [i % 2 === 0 ? 'Black' : 'White', i % 3 === 0 ? 'Blue' : 'Red'],
      fabric: fabrics[i % fabrics.length],
      pattern: patterns[i % patterns.length],
      fit: fits[i % fits.length],
      seasons: ['summer'],
      formality: (i % 5) + 1,
      occasions: ['office', 'casual outing'],
      status: 'clean',
      favorite: false,
      note: '',
      timesWorn: Math.floor(i % 10),
      purchasePrice: 1000 + (i % 5) * 500,
      createdAt: BASE_TS - 120 * ONE_DAY_MS,
      lastWorn: BASE_TS - ((i % 80) + 1) * ONE_DAY_MS,
    });
  }

  const events: WearEvent[] = [];
  for (let j = 0; j < numEvents; j++) {
    const itemIndex = j % numItems;
    const daysAgo = (j % 90) + 1;
    events.push({
      id: `bench-event-${j}`,
      userId: 'user_bench',
      outfitId: `bench-outfit-${Math.floor(j / 3)}`,
      wardrobeItemId: `bench-item-${itemIndex}`,
      wornAt: BASE_TS - daysAgo * ONE_DAY_MS,
      createdAt: BASE_TS - daysAgo * ONE_DAY_MS,
      plannedDate: '2023-11-14',
    });
  }

  return { items, events };
}

function runBenchmark(items: WardrobeItem[], events: WearEvent[]): number {
  // 10 Warmups
  for (let i = 0; i < 10; i++) {
    computeWearAnalytics(items, events, BASE_TS);
  }

  // 50 Timed Iterations
  const iterations = 50;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    computeWearAnalytics(items, events, BASE_TS);
  }
  const end = performance.now();

  const avgMs = (end - start) / iterations;
  return avgMs;
}

describe('Wear Analytics Performance Benchmark', () => {
  it('15 items, 50 events — Target: < 0.5ms', () => {
    const { items, events } = generateBenchmarkDataset(15, 50);
    const avgMs = runBenchmark(items, events);
    console.log(`[BENCHMARK] 15 items, 50 events: ${avgMs.toFixed(3)}ms (Target: <0.5ms)`);
    expect(avgMs).toBeLessThan(0.5);
  });

  it('50 items, 250 events — Target: < 1.0ms', () => {
    const { items, events } = generateBenchmarkDataset(50, 250);
    const avgMs = runBenchmark(items, events);
    console.log(`[BENCHMARK] 50 items, 250 events: ${avgMs.toFixed(3)}ms (Target: <1.0ms)`);
    expect(avgMs).toBeLessThan(1.0);
  });

  it('150 items, 1,000 events — Target: < 2.0ms', () => {
    const { items, events } = generateBenchmarkDataset(150, 1000);
    const avgMs = runBenchmark(items, events);
    console.log(`[BENCHMARK] 150 items, 1,000 events: ${avgMs.toFixed(3)}ms (Target: <2.0ms)`);
    expect(avgMs).toBeLessThan(2.0);
  });

  it('500 items, 5,000 events — Target: < 4.0ms', () => {
    const { items, events } = generateBenchmarkDataset(500, 5000);
    const avgMs = runBenchmark(items, events);
    console.log(`[BENCHMARK] 500 items, 5,000 events: ${avgMs.toFixed(3)}ms (Target: <4.0ms)`);
    expect(avgMs).toBeLessThan(4.0);
  });

  it('1,000 items, 10,000 events — Target: < 6.0ms', () => {
    const { items, events } = generateBenchmarkDataset(1000, 10000);
    const avgMs = runBenchmark(items, events);
    console.log(`[BENCHMARK] 1,000 items, 10,000 events: ${avgMs.toFixed(3)}ms (Target: <6.0ms)`);
    expect(avgMs).toBeLessThan(6.0);
  });
});
