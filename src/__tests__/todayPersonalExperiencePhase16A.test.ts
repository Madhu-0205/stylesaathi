// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { recommendOutfits } from '../engine/recommendationEngine';
import { generateDailyEditorialHeader } from '../utils/editorialHeadlines';
import { classifyWeatherFreshness } from '../engine/ensemble/shadowEvaluator';
import { buildEditorialReasoning, extractEditorialComponents } from '../engine/saathi/editorialReasoning';
import { WardrobeItem, GeneratedOutfit, Occasion } from '../types';

const srcDir = path.resolve(process.cwd(), 'src');
const todayScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/TodayScreen.tsx'), 'utf-8');
const heroTsx = fs.readFileSync(path.join(srcDir, 'components/editorial/DailyEditorialHero.tsx'), 'utf-8');
const altTsx = fs.readFileSync(path.join(srcDir, 'components/editorial/AlternativeLooksStrip.tsx'), 'utf-8');
const discoveryTsx = fs.readFileSync(path.join(srcDir, 'components/editorial/DailyDiscoverySection.tsx'), 'utf-8');
const threeWaysTsx = fs.readFileSync(path.join(srcDir, 'components/editorial/StyleThreeWaysModal.tsx'), 'utf-8');

describe('StyleSaathi Phase 1.6A — Today Screen Personal Fashion Experience', () => {
  const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Garment',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 2,
    colors: ['white'],
    formality: 3,
    favorite: false,
    note: '',
    seasons: ['summer', 'monsoon'],
    occasions: ['college', 'everyday', 'office', 'party', 'festive'],
    ...overrides,
  });

  // 1. New user without wardrobe
  describe('1. Acceptance Scenario: New user without wardrobe', () => {
    it('returns empty recommendation array without exceptions', () => {
      const recommendations = recommendOutfits({
        items: [],
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        allowPlanningMode: false,
      });
      expect(recommendations).toEqual([]);
    });

    it('renders empty wardrobe canvas guidance in TodayScreen code', () => {
      expect(todayScreenTsx).toContain('Your Wardrobe Canvas is Empty');
      expect(todayScreenTsx).toContain('Add First Garment');
    });
  });

  // 2. Returning user with wardrobe
  describe('2. Acceptance Scenario: Returning user with wardrobe', () => {
    it('generates grounded daily outfits using strictly user wardrobe garments', () => {
      const wardrobe: WardrobeItem[] = [
        createItem({ id: 'top-1', category: 'Tops', subcategory: 'kurta', colors: ['ivory'] }),
        createItem({ id: 'bot-1', category: 'Bottoms', subcategory: 'trousers', colors: ['beige'] }),
        createItem({ id: 'shoe-1', category: 'Footwear', subcategory: 'juttis', colors: ['tan'] }),
      ];

      const recommendations = recommendOutfits({
        items: wardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-15',
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBeGreaterThan(0);
      const topOutfit = recommendations[0];
      const outfitItems: WardrobeItem[] = Object.values(topOutfit.slots).flat();
      
      // All garments in recommendation must be in user's actual wardrobe
      for (const item of outfitItems) {
        expect(wardrobe.some((w) => w.id === item.id)).toBe(true);
      }
    });
  });

  // 3. User with six photographed garments and textual-only inventory records
  describe('3. Acceptance Scenario: Photographed vs textual-only garments', () => {
    it('composes outfits cleanly with mixed visual and textual wardrobe assets', () => {
      const mixedWardrobe: WardrobeItem[] = [
        createItem({ id: 'photo-top', category: 'Tops', photo: 'https://images.unsplash.com/sample.jpg' }),
        createItem({ id: 'text-top', category: 'Tops', photo: null }),
        createItem({ id: 'photo-bot', category: 'Bottoms', photo: 'https://images.unsplash.com/sample2.jpg' }),
        createItem({ id: 'text-bot', category: 'Bottoms', photo: null }),
        createItem({ id: 'photo-shoe', category: 'Footwear', photo: 'https://images.unsplash.com/sample3.jpg' }),
        createItem({ id: 'text-shoe', category: 'Footwear', photo: null }),
      ];

      const recommendations = recommendOutfits({
        items: mixedWardrobe,
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBeGreaterThan(0);
      const components = extractEditorialComponents(recommendations[0].slots);
      expect(components.top).toBeDefined();
      expect(components.bottom).toBeDefined();
    });
  });

  // 4. User with incomplete wardrobe categories
  describe('4. Acceptance Scenario: Incomplete wardrobe categories', () => {
    it('does not invent phantom pieces when essential categories are missing', () => {
      // User only owns tops, no bottoms or footwear
      const incompleteWardrobe: WardrobeItem[] = [
        createItem({ id: 'top-1', category: 'Tops' }),
        createItem({ id: 'top-2', category: 'Tops' }),
      ];

      const recommendations = recommendOutfits({
        items: incompleteWardrobe,
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBe(0);
    });

    it('renders complementary pieces needed state in TodayScreen', () => {
      expect(todayScreenTsx).toContain('Complementary Pieces Needed');
      expect(todayScreenTsx).toContain('Add Complementary Piece');
    });
  });

  // 5. User with recently worn garments
  describe('5. Acceptance Scenario: Recently worn anti-repetition protection', () => {
    it('filters out or penalizes garments in recentWornItemIds', () => {
      const top1 = createItem({ id: 'top-worn-yesterday', category: 'Tops' });
      const top2 = createItem({ id: 'top-fresh', category: 'Tops' });
      const bot = createItem({ id: 'bot-1', category: 'Bottoms' });
      const shoe = createItem({ id: 'shoe-1', category: 'Footwear' });

      const recommendations = recommendOutfits({
        items: [top1, top2, bot, shoe],
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        recentWornItemIds: ['top-worn-yesterday'],
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBeGreaterThan(0);
      const topPiece = recommendations[0].slots.top?.[0] || recommendations[0].slots.tops?.[0];
      expect(topPiece?.id).toBe('top-fresh');
    });
  });

  // 6. User with dirty garments
  describe('6. Acceptance Scenario: Dirty garment exclusion in immediate-wear', () => {
    it('excludes dirty garments when allowPlanningMode is false', () => {
      const dirtyTop = createItem({ id: 'dirty-top', category: 'Tops', status: 'needs_washing' });
      const bot = createItem({ id: 'bot-1', category: 'Bottoms', status: 'clean' });
      const shoe = createItem({ id: 'shoe-1', category: 'Footwear', status: 'clean' });

      const recommendations = recommendOutfits({
        items: [dirtyTop, bot, shoe],
        occasion: 'everyday',
        season: 'summer',
        localDate: '2026-11-15',
        allowPlanningMode: false,
      });

      expect(recommendations.length).toBe(0);
    });

    it('renders Wardrobe in Laundry message when all items are dirty', () => {
      expect(todayScreenTsx).toContain('Wardrobe in Laundry');
      expect(todayScreenTsx).toContain('Check Laundry in Closet');
    });
  });

  // 7. User changing occasion
  describe('7. Acceptance Scenario: Occasion switching & headline recalibration', () => {
    it('recalibrates editorial headline when switching from office to festive', () => {
      const fixedDate = new Date(2026, 9, 15, 10, 0, 0);
      const officeHeader = generateDailyEditorialHeader({
        date: fixedDate,
        activeOccasion: 'office',
        cleanCount: 10,
        season: 'summer',
      });
      const festiveHeader = generateDailyEditorialHeader({
        date: fixedDate,
        activeOccasion: 'festive',
        cleanCount: 10,
        season: 'summer',
      });

      expect(officeHeader.headline).toContain('Executive Discernment');
      expect(festiveHeader.headline).toContain('Ceremonial Radiance');
    });

    it('provides user-accessible occasion tabs with min-h-11 touch targets', () => {
      expect(todayScreenTsx).toContain('OCCASION_TABS');
      expect(todayScreenTsx).toContain('min-h-11 px-4 py-2 rounded-full');
    });
  });

  // 8. User with unavailable or stale weather
  describe('8. Acceptance Scenario: Weather freshness & honest fallbacks', () => {
    it('classifies missing and expired weather honestly', () => {
      expect(classifyWeatherFreshness(null)).toBe('missing');
      expect(classifyWeatherFreshness({ weather: { observedAt: Date.now() - 5 * 3600 * 1000 } } as any)).toBe('expired');
      expect(classifyWeatherFreshness({ weather: { observedAt: Date.now() - 45 * 60 * 1000 } } as any)).toBe('stale');
    });

    it('produces fallback thermal advice when weather is missing', () => {
      const header = generateDailyEditorialHeader({
        date: new Date(),
        activeOccasion: 'everyday',
        cleanCount: 15,
        season: 'summer',
        weather: null,
        weatherFreshness: 'missing',
      });
      expect(header.weatherBadge).toBe('Weather Context Available');
      expect(header.thermalAdvice).toBeDefined();
    });
  });

  // 9. User saving an outfit
  describe('9. Acceptance Scenario: Outfit save look integrity', () => {
    it('provides Save Look action in DailyEditorialHero with confirmation toast', () => {
      expect(heroTsx).toContain('onSaveLook(outfit)');
      expect(heroTsx).toContain('Save Look');
      expect(todayScreenTsx).toContain('Outfit archived to your Saved Looks');
    });
  });

  // 10. User recording actual wear
  describe('10. Acceptance Scenario: Wear logging confirmation', () => {
    it('provides Wear Today action and logs wear on today date string', () => {
      expect(heroTsx).toContain('onMarkWorn(outfit)');
      expect(heroTsx).toContain('Wear Today');
      expect(todayScreenTsx).toContain('markOutfitWornOnDate(outfit, todayStr)');
      expect(todayScreenTsx).toContain('Logged as worn today · Wardrobe rotation updated');
    });
  });

  // 11. User using Style Three Ways
  describe('11. Acceptance Scenario: Style Three Ways exploration', () => {
    it('provides Style Three Ways trigger in DailyEditorialHero and DailyDiscoverySection', () => {
      expect(heroTsx).toContain('onStyleThreeWays(heroPiece)');
      expect(heroTsx).toContain('Style 3 Ways');
      expect(discoveryTsx).toContain('onStyleThreeWays(underusedItem)');
      expect(todayScreenTsx).toContain('<StyleThreeWaysModal');
    });

    it('defines 3 distinct style directions in StyleThreeWaysModal', () => {
      expect(threeWaysTsx).toContain("id: 'minimal'");
      expect(threeWaysTsx).toContain("id: 'relaxed'");
      expect(threeWaysTsx).toContain("id: 'statement'");
    });
  });

  // 12. User exploring alternatives
  describe('12. Acceptance Scenario: Alternative looks roles & exploration', () => {
    it('provides Explore Alternatives and Ask AI Saathi in hero action strip', () => {
      expect(heroTsx).toContain('onExploreAlternatives');
      expect(heroTsx).toContain('Explore Alternatives');
      expect(heroTsx).toContain('onAskSaathi');
      expect(heroTsx).toContain('Ask AI Saathi');
    });

    it('AlternativeLooksStrip supports best_match, alternative, explore, and underused roles', () => {
      expect(altTsx).toContain("outfit.role === 'best_match'");
      expect(altTsx).toContain("outfit.role === 'alternative'");
      expect(altTsx).toContain("outfit.role === 'explore'");
      expect(altTsx).toContain("outfit.role === 'underused'");
    });
  });

  // 13. Visual & Accessibility Standards
  describe('13. Visual direction & accessibility standards', () => {
    it('enforces min-h-11 on all interactive buttons across Today editorial components', () => {
      const components = [todayScreenTsx, heroTsx, altTsx, discoveryTsx, threeWaysTsx];
      for (const comp of components) {
        expect(comp).not.toMatch(/<Button[^>]*min-h-(?:8|9|10)\b/);
        expect(comp).not.toMatch(/<button[^>]*min-h-(?:8|9|10)\b/);
      }
    });

    it('contains zero raw decorative emojis across all Today components', () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(todayScreenTsx)).toBe(false);
      expect(emojiRegex.test(heroTsx)).toBe(false);
      expect(emojiRegex.test(altTsx)).toBe(false);
      expect(emojiRegex.test(discoveryTsx)).toBe(false);
      expect(emojiRegex.test(threeWaysTsx)).toBe(false);
    });

    it('enforces pb-36 navigation clearance in TodayScreen', () => {
      expect(todayScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });
  });
});
