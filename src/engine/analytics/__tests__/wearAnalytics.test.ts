import { describe, it, expect } from 'vitest';
import {
  computeWearAnalytics,
  deduplicateAndFilterWearEvents,
  reconcileItemWears,
  computeCostPerWear,
  normalizeFabricGroup,
  normalizePatternGroup,
  normalizeSilhouetteGroup,
  computeItemRotationState,
  computeParetoConcentration,
} from '../wearAnalyticsEngine';
import { WardrobeItem, WearEvent } from '../../../types';

const BASE_TS = 1700000000000; // Fixed reference timestamp
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function createDummyItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'item-1',
    name: 'Classic White Shirt',
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['White'],
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'slim',
    seasons: ['summer'],
    formality: 3,
    occasions: ['office', 'casual outing'],
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    createdAt: BASE_TS - 100 * ONE_DAY_MS,
    ...overrides,
  };
}

function createDummyEvent(overrides: Partial<WearEvent> = {}): WearEvent {
  return {
    id: 'wear-1',
    userId: 'user_1',
    wardrobeItemId: 'item-1',
    wornAt: BASE_TS - 5 * ONE_DAY_MS,
    createdAt: BASE_TS - 5 * ONE_DAY_MS,
    plannedDate: '2023-11-09',
    ...overrides,
  };
}

