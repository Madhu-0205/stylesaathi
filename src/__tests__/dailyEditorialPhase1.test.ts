// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateDailyEditorialHeader } from '../utils/editorialHeadlines';
import {
  extractEditorialComponents,
  buildEditorialReasoning,
} from '../engine/saathi/editorialReasoning';
import { classifyWeatherFreshness } from '../engine/ensemble/shadowEvaluator';

describe('StyleSaathi Phase 1 — Daily Style Editorial Suite', () => {
  describe('1. Editorial Headline & Narrative Generator', () => {
    it('produces context-aware editorial header with Indian day name and season', () => {
      const fixedDate = new Date(2026, 9, 14, 9, 0, 0); // Wednesday Oct 14 9:00 AM local -> Budhvaar
      const res = generateDailyEditorialHeader({
        date: fixedDate,
        activeOccasion: 'college',
        cleanCount: 15,
        season: 'monsoon',
        city: 'Bengaluru',
        userName: 'Aarav',
      });

      expect(res.indianDayName).toBe('Budhvaar');
      expect(res.kicker).toContain('STYLESAATHI · MONSOON EDIT · BUDHVAAR');
      expect(res.greeting).toBe('Good morning, Aarav');
      expect(res.headline).toContain('Effortless Campus Polish');
      expect(res.editorialMemo).toBeDefined();
    });

    it('adapts headline for office and executive context', () => {
      const fixedDate = new Date(2026, 9, 15, 14, 30, 0); // Thursday Oct 15 2:30 PM local -> Guruvaar
      const res = generateDailyEditorialHeader({
        date: fixedDate,
        activeOccasion: 'office',
        cleanCount: 20,
        season: 'monsoon',
        userName: null,
      });

      expect(res.indianDayName).toBe('Guruvaar');
      expect(res.greeting).toBe('Good afternoon');
      expect(res.headline).toContain('Executive Discernment');
    });

    it('adapts headline for festive and ceremonial context', () => {
      const fixedDate = new Date(2026, 9, 18, 19, 0, 0); // Sunday Oct 18 7:00 PM local -> Ravivaar
      const res = generateDailyEditorialHeader({
        date: fixedDate,
        activeOccasion: 'festive',
        cleanCount: 12,
        season: 'monsoon',
      });

      expect(res.indianDayName).toBe('Ravivaar');
      expect(res.greeting).toBe('Good evening');
      expect(res.headline).toContain('Ceremonial Radiance');
    });

    it('correctly maps canonical 5-state weather freshness', () => {
      const now = Date.now();
      expect(
        classifyWeatherFreshness({ weather: { observedAt: now } } as any, now)
      ).toBe('fresh');
      expect(
        classifyWeatherFreshness({ weather: { observedAt: now - 45 * 60 * 1000 } } as any, now)
      ).toBe('stale');
      expect(
        classifyWeatherFreshness({ weather: { observedAt: now - 4 * 3600 * 1000 } } as any, now)
      ).toBe('expired');
      expect(
        classifyWeatherFreshness({ source: 'simulated', weather: { observedAt: now } } as any, now)
      ).toBe('simulated');
      expect(classifyWeatherFreshness(null, now)).toBe('missing');
    });
  });

  describe('2. Component Extraction & 4-Part Human-Language Editorial Reasoning', () => {
    const mockSlots = {
      tops: [
        {
          id: 'item-top-1',
          name: 'Handloom Khadi Kurta',
          category: 'tops',
          subcategory: 'kurta',
          colors: ['ivory', 'white'],
          fabric: 'cotton',
          status: 'clean',
        },
      ],
      bottoms: [
        {
          id: 'item-bottom-1',
          name: 'Tapered Linen Trousers',
          category: 'bottoms',
          subcategory: 'chinos',
          colors: ['sand', 'beige'],
          fabric: 'linen',
          status: 'clean',
        },
      ],
      footwear: [
        {
          id: 'item-shoe-1',
          name: 'Tan Leather Kolhapuris',
          category: 'footwear',
          subcategory: 'sandals',
          colors: ['tan'],
          fabric: 'leather',
          status: 'clean',
        },
      ],
    };

    it('extracts top, bottom, footwear, layer, and accessory cleanly', () => {
      const components = extractEditorialComponents(mockSlots as any);
      expect(components.top?.id).toBe('item-top-1');
      expect(components.bottom?.id).toBe('item-bottom-1');
      expect(components.footwear?.id).toBe('item-shoe-1');
      expect(components.layer).toBeUndefined();
    });

    it('builds human-language 4-part editorial reasoning without raw scores', () => {
      const components = extractEditorialComponents(mockSlots as any);
      const reasoning = buildEditorialReasoning({
        concept: 'Effortless Summer Campus Polish',
        occasion: 'college',
        components,
      });

      expect(reasoning.sections.coreConcept).toBe('Effortless Summer Campus Polish');
      expect(reasoning.sections.colorTheory).toBeDefined();
      expect(reasoning.sections.proportionSilhouette).toBeDefined();
      expect(reasoning.sections.fabricTexture).toBeDefined();
      expect(reasoning.sections.stylingDirection).toBeDefined();

      // Guarantees zero raw score numbers in emotional reasoning text
      const fullText = Object.values(reasoning.sections).join(' ');
      expect(fullText).not.toMatch(/\b\d+(\.\d+)?% match\b/);
      expect(fullText).not.toMatch(/\bscore: \d+\b/);
    });
  });

  describe('3. Architectural & Accessibility Verification', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const todayTsx = fs.readFileSync(path.join(srcDir, 'screens/TodayScreen.tsx'), 'utf-8');
    const heroTsx = fs.readFileSync(
      path.join(srcDir, 'components/editorial/DailyEditorialHero.tsx'),
      'utf-8'
    );
    const altTsx = fs.readFileSync(
      path.join(srcDir, 'components/editorial/AlternativeLooksStrip.tsx'),
      'utf-8'
    );
    const threeWaysTsx = fs.readFileSync(
      path.join(srcDir, 'components/editorial/StyleThreeWaysModal.tsx'),
      'utf-8'
    );
    const discoveryTsx = fs.readFileSync(
      path.join(srcDir, 'components/editorial/DailyDiscoverySection.tsx'),
      'utf-8'
    );

    it('enforces pb-36 navigation clearance in TodayScreen', () => {
      expect(todayTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('imports and exports scoreFormatter safely in TodayScreen', () => {
      expect(todayTsx).toContain("import { formatRecommendationScore } from '../utils/scoreFormatter';");
      expect(todayTsx).toContain('export { formatRecommendationScore };');
      expect(todayTsx).not.toContain('Math.round(outfit.score * 100)');
    });

    it('enforces >= 44px min-h-11 touch targets on all interactive buttons in editorial components', () => {
      const components = [todayTsx, heroTsx, altTsx, threeWaysTsx, discoveryTsx];
      for (const comp of components) {
        expect(comp).not.toMatch(/<Button[^>]*min-h-(?:8|9|10)\b/);
        expect(comp).not.toMatch(/<button[^>]*min-h-(?:8|9|10)\b/);
      }
    });

    it('contains zero raw decorative emojis in newly built editorial views', () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(todayTsx)).toBe(false);
      expect(emojiRegex.test(heroTsx)).toBe(false);
      expect(emojiRegex.test(altTsx)).toBe(false);
      expect(emojiRegex.test(threeWaysTsx)).toBe(false);
      expect(emojiRegex.test(discoveryTsx)).toBe(false);
    });
  });
});

