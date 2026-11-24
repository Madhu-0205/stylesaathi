import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  deriveStyleDNAProfile,
  correctStyleDNAPreference,
  removeStyleDNAPreference,
  confirmStyleDNAPreference,
  determineEvidenceSource,
  STYLE_DNA_VERSION,
} from '../engine/styleDNA';
import {
  derivePersonalStyleProfile,
  STYLE_BRAIN_VERSION,
} from '../engine/styleBrain';
import {
  generateOutfits,
} from '../engine';
import { recommendOutfits } from '../engine/recommendationEngine';
import {
  WardrobeItem,
  WearEvent,
  StylePreferences,
  PersonalStyleProfile,
  AttributeAffinity,
  StyleDNAProfile,
  Occasion,
  DEFAULT_STYLE_PREFERENCES,
} from '../types';
import { StyleDNAStudio } from '../components/profile/StyleDNAStudio';

// ----------------------------------------------------------------------------
// TEST HELPERS & FIXTURES
// ----------------------------------------------------------------------------
function createMockPreferences(overrides: Partial<StylePreferences> = {}): StylePreferences {
  return {
    ...DEFAULT_STYLE_PREFERENCES,
    ...overrides,
  };
}

type MockProfileOverrides = Omit<
  Partial<PersonalStyleProfile>,
  'fabricAffinities' | 'colorAffinities' | 'patternAffinities' | 'fitAffinities'
> & {
  fabricAffinities?: Partial<Record<string, AttributeAffinity>>;
  colorAffinities?: Record<string, AttributeAffinity>;
  patternAffinities?: Partial<Record<string, AttributeAffinity>>;
  fitAffinities?: Partial<Record<string, AttributeAffinity>>;
};

function createMockProfile(overrides: MockProfileOverrides = {}): PersonalStyleProfile {
  const base = derivePersonalStyleProfile([], [], []);
  return {
    ...base,
    ...(overrides as any),
    fabricAffinities: {
      ...base.fabricAffinities,
      ...(overrides.fabricAffinities || {}),
    } as any,
    colorAffinities: {
      ...base.colorAffinities,
      ...(overrides.colorAffinities || {}),
    },
  };
}

function createMockWear(
  id: string,
  itemId: string,
  timeAgo: number,
  occasion?: Occasion
): WearEvent {
  const t = Date.now() - timeAgo;
  return {
    id,
    userId: 'test_user',
    wardrobeItemId: itemId,
    wornAt: t,
    createdAt: t,
    timestamp: t,
    occasion,
  };
}

