// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const todayScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/TodayScreen.tsx'), 'utf-8');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const dressMeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/DressMeScreen.tsx'), 'utf-8');
const calendarScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/CalendarScreen.tsx'), 'utf-8');
const gapsScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/GapsScreen.tsx'), 'utf-8');
const profileScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/ProfileScreen.tsx'), 'utf-8');

describe('StyleSaathi 3.1.2 — Visual QA Remediation Regression Suite', () => {
  describe('1. P0 — Floating AI Capsule Collision Remediation', () => {
    it('moves aside[aria-label="AI Companions"] to the accessible mobile header without bottom fixed collision', () => {
      // Must not have fixed right-3.5 or fixed bottom hovering over content
      expect(appTsx).not.toContain('safe-floating-ai fixed right-3.5');

      // The AI companion region is safely integrated into the mobile header
      expect(appTsx).toMatch(/<header className="md:hidden[\s\S]*?<StyleSaathiLogo/);
      expect(appTsx).toContain('aria-label="AI Companions"');
      expect(appTsx).toContain('safe-floating-ai flex items-center rounded-full glass-pill');
    });

    it('preserves full touch targets and functional event triggers for AI Saathi and Ask AI', () => {
      expect(appTsx).toContain('aria-label="Open AI Saathi conversation"');
      expect(appTsx).toContain('aria-label="Open Ask AI command palette (Command + K)"');
      expect(appTsx).toContain('min-h-11');
      expect(appTsx).toContain('open-needle-command');
    });
  });

  describe('2. P1 — Bottom Navigation Content Clearance Geometry', () => {
    it('applies pb-36 (144px clearance) to TodayScreen container', () => {
      expect(todayScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('applies pb-36 (144px clearance) to WardrobeScreen container', () => {
      expect(wardrobeScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('applies pb-36 (144px clearance) to DressMeScreen container', () => {
      expect(dressMeScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('applies pb-36 (144px clearance) to CalendarScreen container', () => {
      expect(calendarScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('applies pb-36 (144px clearance) to Insights (GapsScreen) container', () => {
      expect(gapsScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('applies pb-36 (144px clearance) to ProfileScreen container', () => {
      expect(profileScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });
  });

  describe('3. P1 — Recommendation Score Formatting in TodayScreen', () => {
    it('imports and applies formatRecommendationScore in TodayScreen', () => {
      expect(todayScreenTsx).toContain("import { formatRecommendationScore } from '../utils/scoreFormatter';");
      expect(todayScreenTsx).toContain('const scorePercent = formatRecommendationScore(outfit.score);');
      // Verifies no raw 100 multiplication bug exists
      expect(todayScreenTsx).not.toContain('Math.round(outfit.score * 100)');
    });
  });

  describe('4. P2 — Desktop AI Redundancy Elimination', () => {
    it('ensures mobile companion header is hidden on desktop (md:hidden)', () => {
      expect(appTsx).toMatch(/<header className="md:hidden[^"]*">/);
    });

    it('verifies desktop relies on TopNav for AI Saathi and Ask Stylist without redundant floating buttons', () => {
      const topNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/TopNav.tsx'), 'utf-8');
      expect(topNavTsx).toContain('AI Saathi');
      expect(topNavTsx).toContain('Ask Stylist…');
      expect(appTsx).not.toMatch(/md:right-6[^"]*safe-floating-ai/);
    });
  });
});
