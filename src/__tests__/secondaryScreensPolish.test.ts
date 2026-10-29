import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const calendarScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/CalendarScreen.tsx'), 'utf-8');
const gapsScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/GapsScreen.tsx'), 'utf-8');
const profileScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/ProfileScreen.tsx'), 'utf-8');
const onboardingScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/OnboardingScreen.tsx'), 'utf-8');
const trendDiscoveryScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/TrendDiscoveryScreen.tsx'), 'utf-8');
const wearAnalyticsViewTsx = fs.readFileSync(path.join(srcDir, 'components/analytics/WearAnalyticsView.tsx'), 'utf-8');
const smartBuyReportViewTsx = fs.readFileSync(path.join(srcDir, 'components/gaps/SmartBuyReportView.tsx'), 'utf-8');

describe('StyleSaathi Phase E — Secondary Screens & Global Polish Verification', () => {
  describe('1. CalendarScreen Polish & Tactile Interactions', () => {
    it('applies editorial typographic styling', () => {
      expect(calendarScreenTsx).toContain('editorial-kicker');
      expect(calendarScreenTsx).toContain('editorial-title');
      expect(calendarScreenTsx).toContain('editorial-sub');
      expect(calendarScreenTsx).toContain('editorial-headline');
    });

    it('uses Apple-grade Liquid Glass capsules and cards', () => {
      expect(calendarScreenTsx).toContain('glass-pill');
      expect(calendarScreenTsx).toContain('glass-card');
      expect(calendarScreenTsx).toContain('specular-border');
    });

    it('ensures minimum 44px touch targets on navigation and actions', () => {
      expect(calendarScreenTsx).toContain('min-h-11');
      expect(calendarScreenTsx).toContain('min-w-11');
      expect(calendarScreenTsx).toContain('tactile-press');
    });
  });

  describe('2. GapsScreen & Insight Sub-views Polish', () => {
    it('elevates segmented sub-navigation to Liquid Glass pill styling', () => {
      expect(gapsScreenTsx).toContain('glass-pill');
      expect(gapsScreenTsx).toContain('specular-border');
      expect(gapsScreenTsx).toContain('tactile-press-sm');
    });

    it('preserves all responsive layout contracts for insight screens', () => {
      expect(gapsScreenTsx).toContain('md:grid-cols-12');
      expect(gapsScreenTsx).toContain('md:col-span-5');
      expect(gapsScreenTsx).toContain('md:col-span-7');
      expect(gapsScreenTsx).toContain('THE ONE TO ADD');
      expect(gapsScreenTsx).toContain('md:hidden');
      expect(gapsScreenTsx).toContain('hidden md:block');
    });

    it('elevates SmartBuyReportView and WearAnalyticsView with editorial hierarchy', () => {
      expect(smartBuyReportViewTsx).toContain('editorial-kicker');
      expect(smartBuyReportViewTsx).toContain('editorial-title');
      expect(smartBuyReportViewTsx).toContain('glass-card');
      expect(wearAnalyticsViewTsx).toContain('editorial-kicker');
      expect(wearAnalyticsViewTsx).toContain('editorial-title');
      expect(wearAnalyticsViewTsx).toContain('glass-pill');
    });

    it('elevates TrendDiscoveryScreen with Liquid Glass filter pill and tactile triggers', () => {
      expect(trendDiscoveryScreenTsx).toContain('glass-pill');
      expect(trendDiscoveryScreenTsx).toContain('specular-border');
      expect(trendDiscoveryScreenTsx).toContain('tactile-press-sm');
      expect(trendDiscoveryScreenTsx).toContain('editorial-title');
    });
  });

  describe('3. ProfileScreen Style Archive & DNA Polish', () => {
    it('elevates profile banner, style DNA, appearance, and archive with glass-card', () => {
      expect(profileScreenTsx).toContain('glass-card');
      expect(profileScreenTsx).toContain('specular-border');
      expect(profileScreenTsx).toContain('rounded-3xl');
    });

    it('preserves key section markers and responsive grid layout', () => {
      expect(profileScreenTsx).toContain('md:grid-cols-2');
      expect(profileScreenTsx).toContain('STYLE PREFERENCES');
      expect(profileScreenTsx).toContain('APPEARANCE');
      expect(profileScreenTsx).toContain('WARDROBE DATA');
      expect(profileScreenTsx).toContain('Local Wardrobe Privacy');
      expect(profileScreenTsx).toContain('md:hidden flex h-9 w-9');
    });

    it('incorporates tactile feedback on interactive buttons and chips', () => {
      expect(profileScreenTsx).toContain('tactile-press');
      expect(profileScreenTsx).toContain('min-h-11');
      expect(profileScreenTsx).toContain('min-h-12');
    });
  });

  describe('4. OnboardingScreen Editorial Elevation', () => {
    it('applies glass-card and specular-border to onboarding slide container', () => {
      expect(onboardingScreenTsx).toContain('glass-card');
      expect(onboardingScreenTsx).toContain('specular-border');
      expect(onboardingScreenTsx).toContain('rounded-3xl');
    });

    it('preserves centered responsive boundary and official brand presentation', () => {
      expect(onboardingScreenTsx).toContain('max-w-lg md:max-w-xl mx-auto');
      expect(onboardingScreenTsx).toContain('StyleSaathiLogo');
      expect(onboardingScreenTsx).toContain('showSince={true}');
      expect(onboardingScreenTsx).not.toContain('mobile-shell');
    });

    it('ensures aesthetic vibe chips satisfy minimum 44px touch targets', () => {
      expect(onboardingScreenTsx).toContain('min-h-11');
      expect(onboardingScreenTsx).toContain('tactile-press-sm');
      expect(onboardingScreenTsx).toContain('min-h-12');
    });
  });
});

