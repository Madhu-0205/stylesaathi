import { describe, it, expect } from 'vitest';
import {
  getCompatibilityDescriptor,
  formatRecommendationScore,
} from '../utils/scoreFormatter';
import fs from 'fs';
import path from 'path';

describe('Phase 2: Recommendation Score Integrity & Descriptive Compatibility', () => {
  describe('1. Descriptive Compatibility Tiers (getCompatibilityDescriptor)', () => {
    it('classifies scores >= 7.0 as Exceptional Resonance', () => {
      const d1 = getCompatibilityDescriptor(7.0);
      expect(d1.tier).toBe('exceptional');
      expect(d1.label).toBe('Exceptional Resonance');
      expect(d1.badgeClass).toContain('emerald');

      const d2 = getCompatibilityDescriptor(8.65);
      expect(d2.tier).toBe('exceptional');
      expect(d2.label).toBe('Exceptional Resonance');

      const d3 = getCompatibilityDescriptor(10.0);
      expect(d3.tier).toBe('exceptional');
    });

    it('classifies scores 5.5 to 6.99 as Harmonious Match', () => {
      const d1 = getCompatibilityDescriptor(5.5);
      expect(d1.tier).toBe('harmonious');
      expect(d1.label).toBe('Harmonious Match');
      expect(d1.badgeClass).toContain('amber');

      const d2 = getCompatibilityDescriptor(6.8);
      expect(d2.tier).toBe('harmonious');
      expect(d2.label).toBe('Harmonious Match');
    });

    it('classifies scores 4.0 to 5.49 as Balanced Everyday Ensemble', () => {
      const d1 = getCompatibilityDescriptor(4.0);
      expect(d1.tier).toBe('balanced');
      expect(d1.label).toBe('Balanced Everyday Ensemble');
      expect(d1.badgeClass).toContain('blue');

      const d2 = getCompatibilityDescriptor(5.2);
      expect(d2.tier).toBe('balanced');
      expect(d2.label).toBe('Balanced Everyday Ensemble');
    });

    it('classifies scores < 4.0 as Experimental Pairing', () => {
      const d1 = getCompatibilityDescriptor(3.9);
      expect(d1.tier).toBe('experimental');
      expect(d1.label).toBe('Experimental Pairing');
      expect(d1.badgeClass).toContain('purple');

      const d2 = getCompatibilityDescriptor(1.5);
      expect(d2.tier).toBe('experimental');
      expect(d2.label).toBe('Experimental Pairing');
    });

    it('handles null, undefined, NaN, and infinite values with unrated fallback', () => {
      const dNull = getCompatibilityDescriptor(null);
      expect(dNull.tier).toBe('unrated');
      expect(dNull.label).toBe('Curated Ensemble');

      const dUndef = getCompatibilityDescriptor(undefined);
      expect(dUndef.tier).toBe('unrated');

      const dNaN = getCompatibilityDescriptor(NaN);
      expect(dNaN.tier).toBe('unrated');

      const dInf = getCompatibilityDescriptor(Infinity);
      expect(dInf.tier).toBe('unrated');
    });

    it('includes clear heuristic disclosure note on all tiers', () => {
      const scores = [8.5, 6.2, 4.5, 3.0, null];
      scores.forEach((s) => {
        const desc = getCompatibilityDescriptor(s);
        expect(desc.heuristicNote).toContain('Heuristic presentation label');
      });
    });
  });

  describe('2. Backward-Compatible Percentage Formatter (formatRecommendationScore)', () => {
    it('accurately maps 0-10 scores to clamped integer range [0, 100]', () => {
      expect(formatRecommendationScore(7.5)).toBe(75);
      expect(formatRecommendationScore(10.0)).toBe(100);
      expect(formatRecommendationScore(12.5)).toBe(100);
      expect(formatRecommendationScore(0)).toBe(0);
      expect(formatRecommendationScore(-2)).toBe(0);
      expect(formatRecommendationScore(null)).toBe(0);
      expect(formatRecommendationScore(undefined)).toBe(0);
    });
  });

  describe('3. Codebase Inspection — No Raw Multiplications or Fabricated Match Percentages', () => {
    it('prohibits raw score * 100 multiplication in SaathiRecommendationCard', () => {
      const filePath = path.resolve(__dirname, '../components/saathi/SaathiRecommendationCard.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('outfit.score * 100');
      expect(content).toContain('getCompatibilityDescriptor(outfit.score)');
    });

    it('prohibits raw score * 100 multiplication in TrendDiscoveryScreen', () => {
      const filePath = path.resolve(__dirname, '../screens/TrendDiscoveryScreen.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('rec.score * 100');
      expect(content).toContain('getCompatibilityDescriptor(rec.score)');
    });

    it('uses descriptive compatibility in OutfitAtelierStage', () => {
      const filePath = path.resolve(__dirname, '../components/dressme/OutfitAtelierStage.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getCompatibilityDescriptor');
      expect(content).toContain('compatibilityDescriptor.label');
    });
  });
});

