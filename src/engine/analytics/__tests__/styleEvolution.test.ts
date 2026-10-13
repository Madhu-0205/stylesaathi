import { describe, it, expect } from 'vitest';
import {
  computeStyleSnapshot,
  computeStyleEvolution,
} from '../styleEvolutionEngine';
import { calculateAnalyticsConfidence } from '../wearAnalyticsEngine';
import { WardrobeItem, WearEvent } from '../../../types';

const BASE_TS = 1700000000000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function createDummyItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'item-1',
    name: 'Sample Garment',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['White'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'regular',
    seasons: ['summer'],
    formality: 2,
    occasions: ['casual outing'],
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 1,
    createdAt: BASE_TS - 120 * ONE_DAY_MS,
    ...overrides,
  };
}

function createDummyEvent(overrides: Partial<WearEvent> = {}): WearEvent {
  return {
    id: 'wear-1',
    userId: 'user_1',
    wardrobeItemId: 'item-1',
    wornAt: BASE_TS - 10 * ONE_DAY_MS,
    createdAt: BASE_TS - 10 * ONE_DAY_MS,
    ...overrides,
  };
}

describe('Style Evolution Engine', () => {
  describe('Style Snapshot Generation', () => {
    it('computes attribute distributions and ratios correctly', () => {
      const items = [
        createDummyItem({
          id: 'top-1',
          colors: ['Black'],
          fabric: 'cotton',
          pattern: 'solid',
          fit: 'slim',
          formality: 3,
        }),
        createDummyItem({
          id: 'bottom-1',
          category: 'Bottoms',
          subcategory: 'trousers',
          colors: ['Beige'],
          fabric: 'linen',
          pattern: 'solid',
          fit: 'regular',
          formality: 2,
        }),
      ];

      const events = [
        createDummyEvent({ id: 'e1', wardrobeItemId: 'top-1', wornAt: BASE_TS - 5 * ONE_DAY_MS }),
        createDummyEvent({ id: 'e2', wardrobeItemId: 'bottom-1', wornAt: BASE_TS - 4 * ONE_DAY_MS }),
      ];

      const snapshot = computeStyleSnapshot(
        'recent_30d',
        BASE_TS - 30 * ONE_DAY_MS,
        BASE_TS,
        items,
        events
      );

      expect(snapshot.windowId).toBe('recent_30d');
      expect(snapshot.totalWearEvents).toBe(2);
      expect(snapshot.uniqueGarmentsWorn).toBe(2);
      expect(snapshot.neutralColorRatio).toBe(1.0); // Black and Beige are neutral
      expect(snapshot.breathableFabricRatio).toBe(1.0); // Cotton and linen are breathable
      expect(snapshot.solidPatternRatio).toBe(1.0);
      expect(snapshot.averageFormality).toBe(2.5); // (3 + 2) / 2
    });
  });

  describe('Confidence Formula', () => {
    it('calculates deterministic confidence according to approved weights', () => {
      // 30 wears (volume 1.0), 60 days timespan (1.0), 12 unique garments (1.0)
      // 0.4*1.0 + 0.35*1.0 + 0.25*1.0 = 1.0
      const cMax = calculateAnalyticsConfidence(30, 12, 60);
      expect(cMax).toBeCloseTo(1.0);

      // Low activity test: 8 wears, 4 garments, 30 days
      // (8/30)*0.40 + (30/60)*0.35 + (4/12)*0.25
      // = 0.1067 + 0.175 + 0.0833 = 0.365 => rounded to 0.37
      const cLow = calculateAnalyticsConfidence(8, 4, 30);
      expect(cLow).toBeCloseTo(0.37, 2);
    });
  });

  describe('Evolution Gating & Shift Detection', () => {
    it('rejects style evolution if recent wears < 8 or baseline wears < 8', () => {
      const items = [createDummyItem({ id: 'i1' })];

      const recentEvents: WearEvent[] = [];
      for (let i = 0; i < 5; i++) {
        recentEvents.push(
          createDummyEvent({
            id: `rec-${i}`,
            wardrobeItemId: 'i1',
            wornAt: BASE_TS - (i + 1) * ONE_DAY_MS,
          })
        );
      }

      const baselineEvents: WearEvent[] = [];
      for (let i = 0; i < 5; i++) {
        baselineEvents.push(
          createDummyEvent({
            id: `base-${i}`,
            wardrobeItemId: 'i1',
            wornAt: BASE_TS - (40 + i) * ONE_DAY_MS,
          })
        );
      }

      const recentSnapshot = computeStyleSnapshot(
        'recent_30d',
        BASE_TS - 30 * ONE_DAY_MS,
        BASE_TS,
        items,
        recentEvents
      );
      const baselineSnapshot = computeStyleSnapshot(
        'baseline_60d',
        BASE_TS - 90 * ONE_DAY_MS,
        BASE_TS - 30 * ONE_DAY_MS,
        items,
        baselineEvents
      );

      // 1. Fails global lifetime wears < 16
      const reportGlobalFail = computeStyleEvolution(recentSnapshot, baselineSnapshot, 10, 60);
      expect(reportGlobalFail.isEligible).toBe(false);
      expect(reportGlobalFail.ineligibilityReason).toContain('Requires at least 16 recorded wears');

      // 2. Fails window wears < 8 (even if total >= 16)
      const reportWindowFail = computeStyleEvolution(recentSnapshot, baselineSnapshot, 20, 60);
      expect(reportWindowFail.isEligible).toBe(false);
      expect(reportWindowFail.ineligibilityReason).toContain('requires at least 8 wears');
    });

    it('detects significant style shifts when sample gates pass', () => {
      const formalItem = createDummyItem({
        id: 'formal-1',
        colors: ['Red'],
        fabric: 'silk',
        pattern: 'bandhani',
        fit: 'tailored',
        formality: 4,
      });

      const casualItem = createDummyItem({
        id: 'casual-1',
        colors: ['White'],
        fabric: 'cotton',
        pattern: 'solid',
        fit: 'relaxed',
        formality: 2,
      });

      const items = [formalItem, casualItem];
      for (let j = 2; j <= 12; j++) {
        items.push(createDummyItem({ id: `extra-${j}` }));
      }

      // 10 baseline wears of formal-1
      const baselineEvents: WearEvent[] = [];
      for (let i = 0; i < 10; i++) {
        baselineEvents.push(
          createDummyEvent({
            id: `b-${i}`,
            wardrobeItemId: 'formal-1',
            wornAt: BASE_TS - (35 + i * 2) * ONE_DAY_MS,
          })
        );
      }
      // 10 recent wears of casual-1
      const recentEvents: WearEvent[] = [];
      for (let i = 0; i < 10; i++) {
        recentEvents.push(
          createDummyEvent({
            id: `r-${i}`,
            wardrobeItemId: 'casual-1',
            wornAt: BASE_TS - (2 + i * 2) * ONE_DAY_MS,
          })
        );
      }

      const recentSnapshot = computeStyleSnapshot(
        'recent_30d',
        BASE_TS - 30 * ONE_DAY_MS,
        BASE_TS,
        items,
        recentEvents
      );
      const baselineSnapshot = computeStyleSnapshot(
        'baseline_60d',
        BASE_TS - 90 * ONE_DAY_MS,
        BASE_TS - 30 * ONE_DAY_MS,
        items,
        baselineEvents
      );

      const report = computeStyleEvolution(recentSnapshot, baselineSnapshot, 20, 60);
      expect(report.isEligible).toBe(true);
      expect(report.confidence).toBeGreaterThanOrEqual(0.6);
      expect(report.significantShifts.length).toBeGreaterThan(0);

      // Verify dimension deltas exist
      const paletteDelta = report.dimensions.find((d) => d.dimension === 'palette');
      expect(paletteDelta).toBeDefined();
      expect(paletteDelta?.isSignificant).toBe(true);
      expect(paletteDelta?.evidenceText).toContain('neutrals');

      const formalityDelta = report.dimensions.find((d) => d.dimension === 'formality');
      expect(formalityDelta).toBeDefined();
      expect(formalityDelta?.isSignificant).toBe(true);
      expect(formalityDelta?.headline).toContain('casual');
    });
  });
});
