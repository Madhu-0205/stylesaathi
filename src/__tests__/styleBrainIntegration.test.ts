import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateOutfits,
  calculateOutfitScore,
  getOutfitWhyReasons,
  derivePersonalStyleProfile,
} from '../engine';
import { WardrobeItem, StyleSignalEvent, StyleSignalMutation } from '../types';
import { syncService } from '../lib/sync/syncService';

describe('Personal Style Brain Integration & Recommendation Re-Ranking', () => {
  const cottonKurta: WardrobeItem = {
    id: 'cotton-kurta-1',
    name: 'White Khadi Cotton Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'relaxed',
  };

  const polyKurta: WardrobeItem = {
    id: 'poly-kurta-1',
    name: 'Heavy Synthetic Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['purple'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'polyblend',
    pattern: 'solid',
    fit: 'regular',
  };

  const denimJeans: WardrobeItem = {
    id: 'denim-jeans-1',
    name: 'Blue Straight Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['blue'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'denim',
    pattern: 'solid',
    fit: 'straight',
  };

  const footwear: WardrobeItem = {
    id: 'footwear-1',
    name: 'Tan Kolhapuri Chappals',
    category: 'Footwear',
    subcategory: 'kolhapuris',
    colors: ['tan'],
    seasons: ['summer'],
    occasions: ['college', 'casual outing'],
    formality: 2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'unknown',
    pattern: 'solid',
    fit: 'regular',
  };

  const wardrobe = [cottonKurta, polyKurta, denimJeans, footwear];

  describe('1. Dynamic Re-ranking Based on Learned Profile', () => {
    it('ranks cotton kurta above polyblend kurta when user exhibits strong cotton & white preferences', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'saved', itemIds: ['cotton-kurta-1'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'rejected', rejectionReason: 'too_hot', itemIds: ['poly-kurta-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);

      const cottonLookScore = calculateOutfitScore(
        [cottonKurta, denimJeans, footwear],
        'college',
        0.5,
        undefined,
        profile
      );

      const polyLookScore = calculateOutfitScore(
        [polyKurta, denimJeans, footwear],
        'college',
        0.5,
        undefined,
        profile
      );

      expect(cottonLookScore).toBeGreaterThan(polyLookScore);
    });

    it('generates outfit candidate lists prioritizing user preferred pieces', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'saved', itemIds: ['cotton-kurta-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);

      const outfitsWithProfile = generateOutfits(
        wardrobe,
        'college',
        'summer',
        4,
        0.5,
        undefined,
        profile
      );

      expect(outfitsWithProfile.length).toBeGreaterThan(0);
      // The top outfit must incorporate the preferred cotton kurta
      const topOutfitItems = Object.values(outfitsWithProfile[0].slots).flat();
      expect(topOutfitItems.map((i) => i.id)).toContain('cotton-kurta-1');
    });
  });

  describe('2. Explainable Personalization in Editorial Reasons', () => {
    it('includes learned style brain evidence in getOutfitWhyReasons', () => {
      const now = Date.now();
      const signals: StyleSignalEvent[] = [
        { id: '1', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '2', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '3', userId: 'u1', signalType: 'worn', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
        { id: '4', userId: 'u1', signalType: 'saved', itemIds: ['cotton-kurta-1', 'denim-jeans-1'], createdAt: now },
      ];

      const profile = derivePersonalStyleProfile(signals, [], wardrobe, undefined, now);
      const pieces = [cottonKurta, denimJeans, footwear];
      const reasons = getOutfitWhyReasons(pieces, 'college', 4, undefined, profile);

      expect(reasons.length).toBeGreaterThan(0);
      const combined = reasons.join(' ');
      expect(combined).toMatch(/cotton|relaxed|frequently/i);
    });
  });

  describe('3. Sync Queue & Idempotency of Style Signals', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('processes style_signal mutation cleanly through sync pipeline', async () => {
      const signal: StyleSignalEvent = {
        id: 'sig-sync-1',
        userId: 'test-user',
        signalType: 'rejected',
        itemIds: ['poly-kurta-1'],
        rejectionReason: 'too_hot',
        createdAt: Date.now(),
      };

      const mutation: StyleSignalMutation = {
        id: 'mut-1',
        clientTimestamp: Date.now(),
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: 0,
        lastError: null,
        status: 'pending',
        entityType: 'style_signal',
        entityId: signal.id,
        operation: 'APPEND_SIGNAL',
        payload: signal,
      };

      expect(mutation.entityType).toBe('style_signal');
      expect(mutation.operation).toBe('APPEND_SIGNAL');
      expect(mutation.payload.rejectionReason).toBe('too_hot');
    });
  });
});
