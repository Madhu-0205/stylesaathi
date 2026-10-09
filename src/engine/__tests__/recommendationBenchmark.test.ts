import { describe, it } from 'vitest';
import { WardrobeItem, RecommendationRequest } from '../../types';
import { RecommendationEngine } from '../recommendationEngine';

function generateBenchmarkWardrobe(count: number): WardrobeItem[] {
  const categories: ('Tops' | 'Bottoms' | 'Ethnic' | 'Footwear' | 'Outerwear' | 'Dresses' | 'Accessories')[] = [
    'Tops',
    'Bottoms',
    'Ethnic',
    'Footwear',
  ];
  const subcategories: Record<string, string[]> = {
    Tops: ['shirt', 't-shirt'],
    Bottoms: ['trousers', 'jeans', 'chinos'],
    Ethnic: ['kurta', 'kurti', 'palazzo', 'nehru jacket', 'dupatta'],
    Footwear: ['sneakers', 'formal shoes', 'loafers', 'juttis', 'flats'],
  };
  const colors = ['white', 'black', 'navy', 'grey', 'yellow', 'blue', 'beige', 'gold', 'red'];
  const fabrics = ['cotton', 'linen', 'silk', 'denim', 'wool'];
  const occasions: ('office' | 'casual outing' | 'college' | 'puja' | 'festive')[] = [
    'office',
    'casual outing',
    'college',
    'puja',
    'festive',
  ];

  const items: WardrobeItem[] = [];
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const subs = subcategories[category] || ['shirt'];
    const subcategory = subs[i % subs.length] as any;
    const color = colors[i % colors.length];
    const fabric = fabrics[i % fabrics.length] as any;
    const occasion = occasions[i % occasions.length];

    items.push({
      id: `item-${String(i).padStart(4, '0')}`,
      name: `${color} ${subcategory} #${i}`,
      category,
      subcategory,
      colors: [color],
      fabric,
      seasons: ['summer', 'monsoon'],
      occasions: [occasion, 'casual outing'],
      formality: (i % 5) + 1,
      status: 'clean',
      favorite: i % 10 === 0,
      note: '',
      timesWorn: i % 8,
      lastWorn: Date.now() - (i * 86400000),
      createdAt: Date.now() - (i * 86400000),
    });
  }
  return items;
}

describe('Recommendation Engine 2.0 Performance Benchmark', () => {
  const engine = new RecommendationEngine();
  const benchmarkSizes = [15, 50, 150, 500, 1000];

  for (const size of benchmarkSizes) {
    it(`benchmarks wardrobe scale of ${size} items`, () => {
      const wardrobe = generateBenchmarkWardrobe(size);
      const req: RecommendationRequest = {
        items: wardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-10-09',
        explorationSeedOffset: 0,
        limit: 3,
      };

      // Warmup run
      engine.recommend(req);

      // Timed runs (average of 3)
      let totalMs = 0;
      let genMs = 0;
      let hardMs = 0;
      let scoreMs = 0;
      let divMs = 0;
      let candCount = 0;
      let validCount = 0;
      const iterations = 3;

      for (let i = 0; i < iterations; i++) {
        const res = engine.recommend(req);
        totalMs += res.telemetry.timings.totalMs;
        genMs += res.telemetry.timings.candidateGenerationMs;
        hardMs += res.telemetry.timings.hardFilteringMs;
        scoreMs += res.telemetry.timings.scoringMs;
        divMs += res.telemetry.timings.diversificationMs;
        candCount = res.telemetry.candidateCount;
        validCount = res.telemetry.validCandidateCount;
      }

      console.log(
        `[BENCHMARK] ${size} items: Total=${(totalMs / iterations).toFixed(2)}ms | Gen=${(genMs / iterations).toFixed(2)}ms | HardFilter=${(hardMs / iterations).toFixed(2)}ms | Score=${(scoreMs / iterations).toFixed(2)}ms | Div=${(divMs / iterations).toFixed(2)}ms | Candidates=${candCount} (Valid=${validCount})`
      );
    });
  }
});
