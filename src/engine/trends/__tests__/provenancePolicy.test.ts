import { describe, it, expect } from 'vitest';
import {
  SOURCE_TRUST_POLICY,
  deriveSourceTrustWeight,
  deriveTrendConfidence,
  evaluateTrendFreshness,
  evaluateTrendLifecycleState,
  isTrendEligibleForActiveDiscovery,
} from '../provenancePolicy';
import { CuratedActiveTrend } from '../types';

describe('Phase 11 — Provenance Policy & Lifecycle Gates', () => {
  const baseTrend: CuratedActiveTrend = {
    concept: {
      id: 'trend_test_1',
      name: 'Contemporary Khadi Co-ord',
      slug: 'contemporary-khadi-coord',
      summary: 'Handspun khadi coordinates for minimalist summer elegance.',
      targetAttributes: {
        categories: ['Tops', 'Bottoms'],
        subcategories: ['shirt', 'trousers'],
        fabrics: ['cotton'],
        patterns: ['solid'],
        silhouettes: ['relaxed'],
        colorPalette: ['cream', 'indigo'],
        occasions: ['everyday', 'casual outing'],
        seasons: ['summer'],
      },
      lifecycleState: 'ACTIVE',
      validFrom: '2026-03-01',
      validUntil: '2026-09-30',
    },
    provenance: {
      sourceType: 'INDIAN_HERITAGE_CURATION',
      sourceReference: 'Crafts Council of India Archive',
      curatorOrReviewer: 'Heritage Textile Curator',
      observedAt: '2026-03-05',
      confidence: 0.95,
      reviewed: true,
      corroborationCount: 3,
    },
    corroboratingSignalIds: ['sig_1', 'sig_2', 'sig_3'],
    editorialNotes: 'High-utility Indian handloom contemporary styling.',
    reviewedBy: 'StyleSaathi Editorial Board',
    reviewedAt: '2026-03-10',
  };

  describe('Application Policy Trust Weights', () => {
    it('applies configured application policy weights accurately', () => {
      expect(deriveSourceTrustWeight('CURATED_EDITORIAL')).toBe(1.0);
      expect(deriveSourceTrustWeight('OFFICIAL_FASHION_SOURCE')).toBe(0.95);
      expect(deriveSourceTrustWeight('INDIAN_HERITAGE_CURATION')).toBe(0.95);
      expect(deriveSourceTrustWeight('DESIGNER_ARCHIVE')).toBe(0.85);
      expect(deriveSourceTrustWeight('PUBLIC_TREND_REPORT')).toBe(0.70);
      expect(deriveSourceTrustWeight('COMMUNITY_OBSERVATION')).toBe(0.40);
      expect(deriveSourceTrustWeight('UNVERIFIED_SOCIAL')).toBe(0.20);
    });

    it('derives trend confidence factoring corroborating signals', () => {
      const conf = deriveTrendConfidence(baseTrend);
      // Trust weight is 0.95, 3 corroborating signals adds 3 * 0.05 = 0.15 capped at 1.0 -> 1.0
      expect(conf).toBe(1.0);
    });
  });

  describe('Temporal Freshness Evaluation', () => {
    it('evaluates freshness status correctly based on reference timestamp', () => {
      // 20 days after observation -> FRESH
      const freshStatus = evaluateTrendFreshness(baseTrend, '2026-03-25');
      expect(freshStatus.status).toBe('FRESH');
      expect(freshStatus.daysSinceObservation).toBe(20);

      // 120 days after observation -> ESTABLISHED
      const establishedStatus = evaluateTrendFreshness(baseTrend, '2026-07-03');
      expect(establishedStatus.status).toBe('ESTABLISHED');

      // 200 days after observation but before validUntil (2026-09-30) -> SEASONAL_CLASSIC
      const classicStatus = evaluateTrendFreshness(baseTrend, '2026-09-25');
      expect(classicStatus.status).toBe('SEASONAL_CLASSIC');

      // After validUntil -> EXPIRED
      const expiredStatus = evaluateTrendFreshness(baseTrend, '2026-10-05');
      expect(expiredStatus.status).toBe('EXPIRED');
    });
  });

  describe('Lifecycle State & Active Discovery Guard', () => {
    it('prevents unreviewed trends from becoming ACTIVE', () => {
      const unreviewedTrend: CuratedActiveTrend = {
        ...baseTrend,
        reviewedBy: '',
        reviewedAt: '',
      };
      const state = evaluateTrendLifecycleState(unreviewedTrend, '2026-05-01');
      expect(state).not.toBe('ACTIVE');
      expect(isTrendEligibleForActiveDiscovery(unreviewedTrend, '2026-05-01')).toBe(false);
    });

    it('identifies UPCOMING trends when referenceDate is before validFrom', () => {
      const state = evaluateTrendLifecycleState(baseTrend, '2026-02-15');
      expect(state).toBe('UPCOMING');
      expect(isTrendEligibleForActiveDiscovery(baseTrend, '2026-02-15')).toBe(false);
    });

    it('identifies EXPIRED trends when referenceDate is after validUntil', () => {
      const state = evaluateTrendLifecycleState(baseTrend, '2026-10-01');
      expect(state).toBe('EXPIRED');
      expect(isTrendEligibleForActiveDiscovery(baseTrend, '2026-10-01')).toBe(false);
    });

    it('confirms eligibility when trend is reviewed, ACTIVE, and within date window', () => {
      expect(isTrendEligibleForActiveDiscovery(baseTrend, '2026-05-15')).toBe(true);
    });
  });
});
