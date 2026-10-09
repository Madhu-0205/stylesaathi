import { describe, it, expect } from 'vitest';
import { calculateWeatherComfortScore, getContextWhyReasons } from '../contextScoring';
import { createContextSnapshot } from '../contextEngine';
import { WardrobeItem, ContextSnapshot } from '../../types';

describe('Phase 4: Context Scoring & Weather Comfort Integration', () => {
  const cottonTee: WardrobeItem = {
    id: 'tee-01',
    name: 'White Supima Cotton T-Shirt',
    category: 'Tops',
    subcategory: 't-shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['college', 'everyday'],
    formality: 1.8,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'cotton',
    fit: 'regular',
  };

  const linenKurti: WardrobeItem = {
    id: 'kurti-01',
    name: 'Breezy Linen Kurti',
    category: 'Ethnic',
    subcategory: 'kurti',
    colors: ['beige'],
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'casual outing'],
    formality: 2.2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'linen',
    fit: 'relaxed',
  };

  const woolSweater: WardrobeItem = {
    id: 'sweater-01',
    name: 'Merino Wool Cable Knit Sweater',
    category: 'Outerwear',
    subcategory: 'sweater',
    colors: ['navy'],
    seasons: ['winter'],
    occasions: ['college', 'casual outing'],
    formality: 2.5,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'wool',
    fit: 'regular',
  };

  const velvetBlazer: WardrobeItem = {
    id: 'blazer-01',
    name: 'Heavy Velvet Evening Blazer',
    category: 'Outerwear',
    subcategory: 'blazer',
    colors: ['black'],
    seasons: ['winter'],
    occasions: ['party', 'office'],
    formality: 4.2,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'velvet',
    fit: 'tailored',
  };

  const banarasiSilkSaree: WardrobeItem = {
    id: 'saree-01',
    name: 'Banarasi Katan Silk Saree',
    category: 'Ethnic',
    subcategory: 'saree',
    colors: ['red', 'gold'],
    seasons: ['winter'],
    occasions: ['wedding guest', 'festive'],
    formality: 4.8,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    fabric: 'banarasi',
    fit: 'regular',
  };

  const leatherJuttis: WardrobeItem = {
    id: 'shoes-01',
    name: 'Embroidered Raw Leather Juttis',
    category: 'Footwear',
    subcategory: 'juttis',
    colors: ['gold'],
    seasons: ['summer'],
    occasions: ['festive', 'wedding guest'],
    formality: 4.0,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  const rubberSandals: WardrobeItem = {
    id: 'shoes-02',
    name: 'Waterproof Strap Sandals',
    category: 'Footwear',
    subcategory: 'sandals',
    colors: ['black'],
    seasons: ['monsoon', 'summer'],
    occasions: ['college', 'everyday'],
    formality: 1.5,
    status: 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
  };

  describe('1. Thermal & Breathability Comfort in High Heat', () => {
    const hotContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
      weather: {
        temperature: 36,
        feelsLike: 39,
        humidity: 60,
        precipitationProbability: 0,
        windSpeed: 10,
        condition: 'hot',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'open_meteo',
        location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
      },
      freshness: 'fresh',
      occasion: 'college',
    });

    it('awards positive comfort score for breathable cotton and linen in heat', () => {
      const result = calculateWeatherComfortScore([linenKurti, cottonTee], hotContext);
      expect(result.scoreDelta).toBeGreaterThan(1.0);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons[0]).toContain('breathable');
    });

    it('penalizes heavy wool and velvet outerwear in hot weather', () => {
      const result = calculateWeatherComfortScore([woolSweater, velvetBlazer], hotContext);
      expect(result.scoreDelta).toBeLessThan(-2.0);
      expect(result.warnings.some((w) => w.includes('traps heat'))).toBe(true);
    });
  });

  describe('2. Humid Heat Penalty Amplification', () => {
    it('applies stronger discomfort penalty to low-breathability fabrics when humidity is >= 65%', () => {
      const dryHotContext = createContextSnapshot({
        location: { city: 'Jaipur', country: 'India', source: 'manual' },
        weather: {
          temperature: 34,
          feelsLike: 35,
          humidity: 30, // dry heat
          precipitationProbability: 0,
          windSpeed: 10,
          condition: 'hot',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'test',
          location: { city: 'Jaipur', country: 'India', source: 'manual' },
        },
        occasion: 'college',
      });

      const humidHotContext = createContextSnapshot({
        location: { city: 'Kolkata', country: 'India', source: 'manual' },
        weather: {
          temperature: 34,
          feelsLike: 42,
          humidity: 85, // coastal humid heat
          precipitationProbability: 10,
          windSpeed: 10,
          condition: 'hot',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'test',
          location: { city: 'Kolkata', country: 'India', source: 'manual' },
        },
        occasion: 'college',
      });

      const dryScore = calculateWeatherComfortScore([woolSweater], dryHotContext).scoreDelta;
      const humidScore = calculateWeatherComfortScore([woolSweater], humidHotContext).scoreDelta;

      expect(humidScore).toBeLessThan(dryScore); // humid heat penalty is significantly harsher
    });
  });

  describe('3. Rain & Monsoon Practicality', () => {
    const monsoonContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Mumbai', country: 'India', source: 'manual' },
      weather: {
        temperature: 28,
        feelsLike: 31,
        humidity: 88,
        precipitationProbability: 85,
        windSpeed: 20,
        condition: 'rain',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'test',
        location: { city: 'Mumbai', country: 'India', source: 'manual' },
      },
      occasion: 'casual outing',
    });

    it('penalizes delicate silks and traditional leather juttis during active rain', () => {
      const result = calculateWeatherComfortScore([banarasiSilkSaree, leatherJuttis], monsoonContext);
      expect(result.scoreDelta).toBeLessThan(-2.0);
      expect(result.warnings.some((w) => w.includes('water spotting') || w.includes('leather footwear'))).toBe(true);
    });

    it('favors water-tolerant sandals in monsoon rain', () => {
      const result = calculateWeatherComfortScore([cottonTee, rubberSandals], monsoonContext);
      expect(result.scoreDelta).toBeGreaterThanOrEqual(0.5);
      expect(result.reasons.some((r) => r.includes('Rain-tolerant footwear'))).toBe(true);
    });
  });

  describe('4. Cold Weather Insulation', () => {
    const coldContext: ContextSnapshot = createContextSnapshot({
      location: { city: 'Srinagar', country: 'India', source: 'manual' },
      weather: {
        temperature: 9,
        feelsLike: 7,
        humidity: 55,
        precipitationProbability: 0,
        windSpeed: 10,
        condition: 'cold',
        observedAt: Date.now(),
        expiresAt: Date.now() + 30000,
        source: 'test',
        location: { city: 'Srinagar', country: 'India', source: 'manual' },
      },
      occasion: 'college',
    });

    it('awards positive score to wool sweaters and outerwear in cold weather', () => {
      const result = calculateWeatherComfortScore([woolSweater], coldContext);
      expect(result.scoreDelta).toBeGreaterThan(1.5);
      expect(result.reasons.some((r) => r.includes('insulating fabrics'))).toBe(true);
    });
  });

  describe('5. Formality Protection in Hot Weather', () => {
    it('softens heat penalty for an interview so formal attire remains recommendable', () => {
      const interviewContext: ContextSnapshot = createContextSnapshot({
        location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
        weather: {
          temperature: 35,
          feelsLike: 37,
          humidity: 50,
          precipitationProbability: 0,
          windSpeed: 10,
          condition: 'hot',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'test',
          location: { city: 'Delhi NCR', country: 'India', source: 'manual' },
        },
        occasion: 'interview',
      });

      const casualContext: ContextSnapshot = {
        ...interviewContext,
        occasion: 'college',
      };

      const interviewResult = calculateWeatherComfortScore([velvetBlazer], interviewContext);
      const casualResult = calculateWeatherComfortScore([velvetBlazer], casualContext);

      // Interview decorum softens the blazer penalty so user isn't told to wear shorts to an interview
      expect(interviewResult.scoreDelta).toBeGreaterThan(casualResult.scoreDelta);
    });
  });

  describe('6. Evidence-Based Explanations', () => {
    it('generates real climate reasons only when weather data is present', () => {
      const hotContext: ContextSnapshot = createContextSnapshot({
        location: { city: 'Chennai', country: 'India', source: 'manual' },
        weather: {
          temperature: 34,
          feelsLike: 38,
          humidity: 75,
          precipitationProbability: 0,
          windSpeed: 12,
          condition: 'hot',
          observedAt: Date.now(),
          expiresAt: Date.now() + 30000,
          source: 'open_meteo',
          location: { city: 'Chennai', country: 'India', source: 'manual' },
        },
        occasion: 'casual outing',
      });

      const reasons = getContextWhyReasons([linenKurti], hotContext);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toContain('34°C');

      // When context has no weather, no fabricated weather reasons are generated
      const emptyContext: ContextSnapshot = createContextSnapshot({
        location: { city: 'Chennai', country: 'India', source: 'manual' },
        weather: null,
        occasion: 'casual outing',
      });
      const noReasons = getContextWhyReasons([linenKurti], emptyContext);
      expect(noReasons).toEqual([]);
    });
  });
});
