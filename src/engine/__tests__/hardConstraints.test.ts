import { describe, it, expect } from 'vitest';
import { WardrobeItem, ContextSnapshot } from '../../types';
import { TEMPLATES } from '../outfitTemplates';
import {
  validateOutfitItemStatus,
  validateOutfitPieceUniqueness,
  validateTemplateStructuralIntegrity,
  validateClimateHazard,
  evaluateTier1HardConstraints,
  evaluateCulturalTierScore,
} from '../hardConstraints';

const mockItem = (overrides: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id: 'item-1',
  name: 'Test Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer'],
  occasions: ['office'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  ...overrides,
});

describe('Hard Constraints (Tier 1)', () => {
  describe('validateOutfitItemStatus', () => {
    it('passes when all items are clean', () => {
      const items = [mockItem({ id: '1', status: 'clean' }), mockItem({ id: '2', status: 'clean' })];
      const result = validateOutfitItemStatus(items);
      expect(result.valid).toBe(true);
    });

    it('rejects if any item is in laundry', () => {
      const items = [mockItem({ id: '1', status: 'clean' }), mockItem({ id: '2', status: 'in_laundry' })];
      const result = validateOutfitItemStatus(items);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('laundry');
    });

    it('rejects if any item needs washing (not clean)', () => {
      const items = [mockItem({ id: '1', status: 'clean' }), mockItem({ id: '2', status: 'needs_washing' })];
      const result = validateOutfitItemStatus(items);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateOutfitPieceUniqueness', () => {
    it('passes when every item across slots is unique', () => {
      const slots = {
        top: [mockItem({ id: '1' })],
        bottom: [mockItem({ id: '2' })],
      };
      const result = validateOutfitPieceUniqueness(slots);
      expect(result.valid).toBe(true);
    });

    it('rejects when the same item ID is used across multiple slots', () => {
      const shared = mockItem({ id: 'shared-1' });
      const slots = {
        top: [shared],
        bottom: [shared],
      };
      const result = validateOutfitPieceUniqueness(slots);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Duplicate');
    });
  });

  describe('validateTemplateStructuralIntegrity', () => {
    const template = TEMPLATES.find((t) => t.name === 'Western casual') || TEMPLATES[0];

    it('passes when all required slots are populated', () => {
      const slots: Record<string, WardrobeItem[]> = {};
      for (const reqKey of Object.keys(template.required)) {
        slots[reqKey] = [mockItem({ id: `item-${reqKey}` })];
      }
      const result = validateTemplateStructuralIntegrity(template, slots);
      expect(result.valid).toBe(true);
    });

    it('rejects if a required slot is empty or missing', () => {
      const slots: Record<string, WardrobeItem[]> = {};
      // Leave required slots unpopulated
      const result = validateTemplateStructuralIntegrity(template, slots);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing required slot');
    });
  });

  describe('validateClimateHazard', () => {
    it('passes in normal weather', () => {
      const items = [mockItem({ id: '1', fabric: 'silk' })];
      const result = validateClimateHazard(items, undefined);
      expect(result.valid).toBe(true);
    });

    it('rejects delicate silk/suede in active torrential rain hazard', () => {
      const silkItem = mockItem({ id: '1', fabric: 'silk' });
      const heavyRainContext: ContextSnapshot = {
        weather: {
          temperature: 24,
          feelsLike: 26,
          humidity: 95,
          precipitationProbability: 100,
          precipitationAmount: 25,
          windSpeed: 30,
          condition: 'heavy_rain',
          observedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          source: 'live',
          location: { city: 'Mumbai', country: 'India', source: 'manual' },
        },
        freshness: 'fresh',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
        date: '2026-10-09',
        timeOfDay: 'afternoon',
        thermalContext: 'warm',
        rainContext: 'active_rain',
        occasion: 'office',
        confidence: 1.0,
        source: 'live',
      };

      const result = validateClimateHazard([silkItem], heavyRainContext);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('rain hazard');
    });

    it('passes durable fabrics in active rain', () => {
      const cottonItem = mockItem({ id: '1', fabric: 'cotton' });
      const rainContext: ContextSnapshot = {
        weather: {
          temperature: 24,
          feelsLike: 26,
          humidity: 90,
          precipitationProbability: 80,
          windSpeed: 15,
          condition: 'rain',
          observedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          source: 'live',
          location: { city: 'Mumbai', country: 'India', source: 'manual' },
        },
        freshness: 'fresh',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
        date: '2026-10-09',
        timeOfDay: 'afternoon',
        thermalContext: 'warm',
        rainContext: 'active_rain',
        occasion: 'office',
        confidence: 1.0,
        source: 'live',
      };

      const result = validateClimateHazard([cottonItem], rainContext);
      expect(result.valid).toBe(true);
    });
  });

  describe('evaluateTier1HardConstraints', () => {
    const template = TEMPLATES[0];

    it('passes when all Tier 1 checks pass', () => {
      const slots: Record<string, WardrobeItem[]> = {};
      for (const reqKey of Object.keys(template.required)) {
        slots[reqKey] = [mockItem({ id: `item-${reqKey}`, status: 'clean' })];
      }
      const result = evaluateTier1HardConstraints({ template, slots });
      expect(result.passed).toBe(true);
    });

    it('fails when any Tier 1 check fails (e.g. laundry item)', () => {
      const slots: Record<string, WardrobeItem[]> = {};
      for (const reqKey of Object.keys(template.required)) {
        slots[reqKey] = [mockItem({ id: `item-${reqKey}`, status: 'in_laundry' })];
      }
      const result = evaluateTier1HardConstraints({ template, slots });
      expect(result.passed).toBe(false);
      expect(result.failureReason).toBeDefined();
    });
  });

  describe('Cultural Hierarchy: Tier 2 and Tier 3 are soft, NOT hard constraints', () => {
    it('Tier 2 strong occasion mismatch produces a soft penalty, not a hard rejection', () => {
      // e.g. western dress / shorts for a devotional puja
      const shorts = mockItem({
        id: 'shorts-1',
        category: 'Bottoms',
        subcategory: 'shorts',
        status: 'clean',
      });
      const culturalEval = evaluateCulturalTierScore([shorts], 'puja');
      expect(culturalEval.tier).toBe(2);
      expect(culturalEval.penalty).toBeGreaterThan(0); // High soft penalty
      expect(culturalEval.hardRejected).toBe(false); // MUST NOT BE HARD REJECTED
    });

    it('Tier 3 cultural preference produces positive soft signals for respectful tones & ethnic drape', () => {
      const festiveKurta = mockItem({
        id: 'kurta-1',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['yellow'],
        status: 'clean',
      });
      const culturalEval = evaluateCulturalTierScore([festiveKurta], 'puja');
      expect(culturalEval.tier).toBe(3);
      expect(culturalEval.bonus).toBeGreaterThan(0);
      expect(culturalEval.hardRejected).toBe(false);
    });

    it('user declared preference overrides cultural default penalty', () => {
      const westernTop = mockItem({
        id: 'top-1',
        category: 'Tops',
        subcategory: 't-shirt',
      });
      // User explicitly set preferred aesthetics to include 'Modern Western'
      const customPreferences = {
        preferredAesthetics: ['Modern Western', 'Casual'],
        preferredContexts: ['puja'],
        stylingMode: 'variety' as const,
        updatedAt: Date.now(),
      };
      const resultWithPref = evaluateCulturalTierScore([westernTop], 'puja', customPreferences);
      // Soft penalty should be mitigated or reduced when user preference declared
      expect(resultWithPref.hardRejected).toBe(false);
      expect(resultWithPref.penalty).toBeLessThanOrEqual(2.0);
    });
  });
});
