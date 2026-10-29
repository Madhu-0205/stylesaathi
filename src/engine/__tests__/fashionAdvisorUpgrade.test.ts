import { describe, it, expect } from 'vitest';
import {
  WardrobeItem,
  RecommendationRequest,
  StylePreferences,
  PersonalStyleProfile,
  ContextSnapshot,
  WeatherSnapshot,
} from '../../types';
import { recommendOutfits, recommendOutfitsWithTelemetry } from '../recommendationEngine';
import { validateTeenSafety, evaluateTier1HardConstraints } from '../hardConstraints';
import { evaluateInternationalStyleSignals, INTERNATIONAL_STYLE_SYSTEMS } from '../knowledge/internationalStyles';
import { fashionKnowledgeEngine } from '../knowledge/fashionKnowledgeEngine';
import { TEMPLATES } from '../outfitTemplates';
import { derivePersonalStyleProfile } from '../styleBrain';

const mockItem = (overrides: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id: 'item-test-1',
  name: 'Test Item',
  category: 'Tops',
  subcategory: 'shirt',
  colors: ['white'],
  seasons: ['summer', 'monsoon', 'winter'],
  occasions: ['everyday', 'casual outing'],
  formality: 3,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  userVerified: true,
  ...overrides,
});

describe('Indian-First AI Fashion Advisor Upgrade', () => {
  // Test wardrobe items
  const sherwaniCream = mockItem({
    id: 'sherwani-1',
    name: 'Cream Silk Sherwani',
    category: 'Ethnic',
    subcategory: 'sherwani',
    colors: ['cream', 'gold'],
    fabric: 'silk',
    pattern: 'embroidered',
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'festive'],
  });

  const churidarGold = mockItem({
    id: 'churidar-1',
    name: 'Gold Silk Churidar',
    category: 'Ethnic',
    subcategory: 'churidar',
    colors: ['gold'],
    fabric: 'silk',
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'festive'],
  });

  const juttisGold = mockItem({
    id: 'juttis-1',
    name: 'Gold Embroidered Juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold'],
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'festive', 'puja'],
  });

  const kurtaKhadi = mockItem({
    id: 'kurta-1',
    name: 'White Khadi Kurta',
    category: 'Ethnic',
    subcategory: 'kurta',
    colors: ['white'],
    fabric: 'khadi',
    pattern: 'solid',
    fit: 'straight',
    formality: 3,
    occasions: ['puja', 'festive', 'family gathering', 'everyday'],
  });

  const dhotiSilk = mockItem({
    id: 'dhoti-1',
    name: 'Kasavu Border Dhoti',
    category: 'Ethnic',
    subcategory: 'dhoti',
    colors: ['cream', 'gold'],
    fabric: 'cotton',
    fit: 'relaxed',
    formality: 4,
    occasions: ['puja', 'festive', 'family function', 'wedding guest'],
  });

  const kolhapurisBrown = mockItem({
    id: 'kolhapuri-1',
    name: 'Kolhapuri Chappals',
    category: 'Footwear',
    subcategory: 'kolhapuris',
    colors: ['brown'],
    formality: 3,
    occasions: ['puja', 'festive', 'everyday', 'casual outing'],
  });

  const bandhgalaNavy = mockItem({
    id: 'bandhgala-1',
    name: 'Navy Structured Bandhgala',
    category: 'Ethnic',
    subcategory: 'bandhgala',
    colors: ['navy'],
    fabric: 'wool',
    fit: 'tailored',
    formality: 5,
    occasions: ['wedding guest', 'celebration', 'office', 'party'],
  });

  const trousersGrey = mockItem({
    id: 'trousers-1',
    name: 'Grey Tailored Trousers',
    category: 'Bottoms',
    subcategory: 'trousers',
    colors: ['grey'],
    fabric: 'cotton',
    fit: 'tailored',
    formality: 4,
    occasions: ['office', 'wedding guest', 'celebration'],
  });

  const shoesFormal = mockItem({
    id: 'shoes-1',
    name: 'Black Oxford Shoes',
    category: 'Footwear',
    subcategory: 'formal shoes',
    colors: ['black'],
    formality: 5,
    occasions: ['office', 'wedding guest', 'celebration'],
  });

  const cropTopRed = mockItem({
    id: 'crop-1',
    name: 'Red Plunging Crop Top',
    category: 'Tops',
    subcategory: 'crop top',
    colors: ['red'],
    fabric: 'rayon',
    fit: 'slim',
    formality: 2,
    occasions: ['party', 'casual outing'],
  });

  const shortsDenim = mockItem({
    id: 'shorts-1',
    name: 'Distressed Denim Shorts',
    category: 'Bottoms',
    subcategory: 'shorts',
    colors: ['blue'],
    fabric: 'denim',
    formality: 1,
    occasions: ['casual outing'],
  });

  const sneakersWhite = mockItem({
    id: 'sneakers-1',
    name: 'White Clean Sneakers',
    category: 'Footwear',
    subcategory: 'sneakers',
    colors: ['white'],
    formality: 2,
    occasions: ['college', 'school', 'casual outing', 'everyday'],
  });

  const jeansRelaxed = mockItem({
    id: 'jeans-1',
    name: 'Relaxed Indigo Jeans',
    category: 'Bottoms',
    subcategory: 'jeans',
    colors: ['navy', 'blue'],
    fabric: 'denim',
    fit: 'relaxed',
    formality: 2,
    occasions: ['college', 'school', 'casual outing', 'everyday'],
  });

  // =========================================================================
  // 1. INDIAN GARMENT TAXONOMY & REGIONAL ENSEMBLE COMPLETENESS
  // =========================================================================
  describe('1. Indian Traditional Garment Ensembles', () => {
    it('contains new traditional Indian templates in TEMPLATES', () => {
      const templateNames = TEMPLATES.map((t) => t.name);
      expect(templateNames).toContain('Sherwani look');
      expect(templateNames).toContain('Dhoti & Kurta look');
      expect(templateNames).toContain('Bandhgala look');
    });

    it('recommends an authentic Sherwani ensemble for celebratory wedding guest', () => {
      const request: RecommendationRequest = {
        items: [sherwaniCream, churidarGold, juttisGold, trousersGrey, shoesFormal],
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-11-15',
      };

      const result = recommendOutfits(request);
      expect(result.length).toBeGreaterThan(0);

      const sherwaniOutfit = result.find((o) => o.template === 'Sherwani look');
      expect(sherwaniOutfit).toBeDefined();
      expect(sherwaniOutfit!.slots.top[0].id).toBe('sherwani-1');
      expect(sherwaniOutfit!.slots.bottom[0].id).toBe('churidar-1');
      expect(sherwaniOutfit!.slots.footwear[0].id).toBe('juttis-1');
      expect(sherwaniOutfit!.explanation.culturalRationale).toContain('celebration');
    });

    it('recommends an authentic Dhoti & Kurta look for religious puja ceremonies', () => {
      const request: RecommendationRequest = {
        items: [kurtaKhadi, dhotiSilk, kolhapurisBrown, cropTopRed, shortsDenim],
        occasion: 'puja',
        season: 'summer',
        localDate: '2026-10-20',
      };

      const result = recommendOutfits(request);
      expect(result.length).toBeGreaterThan(0);

      const dhotiLook = result.find((o) => o.template === 'Dhoti & Kurta look' || o.template === 'Kurta look');
      expect(dhotiLook).toBeDefined();
      const bottomItem = dhotiLook!.slots.bottom[0];
      expect(bottomItem.subcategory).toBe('dhoti');
    });

    it('recommends an architectural Bandhgala look with tailored trousers and formal shoes', () => {
      const request: RecommendationRequest = {
        items: [bandhgalaNavy, trousersGrey, shoesFormal, kurtaKhadi, dhotiSilk],
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-12-05',
      };

      const result = recommendOutfits(request);
      expect(result.length).toBeGreaterThan(0);

      const bandhgalaLook = result.find((o) => o.template === 'Bandhgala look');
      expect(bandhgalaLook).toBeDefined();
      expect(bandhgalaLook!.slots.top[0].subcategory).toBe('bandhgala');
      expect(bandhgalaLook!.slots.bottom[0].subcategory).toBe('trousers');
      expect(bandhgalaLook!.slots.footwear[0].subcategory).toBe('formal shoes');
    });
  });

  // =========================================================================
  // 2. TEEN SAFETY & INCLUSIVITY SAFEGUARDS (AGES 14-17)
  // =========================================================================
  describe('2. Teen Safety & Age-Appropriate Safeguards (Ages 14–17)', () => {
    it('validates teen safety without body-shaming or appearance ratings', () => {
      const teenPrefs: StylePreferences = {
        preferredContexts: [],
        preferredAesthetics: ['Casual'],
        stylingMode: 'simple',
        updatedAt: Date.now(),
        ageBand: 'teen_14_17',
      };

      // Adult crop top in school context must be safely filtered
      const schoolPieces = [cropTopRed, jeansRelaxed, sneakersWhite];
      const checkSchool = validateTeenSafety(schoolPieces, teenPrefs, 'school');
      expect(checkSchool.valid).toBe(false);
      expect(checkSchool.reason).toContain('Age-appropriate safeguard');
      expect(checkSchool.reason).not.toMatch(/ugly|fat|skinny|unattractive|flattering/i);

      // Appropriate kurta and jeans must pass freely
      const appropriatePieces = [kurtaKhadi, jeansRelaxed, sneakersWhite];
      const checkAppropriate = validateTeenSafety(appropriatePieces, teenPrefs, 'school');
      expect(checkAppropriate.valid).toBe(true);
    });

    it('enforces age-appropriate dress code in recommendation engine when teen_14_17 is active', () => {
      const teenPrefs: StylePreferences = {
        preferredContexts: [],
        preferredAesthetics: ['Casual'],
        stylingMode: 'simple',
        updatedAt: Date.now(),
        ageBand: 'teen_14_17',
      };

      const request: RecommendationRequest = {
        items: [cropTopRed, kurtaKhadi, shortsDenim, jeansRelaxed, sneakersWhite],
        occasion: 'school',
        season: 'summer',
        localDate: '2026-08-10',
        preferences: teenPrefs,
      };

      const result = recommendOutfits(request);
      expect(result.length).toBeGreaterThan(0);

      // No recommendation for school should contain crop top or shorts
      for (const outfit of result) {
        const pieces = Object.values(outfit.slots).flat();
        expect(pieces.some((p) => p.subcategory === 'crop top')).toBe(false);
        expect(pieces.some((p) => p.subcategory === 'shorts')).toBe(false);
      }

      // Check that transparent explanation includes teen safeguard disclosure
      const bestOutfit = result[0];
      expect(bestOutfit.explanation.assumptions).toBeDefined();
      expect(bestOutfit.explanation.assumptions).toContain(
        'Teen age-appropriate safeguards active — ensuring respectful, campus-compliant silhouettes.'
      );
    });
  });

  // =========================================================================
  // 3. INTERNATIONAL STYLE SYSTEMS & FUSION HARMONY
  // =========================================================================
  describe('3. International Style Taxonomy with Indian-First Foundation', () => {
    it('defines canonical international style systems in prioritized order', () => {
      expect(INTERNATIONAL_STYLE_SYSTEMS.indian_first).toBeDefined();
      expect(INTERNATIONAL_STYLE_SYSTEMS.korean_contemporary_streetwear).toBeDefined();
      expect(INTERNATIONAL_STYLE_SYSTEMS.japanese_relaxed_workwear).toBeDefined();
      expect(INTERNATIONAL_STYLE_SYSTEMS.european_tailored_smart).toBeDefined();
    });

    it('produces positive cross-cultural resonance for South Korean streetwear fusion with Indian kurta', () => {
      const fusionPieces = [
        mockItem({
          id: 'k-kurta',
          subcategory: 'kurta',
          category: 'Ethnic',
          colors: ['black'],
          fit: 'relaxed',
          fabric: 'cotton',
        }),
        mockItem({
          id: 'k-pants',
          subcategory: 'trousers',
          category: 'Bottoms',
          colors: ['grey'],
          fit: 'relaxed',
          fabric: 'cotton',
        }),
        mockItem({
          id: 'k-sneakers',
          subcategory: 'sneakers',
          category: 'Footwear',
          colors: ['white'],
        }),
      ];

      const signals = evaluateInternationalStyleSignals(fusionPieces, ['korean_contemporary_streetwear']);
      expect(signals.length).toBeGreaterThan(0);
      const koreanSignal = signals.find((s) => s.metadata?.system === 'korean_contemporary_streetwear');
      expect(koreanSignal).toBeDefined();
      expect(koreanSignal!.strength).toBeGreaterThan(0.7);
      expect(koreanSignal!.explanationKey).toBe('international_korean_streetwear_resonance');
    });

    it('evaluates Japanese workwear resonance with natural artisanal handloom khadi', () => {
      const japaneseWorkwearPieces = [
        mockItem({
          id: 'j-kurta',
          subcategory: 'kurta',
          category: 'Ethnic',
          fabric: 'khadi',
          colors: ['cream'],
          fit: 'relaxed',
        }),
        mockItem({
          id: 'j-denim',
          subcategory: 'jeans',
          category: 'Bottoms',
          fabric: 'denim',
          colors: ['navy'],
          fit: 'straight',
        }),
      ];

      const signals = evaluateInternationalStyleSignals(japaneseWorkwearPieces, ['japanese_relaxed_workwear']);
      expect(signals.length).toBeGreaterThan(0);
      const japaneseSignal = signals.find((s) => s.metadata?.system === 'japanese_relaxed_workwear');
      expect(japaneseSignal).toBeDefined();
      expect(japaneseSignal!.explanationKey).toBe('international_japanese_workwear_resonance');
    });

    it('evaluates European tailoring synergy with structured bandhgala and formal trousers', () => {
      const euroTailoredPieces = [bandhgalaNavy, trousersGrey, shoesFormal];
      const signals = evaluateInternationalStyleSignals(euroTailoredPieces, ['european_tailored_smart']);
      expect(signals.length).toBeGreaterThan(0);
      const euroSignal = signals.find((s) => s.metadata?.system === 'european_tailored_smart');
      expect(euroSignal).toBeDefined();
      expect(euroSignal!.explanationKey).toBe('international_european_tailored_resonance');
    });
  });

  // =========================================================================
  // 4. TRANSPARENT OUTPUT CONTRACT, CONFIDENCE, & ASSUMPTIONS
  // =========================================================================
  describe('4. Transparent Output Contract & Evidence Honesty', () => {
    it('transparently declares assumptions when weather is unavailable', () => {
      const request: RecommendationRequest = {
        items: [kurtaKhadi, trousersGrey, kolhapurisBrown],
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-05-15',
        context: undefined, // Weather is unavailable
      };

      const { set } = recommendOutfitsWithTelemetry(request);
      expect(set.outfits.length).toBeGreaterThan(0);

      const outfit = set.outfits[0];
      expect(outfit.explanation.assumptions).toBeDefined();
      expect(outfit.explanation.assumptions).toContain(
        'Weather data unavailable — recommendation assumes mild indoor conditions.'
      );
      expect(outfit.explanation.weatherComfortRationale).toBeUndefined();
    });

    it('provides grounded confidence indicator without inventing probabilities', () => {
      const liveWeather: WeatherSnapshot = {
        temperature: 28,
        feelsLike: 29,
        humidity: 60,
        precipitationProbability: 10,
        windSpeed: 8,
        condition: 'clear',
        observedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: 'live',
        location: { city: 'Bengaluru', country: 'India', source: 'geolocation' },
      };

      const contextSnapshot: ContextSnapshot = {
        weather: liveWeather,
        freshness: 'fresh',
        location: liveWeather.location,
        date: '2026-05-15',
        timeOfDay: 'morning',
        thermalContext: 'warm',
        rainContext: 'none',
        occasion: 'office',
        confidence: 0.95,
        source: 'live',
      };

      const styleProfile = derivePersonalStyleProfile([]);
      styleProfile.overallConfidence = 0.8;

      const request: RecommendationRequest = {
        items: [bandhgalaNavy, trousersGrey, shoesFormal],
        occasion: 'office',
        season: 'summer',
        localDate: '2026-05-15',
        context: contextSnapshot,
        styleProfile,
      };

      const { set } = recommendOutfitsWithTelemetry(request);
      expect(set.outfits.length).toBeGreaterThan(0);

      const outfit = set.outfits[0];
      expect(outfit.explanation.confidenceScore).toBeDefined();
      expect(outfit.explanation.confidenceScore!).toBeGreaterThanOrEqual(0.7);
      expect(['HIGH', 'VERIFIED']).toContain(outfit.explanation.confidenceLevel);
      expect(outfit.explanation.garmentCoordination).toBeDefined();
      expect(Object.keys(outfit.explanation.garmentCoordination!).length).toBeGreaterThan(0);
    });

    it('identifies missing outfit requirements when wardrobe lacks essential pieces', () => {
      // Saree without blouse cannot form a valid saree ensemble
      const singleSaree = mockItem({
        id: 'saree-alone',
        name: 'Kanjeevaram Silk Saree',
        category: 'Ethnic',
        subcategory: 'saree',
        colors: ['red', 'gold'],
        formality: 5,
        occasions: ['wedding guest'],
      });

      const request: RecommendationRequest = {
        items: [singleSaree],
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-11-20',
        anchorItemId: 'saree-alone',
      };

      const { set } = recommendOutfitsWithTelemetry(request);
      expect(set.missingRequirements).toBeDefined();
      expect(set.missingRequirements!.length).toBeGreaterThan(0);
      const missingBlouse = set.missingRequirements!.find((m) => m.missingRole === 'top');
      expect(missingBlouse).toBeDefined();
      expect(missingBlouse!.explanation).toContain('blouse');
    });
  });
});
