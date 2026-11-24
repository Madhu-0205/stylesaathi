import { describe, it, expect } from 'vitest';
import {
  createInitialConversationState,
  processSaathiTurn,
} from '../engine/saathi/orchestrationEngine';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { SaathiToolContext } from '../engine/saathi/types';
import { WeatherSnapshot, WeatherForecast, PersonalStyleProfile, StylePreferences } from '../types';

describe('StyleSaathi Master Product Excellence — Conversational Intelligence & Trust', () => {
  const mockWeather: WeatherSnapshot = {
    temperature: 24,
    condition: 'clear',
    conditionText: 'Clear Evening',
    feelsLike: 24,
    humidity: 50,
    windSpeed: 10,
    precipitationProbability: 0,
    uvIndex: 1,
    observedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    source: 'live',
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
  };

  const mockForecast: WeatherForecast = {
    location: { city: 'Bengaluru', country: 'IN', source: 'manual', latitude: 12.97, longitude: 77.59 },
    generatedAt: Date.now(),
    periods: [
      {
        period: 'tomorrow',
        date: '2026-11-20',
        temperatureMin: 19,
        temperatureMax: 29,
        condition: 'partly_cloudy',
        precipitationProbability: 15,
        summary: 'Partly Sunny with light breeze',
      },
    ],
  };

  const mockStyleProfile: PersonalStyleProfile = {
    colorAffinities: { black: 0.9, blue: 0.85, white: 0.8 } as any,
    categoryWeights: { Tops: 1.0, Bottoms: 1.0, Ethnic: 1.0, Footwear: 1.0 } as any,
    formalityPreference: 3.5 as any,
    occasionAffinities: { party: { score: 0.8, confidence: 0.5 }, interview: { score: 0.9, confidence: 0.7 } } as any,
    combinationAffinities: {} as any,
    fabricAffinities: {} as any,
    patternAffinities: {} as any,
    silhouetteAffinities: {} as any,
    brandAffinities: {} as any,
  } as unknown as PersonalStyleProfile;

  const mockPreferences: StylePreferences = {
    preferredContexts: ['everyday', 'office', 'party', 'interview'],
    preferredAesthetics: ['minimalist', 'contemporary'],
    stylingMode: 'variety',
    updatedAt: Date.now(),
    preferredColors: ['black', 'blue'],
  };

  const baseContext: SaathiToolContext = {
    wardrobe: sampleWardrobe,
    weather: mockWeather,
    forecast: mockForecast,
    freshness: 'fresh',
    styleProfile: mockStyleProfile,
    preferences: mockPreferences,
    wearEvents: [],
    outfitPlans: [],
    referenceTimestamp: 1795171200000,
    localDate: '2026-11-19',
  };

  it('verifies context correction, 3-ways styling, relative weather, and continuity', async () => {
    let state = createInitialConversationState('master_excellence_conv');

    // 1. "I'm going to a party tonight. Do I need to buy anything?"
    const turn1 = await processSaathiTurn(
      "I'm going to a party tonight. Do I need to buy anything?",
      state,
      baseContext
    );
    expect(turn1.intent).toBe('ASSESS_PURCHASE_NEED');
    expect(turn1.message).toContain('No Purchase Needed');
    state = turn1.updatedState;

    // 2. "I want to wear my blue kurti to the party."
    const turn2 = await processSaathiTurn(
      "I want to wear my blue kurti to the party.",
      state,
      baseContext
    );
    expect(turn2.intent).toBe('STYLE_ITEM');
    expect(turn2.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turn2.updatedState.activeOccasion).toBe('party');
    state = turn2.updatedState;

    // 3. "Show another look."
    const turn3 = await processSaathiTurn(
      "Show another look.",
      state,
      baseContext
    );
    expect(turn3.intent).toBe('SHOW_ALTERNATIVE');
    expect(turn3.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    state = turn3.updatedState;

    // 4. "Different footwear, but keep everything else the same."
    const turn4 = await processSaathiTurn(
      "Different footwear, but keep everything else the same.",
      state,
      baseContext
    );
    expect(turn4.intent).toBe('SWAP_PIECE');
    expect(turn4.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    state = turn4.updatedState;

    // 5. "No, I meant for an interview." (Context correction)
    const turn5 = await processSaathiTurn(
      "No, I meant for an interview.",
      state,
      baseContext
    );
    expect(turn5.intent).toBe('INTERVIEW_OUTFIT');
    expect(turn5.updatedState.activeOccasion).toBe('interview');
    expect(turn5.message).toContain('Adjusting context to an interview');
    expect(turn5.domainResult?.outfits).toBeDefined();
    state = turn5.updatedState;

    // 6. "Show me three ways to style this garment." (Styles the anchored kurti 3 ways)
    const turn6 = await processSaathiTurn(
      "Show me three ways to style this garment.",
      state,
      baseContext
    );
    expect(turn6.intent).toBe('STYLE_3_WAYS');
    expect(turn6.message).toContain('3 Ways to Style Your');
    expect(turn6.message).toContain('Indigo kurti');
    state = turn6.updatedState;

    // 7. "What about tomorrow's weather?" (Relative date forecast with freshness disclosure)
    const turn7 = await processSaathiTurn(
      "What about tomorrow's weather?",
      state,
      baseContext
    );
    expect(turn7.intent).toBe('CHECK_WEATHER');
    expect(turn7.message).toContain("Tomorrow's forecast");
    expect(turn7.message).toContain('19°–29°C');
    expect(turn7.message).toContain('Verified Live Forecast');
    state = turn7.updatedState;

    // 8. "Can I wear the same kurti with something else?" (Preserves kurti anchor and provides alternative look)
    const turn8 = await processSaathiTurn(
      "Can I wear the same kurti with something else?",
      state,
      baseContext
    );
    expect(turn8.intent).toBe('SHOW_ALTERNATIVE');
    expect(turn8.updatedState.activeAnchorItem?.id).toBe('sample-blue-kurti');
    expect(turn8.domainResult?.outfits).toBeDefined();

    // 9. "Give me an Indo-Western fusion look"
    const turn9 = await processSaathiTurn(
      "Give me an Indo-Western fusion look",
      state,
      baseContext
    );
    expect(turn9.intent).toBe('INDO_WESTERN');
    expect(turn9.message).toContain('Indo-Western');
    expect(turn9.domainResult?.outfits).toBeDefined();

    // 10. "How do I style a saree?"
    const turn10 = await processSaathiTurn(
      "How do I style a saree?",
      state,
      baseContext
    );
    expect(turn10.intent).toBe('SAREE_STYLING');
    expect(turn10.message).toBeDefined();
  });
});
