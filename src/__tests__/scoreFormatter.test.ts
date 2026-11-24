import { describe, it, expect } from 'vitest';
import { formatRecommendationScore } from '../utils/scoreFormatter';

describe('Recommendation Score Normalization & Formatting (P1)', () => {
  describe('1. 0–10 Scale Standard Conversion', () => {
    it('converts typical engine scores to accurate 0–100 percentage', () => {
      // Observed values from audit report: 6.92 -> 69%, 6.68 -> 67%, 5.48 -> 55%
      expect(formatRecommendationScore(6.92)).toBe(69);
      expect(formatRecommendationScore(6.68)).toBe(67);
      expect(formatRecommendationScore(5.48)).toBe(55);
      expect(formatRecommendationScore(8.5)).toBe(85);
      expect(formatRecommendationScore(9.94)).toBe(99);
    });

    it('correctly formats minimum and maximum boundary values on 0–10 scale', () => {
      expect(formatRecommendationScore(0)).toBe(0);
      expect(formatRecommendationScore(10)).toBe(100);
      expect(formatRecommendationScore(10.0)).toBe(100);
    });
  });

  describe('2. Boundary & Over-Range Protections', () => {
    it('never produces values greater than 100%', () => {
      expect(formatRecommendationScore(10.5)).toBe(100);
      expect(formatRecommendationScore(12)).toBe(100);
      expect(formatRecommendationScore(100)).toBe(100);
      expect(formatRecommendationScore(150)).toBe(100);
      expect(formatRecommendationScore(692)).toBe(100);
    });
  });

  describe('3. Monotonicity & Ranking Preservation', () => {
    it('strictly preserves recommendation ranking order', () => {
      const rawScores = [9.4, 8.8, 7.5, 6.92, 6.68, 5.48, 4.1, 2.0, 0.5];
      const formatted = rawScores.map(formatRecommendationScore);

      for (let i = 0; i < formatted.length - 1; i++) {
        expect(formatted[i]).toBeGreaterThanOrEqual(formatted[i + 1]);
      }
    });

    it('distinguishes different intermediate score tiers', () => {
      expect(formatRecommendationScore(8.5)).toBeGreaterThan(formatRecommendationScore(7.5));
      expect(formatRecommendationScore(7.5)).toBeGreaterThan(formatRecommendationScore(6.5));
    });
  });

  describe('4. Missing, Null, Undefined & Invalid Scores', () => {
    it('safely handles null and undefined scores returning 0', () => {
      expect(formatRecommendationScore(null)).toBe(0);
      expect(formatRecommendationScore(undefined)).toBe(0);
    });

    it('safely handles non-numeric and invalid floating point numbers', () => {
      expect(formatRecommendationScore(NaN)).toBe(0);
      expect(formatRecommendationScore(Infinity)).toBe(0);
      expect(formatRecommendationScore(-Infinity)).toBe(0);
      // @ts-expect-error test non-number runtime argument
      expect(formatRecommendationScore('7.5')).toBe(0);
    });

    it('safely handles negative scores resulting from penalties', () => {
      expect(formatRecommendationScore(-0.5)).toBe(0);
      expect(formatRecommendationScore(-5.0)).toBe(0);
    });
  });
});
