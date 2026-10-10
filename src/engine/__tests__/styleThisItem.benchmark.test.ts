import { describe, it, expect } from 'vitest';
import { RecommendationEngine, MAX_RECOMMENDATION_CANDIDATES } from '../recommendationEngine';
import { WardrobeItem, Category, Subcategory } from '../../types';

function createSyntheticWardrobe(totalCount: number): { items: WardrobeItem[]; anchorId: string } {
  const items: WardrobeItem[] = [];
  const anchorId = 'anchor_benchmark_shirt';

  // Anchor item
  items.push({
    id: anchorId,
    userId: 'benchmark_user',
    name: 'Benchmark Core Linen Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'office', 'casual outing', 'everyday'],
    formality: 3,
    status: 'clean',
    timesWorn: 5,
    favorite: false,
    note: '',
    fabric: 'linen',
    pattern: 'solid',
    fit: 'regular',
  });

  const categories: { category: Category; subcategories: Subcategory[] }[] = [
    { category: 'Tops', subcategories: ['shirt', 't-shirt', 'top'] },
    { category: 'Bottoms', subcategories: ['trousers', 'jeans', 'palazzo', 'churidar'] },
    { category: 'Footwear', subcategories: ['sneakers', 'loafers', 'flats', 'juttis'] },
    { category: 'Outerwear', subcategories: ['blazer', 'jacket', 'nehru jacket'] },
    { category: 'Ethnic', subcategories: ['kurta', 'dupatta', 'anarkali'] },
  ];

  const colors = ['navy', 'black', 'beige', 'grey', 'olive', 'brown', 'maroon', 'white'];
  const fabrics = ['cotton', 'linen', 'wool', 'denim', 'silk'];

  for (let i = 1; i < totalCount; i++) {
    const catGroup = categories[i % categories.length];
    const subcategory = catGroup.subcategories[i % catGroup.subcategories.length];
    const color = colors[i % colors.length];
    const fabric = fabrics[i % fabrics.length];

    items.push({
      id: `benchmark_item_${i}`,
      userId: 'benchmark_user',
      name: `Synthetic ${catGroup.category} ${i}`,
      category: catGroup.category,
      subcategory,
      colors: [color],
      seasons: ['summer', 'monsoon', 'winter'],
      occasions: ['college', 'office', 'casual outing', 'everyday'],
      formality: (i % 5) + 1,
      status: 'clean',
      timesWorn: i % 10,
      favorite: false,
      note: '',
      fabric: fabric as any,
      pattern: 'solid',
      fit: 'regular',
    });
  }

  return { items, anchorId };
}

describe('Phase 7: Style This Item Performance Benchmark', () => {
  const engine = new RecommendationEngine();

  const BENCHMARK_SIZES = [15, 50, 150, 500, 1000];
  const TARGETS: Record<number, { e2eMax: number; candidateLimit: number }> = {
    15: { e2eMax: 2.0, candidateLimit: 350 },
    50: { e2eMax: 3.0, candidateLimit: 350 },
    150: { e2eMax: 4.0, candidateLimit: 350 },
    500: { e2eMax: 5.0, candidateLimit: 350 },
    1000: { e2eMax: 6.0, candidateLimit: 350 },
  };

  const resultsTable: {
    wardrobeSize: number;
    candidateCount: number;
    genMs: number;
    scoringMs: number;
    totalMs: number;
    targetMs: number;
    status: string;
  }[] = [];

  for (const size of BENCHMARK_SIZES) {
    it(`benchmarks size ${size} items with 10 warm-ups and 50 timed iterations`, () => {
      const { items, anchorId } = createSyntheticWardrobe(size);

      const request = {
        items,
        occasion: 'college' as const,
        season: 'summer' as const,
        localDate: '2026-10-09',
        anchorItemId: anchorId,
      };

      // 1. 10 Warm-up iterations
      for (let w = 0; w < 10; w++) {
        engine.recommend(request);
      }

      // 2. 50 Timed iterations using performance.now()
      const ITERATIONS = 50;
      let totalGenTime = 0;
      let totalScoringTime = 0;
      let totalEndToEnd = 0;
      let lastCandidateCount = 0;

      for (let t = 0; t < ITERATIONS; t++) {
        const start = performance.now();
        const res = engine.recommend(request);
        const end = performance.now();

        totalEndToEnd += end - start;
        totalGenTime += res.telemetry.timings.candidateGenerationMs;
        totalScoringTime += res.telemetry.timings.scoringMs;
        lastCandidateCount = res.telemetry.candidateCount;

        // Invariant check on each iteration
        expect(res.telemetry.candidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
        if (res.set.outfits.length > 0) {
          expect(res.set.outfits[0].slots.top[0].id).toBe(anchorId);
        }
      }

      const avgGen = totalGenTime / ITERATIONS;
      const avgScore = totalScoringTime / ITERATIONS;
      const avgE2E = totalEndToEnd / ITERATIONS;
      const target = TARGETS[size].e2eMax;
      const passed = avgE2E <= target && lastCandidateCount <= MAX_RECOMMENDATION_CANDIDATES;

      resultsTable.push({
        wardrobeSize: size,
        candidateCount: lastCandidateCount,
        genMs: Number(avgGen.toFixed(3)),
        scoringMs: Number(avgScore.toFixed(3)),
        totalMs: Number(avgE2E.toFixed(3)),
        targetMs: target,
        status: passed ? 'PASS' : 'FAIL',
      });

      expect(lastCandidateCount).toBeLessThanOrEqual(MAX_RECOMMENDATION_CANDIDATES);
      expect(avgE2E).toBeLessThanOrEqual(target);
    });
  }

  it('prints comprehensive measured performance report table', () => {
    console.log('\n================================================================================');
    console.log('       STYLESAATHI PHASE 7 — STYLE THIS ITEM MEASURED BENCHMARK REPORT         ');
    console.log('================================================================================');
    console.log('| Wardrobe | Candidates | Generation (ms) | Scoring (ms) | End-to-End (ms) | Target (ms) | Status |');
    console.log('|---------:|-----------:|----------------:|-------------:|----------------:|------------:|:------:|');
    for (const r of resultsTable) {
      console.log(
        `| ${String(r.wardrobeSize).padStart(8)} | ${String(r.candidateCount).padStart(10)} | ${r.genMs.toFixed(3).padStart(15)} | ${r.scoringMs.toFixed(3).padStart(12)} | ${r.totalMs.toFixed(3).padStart(15)} | < ${r.targetMs.toFixed(1).padStart(7)} | ${r.status.padStart(6)} |`
      );
    }
    console.log('================================================================================\n');

    expect(resultsTable.length).toBe(BENCHMARK_SIZES.length);
    for (const r of resultsTable) {
      expect(r.status).toBe('PASS');
    }
  });
});
