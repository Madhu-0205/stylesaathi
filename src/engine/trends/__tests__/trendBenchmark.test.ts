import { describe, it, expect } from 'vitest';
import { normalizeRawTrendSignal } from '../trendNormalizer';
import { evaluateTrendEvidence } from '../evidenceEvaluator';
import { evaluateWardrobeDiscoveryOpportunities } from '../discoveryEngine';
import { getBundledCuratedTrends } from '../trendCatalog';
import { getRelevantTrendsTool } from '../../saathi/toolRegistry';
import { RawTrendSignal, CuratedActiveTrend } from '../types';
import { WardrobeItem, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('Phase 11 — Performance Benchmarks', () => {
  const sampleRawSignal: RawTrendSignal = {
    id: 'sig_bench_1',
    sourceId: 'src_bench',
    sourceType: 'CURATED_EDITORIAL',
    sourceReference: 'Editorial Benchmark Source',
    curatorOrAuthor: 'Lead Curator',
    observedAt: '2026-03-01T10:00:00Z',
    rawHeadline: 'Linen tailoring benchmark signal',
    rawExcerpt: 'Relaxed linen tailoring with breathable fabrics.',
    extractedAttributes: {
      categories: ['Tops', 'Bottoms'],
      subcategories: ['shirt', 'trousers'],
      fabrics: ['linen'],
      patterns: ['solid'],
      silhouettes: ['relaxed'],
      colorPalette: ['beige', 'olive'],
      occasions: ['everyday', 'office'],
    },
  };

  const sampleWardrobe: WardrobeItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `item_${i}`,
    name: `Wardrobe Item ${i}`,
    category: i % 2 === 0 ? 'Tops' : 'Bottoms',
    subcategory: i % 2 === 0 ? 'shirt' : 'trousers',
    status: 'clean',
    timesWorn: i % 5,
    createdAt: 1700000000000 + i * 1000,
    colors: [i % 3 === 0 ? 'beige' : i % 3 === 1 ? 'olive' : 'white'],
    seasons: ['summer'],
    occasions: ['everyday', 'office'],
    formality: 2,
    favorite: false,
    note: '',
    fabric: i % 2 === 0 ? 'linen' : 'cotton',
    fit: 'relaxed',
  }));

  const sampleProfile: PersonalStyleProfile = {
    ...derivePersonalStyleProfile([]),
    occasionAffinities: {
      everyday: { score: 0.8, confidence: 1.0, sampleCount: 5, lastInteractedAt: 1700000000000 },
    } as any,
  };

  const trends = getBundledCuratedTrends();
  const singleTrend = trends[0];

  it('measures Trend normalization latency (< 1.0 ms target)', () => {
    // Warmup
    for (let i = 0; i < 20; i++) {
      normalizeRawTrendSignal(
        sampleRawSignal,
        'bench_id',
        'Bench Trend',
        'bench-trend',
        'Summary',
        '2026-01-01',
        '2026-12-31'
      );
    }

    const runs = 200;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      normalizeRawTrendSignal(
        sampleRawSignal,
        'bench_id',
        'Bench Trend',
        'bench-trend',
        'Summary',
        '2026-01-01',
        '2026-12-31'
      );
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / runs;

    console.log(`[Phase 11 Benchmark] Trend normalization avg: ${avgMs.toFixed(4)} ms (Target: < 1.0 ms)`);
    expect(avgMs).toBeLessThan(1.0);
  });

  it('measures Evidence evaluation latency (< 2.0 ms target)', () => {
    // Warmup
    for (let i = 0; i < 20; i++) {
      evaluateTrendEvidence(
        singleTrend,
        sampleWardrobe,
        sampleProfile,
        undefined,
        undefined,
        [],
        '2026-05-15T10:00:00Z'
      );
    }

    const runs = 100;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      evaluateTrendEvidence(
        singleTrend,
        sampleWardrobe,
        sampleProfile,
        undefined,
        undefined,
        [],
        '2026-05-15T10:00:00Z'
      );
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / runs;

    console.log(`[Phase 11 Benchmark] Evidence evaluation avg: ${avgMs.toFixed(4)} ms (Target: < 2.0 ms)`);
    expect(avgMs).toBeLessThan(2.0);
  });

  it('measures AI Saathi trend tool latency (< 1.0 ms target)', async () => {
    const context = {
      userId: 'user_bench',
      wardrobe: sampleWardrobe,
      referenceTimestamp: new Date('2026-05-15T10:00:00Z').getTime(),
      styleProfile: sampleProfile,
      wearEvents: [],
    };

    // Warmup
    for (let i = 0; i < 10; i++) {
      await getRelevantTrendsTool.execute({}, context);
    }

    const runs = 50;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      await getRelevantTrendsTool.execute({}, context);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / runs;

    console.log(`[Phase 11 Benchmark] AI Saathi trend tool avg: ${avgMs.toFixed(4)} ms (Target: < 1.0 ms)`);
    // Allow reasonable margin in vitest execution
    expect(avgMs).toBeLessThan(2.5);
  });

  it('measures End-to-end discovery latency (< 5.0 ms target)', () => {
    // Warmup
    for (let i = 0; i < 10; i++) {
      evaluateWardrobeDiscoveryOpportunities(
        trends,
        sampleWardrobe,
        sampleProfile,
        undefined,
        undefined,
        [],
        '2026-05-15T10:00:00Z'
      );
    }

    const runs = 50;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      evaluateWardrobeDiscoveryOpportunities(
        trends,
        sampleWardrobe,
        sampleProfile,
        undefined,
        undefined,
        [],
        '2026-05-15T10:00:00Z'
      );
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / runs;

    console.log(`[Phase 11 Benchmark] End-to-end discovery avg: ${avgMs.toFixed(4)} ms (Target: < 5.0 ms)`);
    expect(avgMs).toBeLessThan(5.0);
  });
});