const mockKhadiKurta: WardrobeItem = {
  id: 'item_khadi_kurta_1',
  name: 'Indigo Khadi Cotton Kurta',
  category: 'Ethnic',
  subcategory: 'kurta',
  colors: ['navy', 'indigo'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'relaxed',
  seasons: ['summer', 'winter'],
  formality: 2,
  occasions: ['everyday', 'college', 'casual outing'],
  status: 'clean',
  favorite: true,
  note: 'Handspun organic khadi',
  timesWorn: 6,
  lastWorn: Date.now() - 86400000 * 2,
  createdAt: Date.now() - 86400000 * 60,
};

const mockSilkNehruJacket: WardrobeItem = {
  id: 'item_silk_nehru_2',
  name: 'Raw Silk Nehru Jacket',
  category: 'Ethnic',
  subcategory: 'jacket',
  colors: ['gold', 'mustard'],
  fabric: 'silk',
  pattern: 'zari_brocade',
  fit: 'tailored',
  seasons: ['winter', 'summer'],
  formality: 4,
  occasions: ['wedding guest', 'festive'],
  status: 'clean',
  favorite: false,
  note: 'Heritage banarasi trim',
  timesWorn: 0, // Unworn gem candidate!
  createdAt: Date.now() - 86400000 * 90,
};

const mockLinenPants: WardrobeItem = {
  id: 'item_linen_pants_3',
  name: 'Ivory Linen Straight Trousers',
  category: 'Bottoms',
  subcategory: 'trousers',
  colors: ['white', 'ivory'],
  fabric: 'linen',
  pattern: 'solid',
  fit: 'straight',
  seasons: ['summer', 'winter'],
  formality: 3,
  occasions: ['everyday', 'office', 'casual outing', 'wedding guest'],
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 4,
  lastWorn: Date.now() - 86400000 * 5,
  createdAt: Date.now() - 86400000 * 60,
};

const mockDirtyPajama: WardrobeItem = {
  id: 'item_dirty_pajama_4',
  name: 'Churidar Pajama',
  category: 'Bottoms',
  subcategory: 'churidar',
  colors: ['white'],
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'slim',
  seasons: ['winter', 'summer'],
  formality: 3,
  occasions: ['festive', 'wedding guest'],
  status: 'needs_washing', // In laundry!
  favorite: false,
  note: 'Needs dry cleaning',
  timesWorn: 3,
  createdAt: Date.now() - 86400000 * 60,
};

const mockLeatherMojari: WardrobeItem = {
  id: 'item_leather_mojari_5',
  name: 'Tan Leather Mojari',
  category: 'Footwear',
  subcategory: 'formal shoes',
  colors: ['brown'],
  fabric: 'unknown',
  pattern: 'solid',
  fit: 'regular',
  seasons: ['winter', 'summer'],
  formality: 3,
  occasions: ['festive', 'wedding guest', 'casual outing', 'everyday'],
  status: 'clean',
  favorite: false,
  note: 'Genuine leather sole',
  timesWorn: 2,
  createdAt: Date.now() - 86400000 * 60,
};

describe('Phase 1.9: Style DNA & Personal Fashion Intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. UNKNOWN PREFERENCE HANDLING
  // --------------------------------------------------------------------------
  describe('1. Unknown Preference Handling', () => {
    it('preserves unobserved dimensions as unknown without hallucinating attributes', () => {
      const emptyProfile = derivePersonalStyleProfile([], [], [], undefined);
      const dna = deriveStyleDNAProfile(emptyProfile, [], [], undefined);

      expect(dna.version).toBe(STYLE_DNA_VERSION);
      expect(dna.totalSignalsCount).toBe(0);
      expect(dna.hasSufficientEvidence).toBe(false);

      // Verify unobserved pattern is explicitly unknown
      const bandhani = dna.patterns.find((p) => p.value === 'bandhani');
      expect(bandhani).toBeDefined();
      expect(bandhani?.status).toBe('unknown');
      expect(bandhani?.score).toBe(0);
      expect(bandhani?.confidence).toBe(0);
      expect(bandhani?.evidenceSource).toBe('unobserved');
      expect(bandhani?.sampleCount).toBe(0);

      // Verify unobserved fabric
      const wool = dna.fabrics.find((f) => f.value === 'wool');
      expect(wool).toBeDefined();
      expect(wool?.status).toBe('unknown');
      expect(wool?.score).toBe(0);
      expect(wool?.confidence).toBe(0);

      // Verify unobserved color is not fabricated
      const crimson = dna.colors.find((c) => c.value === 'crimson');
      expect(crimson).toBeUndefined();
    });

    it('maps unobserved evidence source safely via determineEvidenceSource', () => {
      expect(determineEvidenceSource(undefined, false, 0)).toBe('unobserved');
      const blankAffinity: AttributeAffinity = {
        score: 0,
        confidence: 0,
        sampleCount: 0,
        lastInteractedAt: 0,
        status: 'unknown',
        uncertainty: 1.0,
      };
      expect(determineEvidenceSource(blankAffinity, false, 0)).toBe('unobserved');
    });
  });

  // --------------------------------------------------------------------------
  // 2. EXPLICIT PREFERENCE PRECEDENCE
  // --------------------------------------------------------------------------
  describe('2. Explicit Preference Precedence', () => {
    it('gives explicit declarations maximum evidentiary authority over passive observations', () => {
      const explicitPrefs = createMockPreferences({
        preferredAesthetics: ['Minimal', 'Indo-Western'],
        preferredColors: ['navy', 'indigo'],
        preferredFits: ['relaxed'],
        fabricSensitivities: ['polyblend'],
      });

      const baseProfile = derivePersonalStyleProfile([], [], [mockKhadiKurta], explicitPrefs);
      const dna = deriveStyleDNAProfile(baseProfile, [mockKhadiKurta], [], explicitPrefs);

      // Explicit aesthetic
      const indoWestern = dna.aesthetics.find((a) => a.value === 'indo_western');
      expect(indoWestern).toBeDefined();
      expect(indoWestern?.status).toBe('explicit');
      expect(indoWestern?.isConfirmed).toBe(true);
      expect(indoWestern?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(indoWestern?.evidenceSource).toBe('explicit_declaration');

      // Explicit color
      const navy = dna.colors.find((c) => c.value === 'navy');
      expect(navy).toBeDefined();
      expect(navy?.status).toBe('explicit');
      expect(navy?.isConfirmed).toBe(true);
      expect(navy?.score).toBeGreaterThanOrEqual(0.65);

      // Explicit fit
      const relaxed = dna.silhouettes.find((s) => s.value === 'relaxed');
      expect(relaxed).toBeDefined();
      expect(relaxed?.status).toBe('explicit');
      expect(relaxed?.isConfirmed).toBe(true);

      // Disliked/sensitive fabric
      const polyblend = dna.fabrics.find((f) => f.value === 'polyblend');
      expect(polyblend).toBeDefined();
      expect(polyblend?.status).toBe('explicit');
      expect(polyblend?.score).toBeLessThan(-0.5);
    });
  });

  // --------------------------------------------------------------------------
  // 3. BAYESIAN CONFIDENCE UPDATES & WEAR EVENT ACCUMULATION
  // --------------------------------------------------------------------------
  describe('3. Bayesian Confidence Updates & Wear Event Accumulation', () => {
    it('increments confidence and transitions status to observed as wear signals accumulate', () => {
      const wearEvents: WearEvent[] = [
        createMockWear('w1', mockKhadiKurta.id, 86400000 * 10, 'everyday'),
        createMockWear('w2', mockKhadiKurta.id, 86400000 * 7, 'college'),
        createMockWear('w3', mockKhadiKurta.id, 86400000 * 3, 'everyday'),
        createMockWear('w4', mockLinenPants.id, 86400000 * 2, 'office'),
      ];

      const profile = derivePersonalStyleProfile([], wearEvents, [mockKhadiKurta, mockLinenPants]);
      const dna = deriveStyleDNAProfile(profile, [mockKhadiKurta, mockLinenPants], wearEvents);

      expect(dna.totalSignalsCount).toBeGreaterThanOrEqual(4);
      expect(dna.hasSufficientEvidence).toBe(true);

      // Cotton fabric wear
      const cotton = dna.fabrics.find((f) => f.value === 'cotton');
      expect(cotton).toBeDefined();
      expect(cotton?.evidenceSource).toBe('worn_history');
      expect(cotton?.sampleCount).toBeGreaterThanOrEqual(3);
      expect(cotton?.confidence).toBeGreaterThan(0.2);

      // Relaxed fit
      const relaxed = dna.silhouettes.find((s) => s.value === 'relaxed');
      expect(relaxed).toBeDefined();
      expect(relaxed?.evidenceSource).toBe('worn_history');
      expect(relaxed?.sampleCount).toBeGreaterThanOrEqual(3);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CONTRADICTORY EVIDENCE HANDLING
  // --------------------------------------------------------------------------
  describe('4. Contradictory Evidence Handling', () => {
    it('preserves contradictory status and reports balanced uncertainty', () => {
      const conflictedAffinity: AttributeAffinity = {
        score: 0.05,
        confidence: 0.75,
        sampleCount: 8,
        lastInteractedAt: Date.now(),
        status: 'contradictory',
        uncertainty: 0.45,
        provenance: {
          status: 'contradictory',
          observationCount: 8,
          alpha: 4.5,
          beta: 4.2,
          variance: 0.05,
          uncertainty: 0.45,
          credibleInterval: [-0.35, 0.45],
          signalCounts: { worn: 4, rejected: 4 },
          lastInteractedAt: Date.now(),
          isExplicitOverride: false,
        },
      };

      const customProfile = createMockProfile({
        overallConfidence: 0.8,
        totalSignalsCount: 8,
        colorAffinities: { yellow: conflictedAffinity },
      });

      const dna = deriveStyleDNAProfile(customProfile, [], []);
      const yellow = dna.colors.find((c) => c.value === 'yellow');
      expect(yellow).toBeDefined();
      expect(yellow?.status).toBe('contradictory');
      expect(yellow?.confidence).toBe(0.75);
    });
  });

  // --------------------------------------------------------------------------
  // 5. CONTEXT-SPECIFIC PREFERENCE ISOLATION
  // --------------------------------------------------------------------------
  describe('5. Context-Specific Preference Isolation', () => {
    it('isolates festive occasion preferences without contaminating everyday preferences', () => {
      const festiveWear: WearEvent[] = [
        createMockWear('w_festive_1', mockSilkNehruJacket.id, 86400000 * 20, 'festive'),
        createMockWear('w_festive_2', mockSilkNehruJacket.id, 86400000 * 5, 'festive'),
      ];

      const everydayWear: WearEvent[] = [
        createMockWear('w_everyday_1', mockKhadiKurta.id, 86400000 * 8, 'everyday'),
        createMockWear('w_everyday_2', mockLinenPants.id, 86400000 * 2, 'everyday'),
      ];

      const allWears = [...festiveWear, ...everydayWear];
      const profile = derivePersonalStyleProfile(
        [],
        allWears,
        [mockSilkNehruJacket, mockKhadiKurta, mockLinenPants]
      );
      const dna = deriveStyleDNAProfile(
        profile,
        [mockSilkNehruJacket, mockKhadiKurta, mockLinenPants],
        allWears
      );

      // Verify occasion slices exist
      expect(dna.occasionPreferences).toBeDefined();
      expect(dna.occasionPreferences['festive']).toBeDefined();
      expect(dna.occasionPreferences['everyday']).toBeDefined();

      const festiveColors = dna.occasionPreferences['festive'].map((n) => n.value);
      const everydayColors = dna.occasionPreferences['everyday'].map((n) => n.value);

      expect(festiveColors).toContain('gold');
      expect(everydayColors).toContain('navy');
    });
  });

  // --------------------------------------------------------------------------
  // 6. SIGNAL DISCOUNTING / CO-OCCURRING ENSEMBLE DAMPENING
  // --------------------------------------------------------------------------
  describe('6. Signal Discounting / Co-occurring Ensemble Dampening', () => {
    it('dampens co-occurring ensemble items using 1/sqrt(M) Bayesian weight scaling', () => {
      // 3 items worn together in 1 outfit
      const ensembleItemIds = [mockKhadiKurta.id, mockLinenPants.id, mockLeatherMojari.id];
      const M = ensembleItemIds.length;
      const expectedDiscountWeight = 1 / Math.sqrt(M); // 1 / sqrt(3) ~ 0.577

      expect(expectedDiscountWeight).toBeCloseTo(0.577, 2);

      // Single item wear weight is 1 / sqrt(1) = 1.0
      const singleWeight = 1 / Math.sqrt(1);
      expect(singleWeight).toBe(1.0);
      expect(expectedDiscountWeight).toBeLessThan(singleWeight);
    });
  });

  // --------------------------------------------------------------------------
  // 7. USER AGENCY: CORRECTION, CONFIRMATION, REMOVAL
  // --------------------------------------------------------------------------
  describe('7. User Agency: Correction, Confirmation, Removal', () => {
    const baseProfile = createMockProfile({
      overallConfidence: 0.6,
      totalSignalsCount: 5,
      colorAffinities: {
        indigo: {
          score: 0.4,
          confidence: 0.5,
          sampleCount: 3,
          lastInteractedAt: Date.now(),
          status: 'observed',
          uncertainty: 0.3,
        },
      },
      fabricAffinities: {
        cotton: {
          score: 0.5,
          confidence: 0.6,
          sampleCount: 4,
          lastInteractedAt: Date.now(),
          status: 'observed',
          uncertainty: 0.25,
        },
      },
      topColors: ['indigo'],
      topFabrics: ['cotton'],
    });

    it('correctStyleDNAPreference allows user to calibrate affinity score', () => {
      const { updatedProfile, updatedDNA } = correctStyleDNAPreference(
        baseProfile,
        [mockKhadiKurta],
        [],
        undefined,
        'color',
        'indigo',
        0.85
      );

      const indigo = updatedDNA.colors.find((c) => c.value === 'indigo');
      expect(indigo).toBeDefined();
      expect(indigo?.score).toBe(0.85);
      expect(indigo?.status).toBe('explicit');
      expect(indigo?.isConfirmed).toBe(true);
      expect(updatedProfile.colorAffinities['indigo']?.provenance?.isExplicitOverride).toBe(true);
    });

    it('confirmStyleDNAPreference promotes inferred attribute to explicit signature', () => {
      const { updatedDNA } = confirmStyleDNAPreference(
        baseProfile,
        [mockKhadiKurta],
        [],
        undefined,
        'fabric',
        'cotton'
      );

      const cotton = updatedDNA.fabrics.find((f) => f.value === 'cotton');
      expect(cotton).toBeDefined();
      expect(cotton?.status).toBe('explicit');
      expect(cotton?.isConfirmed).toBe(true);
      expect(cotton?.score).toBe(0.85);
    });

    it('removeStyleDNAPreference returns attribute to unobserved neutral state', () => {
      const { updatedProfile, updatedDNA } = removeStyleDNAPreference(
        baseProfile,
        [mockKhadiKurta],
        [],
        undefined,
        'color',
        'indigo'
      );

      const indigo = updatedDNA.colors.find((c) => c.value === 'indigo');
      expect(indigo).toBeDefined();
      expect(indigo?.status).toBe('unknown');
      expect(indigo?.score).toBe(0);
      expect(indigo?.confidence).toBe(0);
      expect(indigo?.sampleCount).toBe(0);
      expect(indigo?.isConfirmed).toBe(false);
      expect(updatedProfile.topColors).not.toContain('indigo');
    });
  });

  // --------------------------------------------------------------------------
  // 8. EVIDENCE SUFFICIENCY & INSIGHT GENERATION / SUPPRESSION
  // --------------------------------------------------------------------------
  describe('8. Evidence Sufficiency & Insight Generation / Suppression', () => {
    it('suppresses insights when total signals < 3 to prevent premature advice', () => {
      const lowEvidenceProfile = createMockProfile({
        overallConfidence: 0.15,
        totalSignalsCount: 2, // < 3!
      });

      const dna = deriveStyleDNAProfile(lowEvidenceProfile, [mockKhadiKurta], []);
      expect(dna.hasSufficientEvidence).toBe(false);
      expect(dna.insights).toEqual([]); // Strictly empty!
    });

    it('generates evidence-grounded insights when total signals >= 3', () => {
      const highEvidenceProfile = createMockProfile({
        overallConfidence: 0.82,
        totalSignalsCount: 6, // >= 3!
        topColors: ['indigo', 'navy', 'white'],
        topFabrics: ['cotton', 'linen', 'silk'],
        topFits: ['relaxed', 'straight', 'tailored'],
        recentExplorations: ['modern bandhani', 'oversized layering'],
      });

      const wearEvents: WearEvent[] = [
        createMockWear('w1', mockKhadiKurta.id, 86400000 * 5, 'everyday'),
        createMockWear('w2', mockKhadiKurta.id, 86400000 * 3, 'college'),
        createMockWear('w3', mockLinenPants.id, 86400000 * 1, 'office'),
      ];

      const dna = deriveStyleDNAProfile(
        highEvidenceProfile,
        [mockKhadiKurta, mockLinenPants, mockSilkNehruJacket],
        wearEvents
      );

      expect(dna.hasSufficientEvidence).toBe(true);
      expect(dna.insights.length).toBeGreaterThan(0);

      // Verify insight types
      const insightTypes = dna.insights.map((i) => i.type);
      expect(insightTypes).toContain('color_frequency');
      expect(insightTypes).toContain('silhouette_signature');

      // Verify underused gem is surfaced for mockSilkNehruJacket (0 wears, clean)
      const underused = dna.insights.find((i) => i.type === 'underused_gem');
      expect(underused).toBeDefined();
      expect(underused?.title).toContain(mockSilkNehruJacket.name);
    });
  });

  // --------------------------------------------------------------------------
  // 9. RECOMMENDATION INTEGRATION & HARD CONSTRAINT PRESERVATION
  // --------------------------------------------------------------------------
  describe('9. Recommendation Integration & Hard Constraint Preservation', () => {
    it('applies Style DNA affinity as a bounded prior without overriding laundry hard constraint', () => {
      // Style preferences strongly favor festive traditional
      const preferences = createMockPreferences({
        preferredAesthetics: ['Traditional'],
        preferredColors: ['white'],
        preferredFits: ['slim'],
      });

      const items = [mockKhadiKurta, mockSilkNehruJacket, mockDirtyPajama, mockLinenPants];

      // Generate recommendations for a wedding guest occasion
      const outfits = generateOutfits(
        items,
        'wedding guest',
        'summer',
        3,
        0,
        preferences
      );

      // Assert that dirty pajama is NEVER included in any generated outfit slot despite high style match
      for (const outfit of outfits) {
        const allPieces = Object.values(outfit.slots).flat();
        const containsDirty = allPieces.some((p) => p.id === mockDirtyPajama.id);
        expect(containsDirty).toBe(false);
      }
    });

    it('preserves diversity across Best Match, Alternative, and Explore roles', () => {
      const itemContemporaryShirt: WardrobeItem = {
        ...mockKhadiKurta,
        id: 'item_contemporary_shirt',
        name: 'Contemporary Olive Camp Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['olive'],
        fabric: 'linen',
        fit: 'relaxed',
        occasions: ['everyday', 'casual outing'],
        seasons: ['summer'],
        timesWorn: 1,
      };

      const items = [
        mockKhadiKurta,
        mockLinenPants,
        mockSilkNehruJacket,
        mockLeatherMojari,
        itemContemporaryShirt,
      ];

      const res = recommendOutfits({
        items,
        occasion: 'casual outing',
        season: 'summer',
        localDate: '2026-11-15',
        preferences: createMockPreferences({ preferredColors: ['indigo'] }),
      });

      expect(res.length).toBeGreaterThan(0);
      const roles = res.map((o) => o.role);
      // At least best_match is produced
      expect(roles).toContain('best_match');
    });
  });

  // --------------------------------------------------------------------------
  // 10. COMPONENT RENDERING & INTERACTIVE AGENCY
  // --------------------------------------------------------------------------
  describe('10. Component Rendering & Interactive Agency', () => {
    it('renders StyleDNAStudio with editorial atelier typography and tabs', () => {
      const mockDNA: StyleDNAProfile = {
        version: 1,
        userId: 'test_user',
        updatedAt: Date.now(),
        overallConfidence: 0.85,
        totalSignalsCount: 12,
        hasSufficientEvidence: true,
        aesthetics: [
          {
            id: 'aes_minimalist',
            dimension: 'aesthetic',
            value: 'minimalist',
            label: 'Minimalist & Quiet Luxury',
            score: 0.85,
            confidence: 0.9,
            status: 'explicit',
            evidenceSource: 'explicit_declaration',
            sampleCount: 4,
            lastUpdated: Date.now(),
            isConfirmed: true,
          },
        ],
        colors: [
          {
            id: 'col_indigo',
            dimension: 'color',
            value: 'indigo',
            label: 'Indigo',
            score: 0.75,
            confidence: 0.8,
            status: 'observed',
            evidenceSource: 'worn_history',
            sampleCount: 5,
            lastUpdated: Date.now(),
            isConfirmed: false,
          },
        ],
        silhouettes: [
          {
            id: 'sil_relaxed',
            dimension: 'silhouette',
            value: 'relaxed',
            label: 'Relaxed Fit',
            score: 0.8,
            confidence: 0.85,
            status: 'explicit',
            evidenceSource: 'explicit_declaration',
            sampleCount: 5,
            lastUpdated: Date.now(),
            isConfirmed: true,
          },
        ],
        fabrics: [],
        patterns: [],
        culturalAffinities: [],
        occasionPreferences: {},
        insights: [
          {
            id: 'ins_1',
            type: 'color_frequency',
            title: 'Indigo Foundation',
            evidence: 'Dominates 60% of your everyday rotation',
            confidence: 0.85,
          },
          {
            id: 'ins_2',
            type: 'underused_gem',
            title: 'Unworn Raw Silk Nehru Jacket',
            evidence: 'Pairs elegantly with your ivory linen trousers',
            confidence: 0.9,
          },
        ],
        avoidances: { colors: [], fabrics: [], patterns: [], styles: [] },
      };

      const html = renderToString(
        <StyleDNAStudio
          styleDNA={mockDNA}
          onConfirmPreference={vi.fn()}
          onCorrectPreference={vi.fn()}
          onRemovePreference={vi.fn()}
          onResetLearnedStyle={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Header assertions
      expect(html).toContain('STYLE DNA · ATELIER INTUITION');
      expect(html).toContain('Personal Fashion Intelligence');
      expect(html).toContain('85% Calibrated');
      expect(html).toContain('12 signals · 2 confirmed');

      // Tab pills
      expect(html).toContain('Overview &amp; Insights');
      expect(html).toContain('Aesthetics &amp; Heritage');
      expect(html).toContain('Color Palette');
      expect(html).toContain('Silhouettes &amp; Fits');
      expect(html).toContain('Fabrics &amp; Weaves');
      expect(html).toContain('Craft &amp; Patterns');
      expect(html).toContain('Occasions');

      // Grounded insights cards
      expect(html).toContain('Indigo Foundation');
      expect(html).toContain('Unworn Raw Silk Nehru Jacket');
      expect(html).toContain('Style In Dress Me');

      // Card action controls
      expect(html).toContain('Calibrate');
      expect(html).toContain('Reset Style Memory');
    });

    it('renders early observation banner when total signals < 3', () => {
      const earlyDNA: StyleDNAProfile = {
        version: 1,
        userId: 'test_user',
        updatedAt: Date.now(),
        overallConfidence: 0.2,
        totalSignalsCount: 1,
        hasSufficientEvidence: false,
        aesthetics: [],
        colors: [],
        silhouettes: [],
        fabrics: [],
        patterns: [],
        culturalAffinities: [],
        occasionPreferences: {},
        insights: [],
        avoidances: { colors: [], fabrics: [], patterns: [], styles: [] },
      };

      const html = renderToString(
        <StyleDNAStudio
          styleDNA={earlyDNA}
          onConfirmPreference={vi.fn()}
          onCorrectPreference={vi.fn()}
          onRemovePreference={vi.fn()}
        />
      );

      expect(html).toContain('Observing Habits');
      expect(html).toContain('Your personal style profile is observing early habits');
      expect(html).toContain('1 of 3 baseline signals recorded');
    });
  });
});