describe('Wear Analytics Engine', () => {
  describe('Deduplication & Canonical Event Stream', () => {
    it('deduplicates events with identical IDs', () => {
      const e1 = createDummyEvent({ id: 'evt-dup' });
      const e2 = createDummyEvent({ id: 'evt-dup' });
      const result = deduplicateAndFilterWearEvents([e1, e2], BASE_TS);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('evt-dup');
    });

    it('deduplicates accidental rapid duplicate events for the SAME item within 60s and same plannedDate', () => {
      const e1 = createDummyEvent({
        id: 'evt-1',
        wardrobeItemId: 'item-1',
        wornAt: BASE_TS - 10000,
        plannedDate: '2023-11-14',
      });
      const e2 = createDummyEvent({
        id: 'evt-2',
        wardrobeItemId: 'item-1',
        wornAt: BASE_TS - 20000, // 10s difference
        plannedDate: '2023-11-14',
      });

      const result = deduplicateAndFilterWearEvents([e1, e2], BASE_TS);
      expect(result).toHaveLength(1);
    });

    it('preserves legitimate same-timestamp events belonging to DIFFERENT wardrobe items', () => {
      const nowTs = BASE_TS - 10000;
      const shirt = createDummyEvent({
        id: 'evt-1-shirt',
        wardrobeItemId: 'item-shirt',
        wornAt: nowTs,
        plannedDate: '2023-11-14',
      });
      const jeans = createDummyEvent({
        id: 'evt-2-jeans',
        wardrobeItemId: 'item-jeans',
        wornAt: nowTs,
        plannedDate: '2023-11-14',
      });
      const shoes = createDummyEvent({
        id: 'evt-3-shoes',
        wardrobeItemId: 'item-shoes',
        wornAt: nowTs,
        plannedDate: '2023-11-14',
      });

      const result = deduplicateAndFilterWearEvents([shirt, jeans, shoes], BASE_TS);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.wardrobeItemId)).toEqual(['item-shirt', 'item-jeans', 'item-shoes']);
    });

    it('excludes future timestamps (wornAt > referenceTimestamp + 24h) without mutating source', () => {
      const futureEvent = createDummyEvent({
        id: 'evt-future',
        wornAt: BASE_TS + 25 * 60 * 60 * 1000, // +25h
      });
      const validEvent = createDummyEvent({
        id: 'evt-valid',
        wornAt: BASE_TS - 1000,
      });

      const events = [futureEvent, validEvent];
      const result = deduplicateAndFilterWearEvents(events, BASE_TS);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('evt-valid');
      expect(events).toHaveLength(2); // Immutability verified
    });
  });

  describe('Wear Count Reconciliation Policy', () => {
    it('handles Case A: eventCount === timesWorn', () => {
      const item = createDummyItem({ id: 'item-1', timesWorn: 2 });
      const events = [
        createDummyEvent({ id: 'e1', wardrobeItemId: 'item-1' }),
        createDummyEvent({ id: 'e2', wardrobeItemId: 'item-1' }),
      ];

      const res = reconcileItemWears(item, events);
      expect(res.reconciliationCase).toBe('A_MATCH');
      expect(res.effectiveLifetimeWears).toBe(2);
      expect(res.legacyWearsDelta).toBe(0);
      expect(res.canonicalEventCount).toBe(2);
    });

    it('handles Case B: eventCount > timesWorn (event count authoritative, timesWorn untouched)', () => {
      const item = createDummyItem({ id: 'item-1', timesWorn: 1 });
      const events = [
        createDummyEvent({ id: 'e1', wardrobeItemId: 'item-1' }),
        createDummyEvent({ id: 'e2', wardrobeItemId: 'item-1' }),
        createDummyEvent({ id: 'e3', wardrobeItemId: 'item-1' }),
      ];

      const res = reconcileItemWears(item, events);
      expect(res.reconciliationCase).toBe('B_EVENT_STREAM_PRECEDENCE');
      expect(res.effectiveLifetimeWears).toBe(3);
      expect(res.legacyWearsDelta).toBe(0);
      expect(item.timesWorn).toBe(1); // Item not mutated
    });

    it('handles Case C: timesWorn > eventCount (legacy delta isolated from temporal windows)', () => {
      const item = createDummyItem({ id: 'item-1', timesWorn: 5 });
      const events = [
        createDummyEvent({
          id: 'e1',
          wardrobeItemId: 'item-1',
          wornAt: BASE_TS - 2 * ONE_DAY_MS,
        }),
      ];

      const res = reconcileItemWears(item, events);
      expect(res.reconciliationCase).toBe('C_LEGACY_DELTA');
      expect(res.effectiveLifetimeWears).toBe(5);
      expect(res.canonicalEventCount).toBe(1);
      expect(res.legacyWearsDelta).toBe(4);
    });

    it('handles Case D: eventCount === 0 and timesWorn > 0 (pure legacy wear)', () => {
      const item = createDummyItem({ id: 'item-1', timesWorn: 4 });
      const res = reconcileItemWears(item, []);
      expect(res.reconciliationCase).toBe('D_PURE_LEGACY');
      expect(res.effectiveLifetimeWears).toBe(4);
      expect(res.canonicalEventCount).toBe(0);
      expect(res.legacyWearsDelta).toBe(4);
    });
  });

  describe('Cost-Per-Wear (CPW) Engine', () => {
    it('calculates CPW for positive price and >= 1 wears (amortizing)', () => {
      const item = createDummyItem({ purchasePrice: 2000 });
      const cpw = computeCostPerWear(item, 4);
      expect(cpw.status).toBe('amortizing');
      expect(cpw.effectiveWears).toBe(4);
      expect(cpw.costPerWear).toBe(500);
      expect(cpw.unamortizedCost).toBe(0);
      expect(cpw.formattedCPW).toBe('₹500/wear');
    });

    it('handles positive price and 0 wears (unworn)', () => {
      const item = createDummyItem({ purchasePrice: 3500 });
      const cpw = computeCostPerWear(item, 0);
      expect(cpw.status).toBe('unworn');
      expect(cpw.effectiveWears).toBe(0);
      expect(cpw.costPerWear).toBeUndefined();
      expect(cpw.unamortizedCost).toBe(3500);
      expect(cpw.formattedCPW).toBe('Not worn yet');
    });

    it('handles missing price (unpriced)', () => {
      const item = createDummyItem({ purchasePrice: undefined });
      const cpw = computeCostPerWear(item, 5);
      expect(cpw.status).toBe('unpriced');
      expect(cpw.costPerWear).toBeUndefined();
      expect(cpw.formattedCPW).toBe('Price not set');
    });

    it('handles ₹0 price (Gift / Zero Cost)', () => {
      const item = createDummyItem({ purchasePrice: 0 });
      const cpw = computeCostPerWear(item, 10);
      expect(cpw.status).toBe('unpriced');
      expect(cpw.costPerWear).toBeUndefined();
      expect(cpw.formattedCPW).toBe('Gift / Zero Cost');
    });

    it('handles negative price gracefully without propagating negative CPW', () => {
      const item = createDummyItem({ purchasePrice: -500 });
      const cpw = computeCostPerWear(item, 2);
      expect(cpw.status).toBe('unpriced');
      expect(cpw.costPerWear).toBeUndefined();
      expect(cpw.formattedCPW).toBe('Price not set');
    });
  });

  describe('Attribute Normalization', () => {
    it('categorizes fabrics into approved groups', () => {
      expect(normalizeFabricGroup('cotton')).toBe('breathable');
      expect(normalizeFabricGroup('banarasi')).toBe('structured');
      expect(normalizeFabricGroup('silk')).toBe('drape');
      expect(normalizeFabricGroup('denim')).toBe('denim');
      expect(normalizeFabricGroup('unknown')).toBe('unknown');
    });

    it('categorizes patterns into approved groups', () => {
      expect(normalizePatternGroup('solid')).toBe('solid');
      expect(normalizePatternGroup('bandhani')).toBe('traditional_indian');
      expect(normalizePatternGroup('striped')).toBe('western_geometric');
      expect(normalizePatternGroup('unknown')).toBe('unknown');
    });

    it('categorizes silhouettes into approved groups', () => {
      expect(normalizeSilhouetteGroup('slim')).toBe('structured');
      expect(normalizeSilhouetteGroup('regular')).toBe('standard');
      expect(normalizeSilhouetteGroup('anarkali')).toBe('relaxed');
      expect(normalizeSilhouetteGroup(undefined)).toBe('unknown');
    });
  });

  describe('Rotation States and Rotation Health', () => {
    it('classifies active (<= 30d)', () => {
      const item = createDummyItem({
        id: 'i-act',
        lastWorn: BASE_TS - 10 * ONE_DAY_MS,
        timesWorn: 2,
      });
      const res = computeItemRotationState(item, 2, BASE_TS);
      expect(res.state).toBe('active');
    });

    it('classifies occasional (31-90d)', () => {
      const item = createDummyItem({
        id: 'i-occ',
        lastWorn: BASE_TS - 45 * ONE_DAY_MS,
        timesWorn: 2,
      });
      const res = computeItemRotationState(item, 2, BASE_TS);
      expect(res.state).toBe('occasional');
    });

    it('classifies dormant (wears > 0, lastWorn > 90d, age > 90d)', () => {
      const item = createDummyItem({
        id: 'i-dorm',
        lastWorn: BASE_TS - 100 * ONE_DAY_MS,
        createdAt: BASE_TS - 120 * ONE_DAY_MS,
        timesWorn: 2,
      });
      const res = computeItemRotationState(item, 2, BASE_TS);
      expect(res.state).toBe('dormant');
    });

    it('classifies never worn (wears === 0, age > 14d)', () => {
      const item = createDummyItem({
        id: 'i-never',
        timesWorn: 0,
        createdAt: BASE_TS - 30 * ONE_DAY_MS,
      });
      const res = computeItemRotationState(item, 0, BASE_TS);
      expect(res.state).toBe('never_worn');
    });

    it('does NOT label brand new unworn items as dormant or never worn during grace period (age <= 14d)', () => {
      const brandNew = createDummyItem({
        id: 'i-brandnew',
        timesWorn: 0,
        createdAt: BASE_TS - 5 * ONE_DAY_MS,
      });
      const res = computeItemRotationState(brandNew, 0, BASE_TS);
      expect(res.state).toBe('occasional');
    });

    it('enforces data sufficiency gates for rotation health (wears >= 10, wardrobe >= 5, confidence >= 0.35)', () => {
      const items = [
        createDummyItem({ id: '1', timesWorn: 1 }),
        createDummyItem({ id: '2', timesWorn: 1 }),
      ];
      const report = computeWearAnalytics(items, [], BASE_TS);
      expect(report.rotation.isEligible).toBe(false);
      expect(report.rotation.rotationHealthPercentage).toBeUndefined();
    });
  });

  describe('Pareto Concentration', () => {
    it('requires total wears >= 15, wardrobe >= 10, confidence >= 0.50', () => {
      const items = Array.from({ length: 5 }, (_, i) =>
        createDummyItem({ id: `i-${i}`, timesWorn: 3 })
      );
      const report = computeWearAnalytics(items, [], BASE_TS);
      expect(report.concentration.isEligible).toBe(false);
      expect(report.concentration.concentrationRatio).toBeUndefined();
    });

    it('calculates Pareto share correctly for eligible datasets', () => {
      // 10 items, 23 total wears. Top 20% = ceil(10 * 0.2) = 2 items.
      const items: WardrobeItem[] = [];
      const events: WearEvent[] = [];
      for (let i = 0; i < 10; i++) {
        const wears = i === 0 ? 10 : i === 1 ? 5 : 1;
        const item = createDummyItem({
          id: `item-${i}`,
          timesWorn: wears,
          createdAt: BASE_TS - 100 * ONE_DAY_MS,
        });
        items.push(item);
        for (let w = 0; w < wears; w++) {
          events.push(
            createDummyEvent({
              id: `ev-${i}-${w}`,
              wardrobeItemId: item.id,
              wornAt: BASE_TS - (w + 1) * ONE_DAY_MS,
            })
          );
        }
      }
      // Total wears = 10 + 5 + 8 = 23 wears (>= 15 wears, 10 items, high confidence)
      const report = computeWearAnalytics(items, events, BASE_TS);
      expect(report.concentration.isEligible).toBe(true);
      expect(report.concentration.kItemsCount).toBe(2);
      expect(report.concentration.topKWears).toBe(15);
      expect(report.concentration.totalLifetimeWears).toBe(23);
      expect(report.concentration.concentrationRatio).toBe(65);
      expect(report.concentration.interpretation).toBe('Balanced Rotation');
    });
  });

  describe('Orphan Event Handling', () => {
    it('counts orphan events toward total wears but isolates them from attribute breakdowns', () => {
      const existingItem = createDummyItem({ id: 'item-exists', timesWorn: 1 });
      const orphanEvent = createDummyEvent({
        id: 'orphan-1',
        wardrobeItemId: 'deleted-item-id',
      });
      const validEvent = createDummyEvent({
        id: 'valid-1',
        wardrobeItemId: 'item-exists',
      });

      const report = computeWearAnalytics(
        [existingItem],
        [orphanEvent, validEvent],
        BASE_TS
      );

      expect(report.totalLifetimeWears).toBe(2); // 1 orphan + 1 existing item wear
      expect(report.orphans.unresolvedOrphanCount).toBe(1);
      expect(report.orphans.explanation).toContain('retired garments');

      // Check that style snapshots only consider the existing item
      const snapshot = report.snapshots.all_time;
      expect(snapshot.uniqueGarmentsWorn).toBe(1);
    });
  });

  describe('Determinism & Immutability', () => {
    it('produces identical serialized output across 100 repeated runs with same inputs', () => {
      const items = [
        createDummyItem({ id: 'item-a', timesWorn: 4, purchasePrice: 1500 }),
        createDummyItem({ id: 'item-b', timesWorn: 2, purchasePrice: 3000 }),
      ];
      const events = [
        createDummyEvent({ id: 'e1', wardrobeItemId: 'item-a' }),
        createDummyEvent({ id: 'e2', wardrobeItemId: 'item-b' }),
      ];

      const firstRun = JSON.stringify(computeWearAnalytics(items, events, BASE_TS));

      for (let i = 0; i < 100; i++) {
        const nextRun = JSON.stringify(computeWearAnalytics(items, events, BASE_TS));
        expect(nextRun).toBe(firstRun);
      }
    });

    it('never mutates input items or events arrays and objects', () => {
      const originalItem = createDummyItem({ id: 'mut-item', timesWorn: 2 });
      const itemClone = JSON.parse(JSON.stringify(originalItem));

      const originalEvent = createDummyEvent({ id: 'mut-event', wardrobeItemId: 'mut-item' });
      const eventClone = JSON.parse(JSON.stringify(originalEvent));

      const items = [originalItem];
      const events = [originalEvent];

      computeWearAnalytics(items, events, BASE_TS);

      expect(items[0]).toEqual(itemClone);
      expect(events[0]).toEqual(eventClone);
      expect(items).toHaveLength(1);
      expect(events).toHaveLength(1);
    });
  });
});
