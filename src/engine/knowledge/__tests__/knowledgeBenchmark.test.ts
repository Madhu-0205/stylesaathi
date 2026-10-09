import { describe, it } from 'vitest';
import { WardrobeItem } from '../../../types';
import { fashionKnowledgeEngine } from '../fashionKnowledgeEngine';

function mockPiece(id: string, subcategory: any, fabric: any, pattern: any): WardrobeItem {
  return {
    id,
    name: `${fabric} ${subcategory}`,
    category: 'Ethnic',
    subcategory,
    colors: ['yellow'],
    seasons: ['summer'],
    occasions: ['festive', 'puja'],
    formality: 4,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric,
    pattern,
  };
}

describe('IFKG Performance Benchmark', () => {
  it('benchmarks single outfit signal evaluation across 1,000 iterations', () => {
    const pieces = [
      mockPiece('1', 'kurta', 'silk', 'zari_brocade'),
      mockPiece('2', 'churidar', 'silk', 'solid'),
      mockPiece('3', 'juttis', 'leather', 'solid'),
      mockPiece('4', 'dupatta', 'silk', 'embroidered'),
    ];

    const context = {
      occasion: 'Diwali' as const,
      regionalPreference: 'north',
    };

    // Warmup
    for (let i = 0; i < 50; i++) {
      fashionKnowledgeEngine.getSignals(pieces, context);
    }

    const iterations = 1000;
    const times: number[] = [];
    const t0 = performance.now();

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fashionKnowledgeEngine.getSignals(pieces, context);
      times.push(performance.now() - start);
    }

    const totalMs = performance.now() - t0;
    const avgMs = totalMs / iterations;
    times.sort((a, b) => a - b);
    const p95Ms = times[Math.floor(iterations * 0.95)];

    console.log(
      `[IFKG BENCHMARK] Single Outfit: Avg=${avgMs.toFixed(4)}ms | p95=${p95Ms.toFixed(4)}ms | Total(1k)=${totalMs.toFixed(2)}ms`
    );
  });

  it('benchmarks batch evaluation across 350 outfit candidates', () => {
    const candidates: WardrobeItem[][] = [];
    for (let i = 0; i < 350; i++) {
      candidates.push([
        mockPiece(`k-${i}`, 'kurta', 'cotton', 'block_print'),
        mockPiece(`p-${i}`, 'palazzo', 'cotton', 'solid'),
        mockPiece(`j-${i}`, 'juttis', 'leather', 'solid'),
      ]);
    }

    const context = {
      occasion: 'festive' as const,
      regionalPreference: 'west',
    };

    // Warmup
    for (const c of candidates.slice(0, 20)) {
      fashionKnowledgeEngine.getSignals(c, context);
    }

    const t0 = performance.now();
    for (const c of candidates) {
      fashionKnowledgeEngine.getSignals(c, context);
    }
    const batchTotalMs = performance.now() - t0;
    const perCandidateMs = batchTotalMs / 350;

    console.log(
      `[IFKG BENCHMARK] 350 Candidate Batch: Total=${batchTotalMs.toFixed(2)}ms | Per Candidate=${perCandidateMs.toFixed(4)}ms`
    );
  });
});
