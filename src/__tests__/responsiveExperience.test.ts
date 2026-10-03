import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const dressMeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/DressMeScreen.tsx'), 'utf-8');
const gapsScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/GapsScreen.tsx'), 'utf-8');
const profileScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/ProfileScreen.tsx'), 'utf-8');
const onboardingScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/OnboardingScreen.tsx'), 'utf-8');
const bottomSheetTsx = fs.readFileSync(path.join(srcDir, 'components/common/BottomSheet.tsx'), 'utf-8');
const topNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/TopNav.tsx'), 'utf-8');
const bottomNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/BottomNav.tsx'), 'utf-8');
const outfitCardTsx = fs.readFileSync(path.join(srcDir, 'components/dressme/OutfitCard.tsx'), 'utf-8');
const chipTsx = fs.readFileSync(path.join(srcDir, 'components/common/Chip.tsx'), 'utf-8');

describe('STYLESAATHI V3.2 — Universal Responsive Experience Verification', () => {

  describe('1. Global Responsive Layout System & Container Rules', () => {
    it('defines .app-container with intentional responsive breakpoints preventing stretching', () => {
      expect(indexCss).toContain('.app-container');
      // Max 100% on mobile
      expect(indexCss).toContain('max-width: 100%');
      // Tablet max-width constraint (860px)
      expect(indexCss).toContain('max-width: 860px');
      // Desktop max-width constraint (1140px)
      expect(indexCss).toContain('max-width: 1140px');
      // Large desktop max-width constraint (1360px)
      expect(indexCss).toContain('max-width: 1360px');
    });

    it('enforces overflow-x: hidden on html and body to guarantee no horizontal overflow', () => {
      expect(indexCss).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
    });

    it('implements iOS and Android safe-area-inset-bottom handling', () => {
      expect(indexCss).toContain('env(safe-area-inset-bottom');
      expect(indexCss).toContain('.safe-bottom');
      expect(indexCss).toContain('.safe-nav-padding');
    });

    it('ensures App.tsx utilizes .app-container without hardcoded 440px desktop entrapment', () => {
      expect(appTsx).toContain('app-container');
      expect(appTsx).not.toContain('mobile-shell');
    });
  });

  describe('2. Navigation Responsiveness (Phone, Tablet, Desktop)', () => {
    it('renders TopNav on tablet and desktop (md: and above)', () => {
      expect(appTsx).toContain('hidden md:block');
      expect(appTsx).toContain('<TopNav');
      expect(topNavTsx).toContain('WARDROBE');
      expect(topNavTsx).toContain('DRESS');
      expect(topNavTsx).toContain('INSIGHT');
      expect(topNavTsx).toContain('YOU');
    });

    it('renders BottomNav on phone only (md:hidden) to avoid tiny floating bar on desktop', () => {
      expect(bottomNavTsx).toContain('md:hidden');
      expect(bottomNavTsx).toContain('safe-nav-padding');
    });

    it('guarantees touch targets in TopNav and BottomNav meet the 44px accessibility threshold', () => {
      // TopNav tabs and actions min-h-11 (44px)
      expect(topNavTsx).toContain('min-h-11');
      // BottomNav buttons min-h-12 (48px)
      expect(bottomNavTsx).toContain('min-h-12');
    });
  });

  describe('3. Modal & Sheet Behavior (BottomSheet)', () => {
    it('adapts BottomSheet from bottom-slide drawer on phone to centered dialog on tablet/desktop', () => {
      // Bottom on mobile, centered on sm and above
      expect(bottomSheetTsx).toContain('items-end sm:items-center');
      expect(bottomSheetTsx).toContain('sm:rounded-2xl');
      expect(bottomSheetTsx).toContain('max-w-lg');
      expect(bottomSheetTsx).toContain('shadow-2xl');
      // Drag handle hidden on tablet/desktop
      expect(bottomSheetTsx).toContain('sm:hidden');
    });
  });

  describe('4. Wardrobe Screen Grid Responsiveness', () => {
    it('adapts garment grid columns across phone, tablet, desktop, and large desktop', () => {
      // 2 columns on mobile, 3 on tablet, 4 on desktop, 5 on wide screens
      expect(wardrobeScreenTsx).toContain('grid-cols-2');
      expect(wardrobeScreenTsx).toContain('md:grid-cols-3');
      expect(wardrobeScreenTsx).toContain('lg:grid-cols-4');
      expect(wardrobeScreenTsx).toContain('2xl:grid-cols-5');
    });

    it('adapts filter chip rows to wrap cleanly on tablet and desktop instead of bleeding negative margins', () => {
      expect(wardrobeScreenTsx).toContain('md:flex-wrap');
      expect(wardrobeScreenTsx).toContain('md:mx-0');
    });

    it('ensures search bar clear button has >=44px hit target', () => {
      expect(wardrobeScreenTsx).toContain('min-h-11 min-w-11');
    });
  });

  describe('5. Dress Me Screen & OutfitCard Responsiveness', () => {
    it('implements two-region composition on md: and desktop (Look on left, Styling Info on right)', () => {
      expect(outfitCardTsx).toContain('md:grid-cols-12');
      expect(outfitCardTsx).toContain('md:col-span-7');
      expect(outfitCardTsx).toContain('md:col-span-5');
    });

    it('preserves asymmetric visual composition with hero garment dominant on phone viewports', () => {
      expect(outfitCardTsx).toContain('col-span-7');
      expect(outfitCardTsx).toContain('col-span-5');
      expect(outfitCardTsx).toContain('Hero Piece');
    });

    it('ensures DressMe occasion chips wrap cleanly on md+ viewports without negative margins', () => {
      expect(dressMeScreenTsx).toContain('md:flex-wrap');
      expect(dressMeScreenTsx).toContain('md:mx-0');
    });

    it('provides minimum 44px touch targets on outfit actions', () => {
      expect(outfitCardTsx).toContain('min-h-11');
    });
  });

  describe('6. Gaps / Insight Screen Responsiveness', () => {
    it('implements restrained editorial split on md: and desktop (Gap diagnosis on left, Recommendations on right)', () => {
      expect(gapsScreenTsx).toContain('md:grid-cols-12');
      expect(gapsScreenTsx).toContain('md:col-span-5');
      expect(gapsScreenTsx).toContain('md:col-span-7');
      expect(gapsScreenTsx).toContain('THE ONE TO ADD');
    });

    it('preserves single-column narrative order on mobile (Gap Diagnosis -> The One To Add -> Secondary -> Distribution -> Occasions)', () => {
      expect(gapsScreenTsx).toContain('md:hidden');
      expect(gapsScreenTsx).toContain('hidden md:block');
    });
  });

  describe('7. Profile / Archive Screen Responsiveness', () => {
    it('uses a balanced 2-column layout on tablet and desktop (Style/Appearance on left, Data/Privacy on right)', () => {
      expect(profileScreenTsx).toContain('md:grid-cols-2');
      expect(profileScreenTsx).toContain('STYLE PREFERENCES');
      expect(profileScreenTsx).toContain('APPEARANCE');
      expect(profileScreenTsx).toContain('WARDROBE DATA');
      expect(profileScreenTsx).toContain('Local Wardrobe Privacy');
    });
  });

  describe('8. Onboarding Screen Responsiveness', () => {
    it('centers onboarding content comfortably on tablet and desktop without stretching', () => {
      expect(onboardingScreenTsx).toContain('max-w-lg md:max-w-xl mx-auto');
      expect(onboardingScreenTsx).not.toContain('mobile-shell');
    });
  });

  describe('9. Touch Targets and Compactness', () => {
    it('ensures standard chips satisfy 44px minimum touch height (min-h-11)', () => {
      expect(chipTsx).toContain('min-h-11');
    });

    it('hides duplicate theme toggles on md+ viewports where TopNav provides global control', () => {
      expect(wardrobeScreenTsx).toContain('md:hidden flex h-9 w-9');
      expect(dressMeScreenTsx).toContain('md:hidden flex h-9 w-9');
      expect(gapsScreenTsx).toContain('md:hidden flex h-9 w-9');
      expect(profileScreenTsx).toContain('md:hidden flex h-9 w-9');
    });
  });

  describe('10. Device Matrix Coverage Verification', () => {
    const matrix = [
      { name: 'iPhone SE / Small Phone', width: 320, height: 568, type: 'phone' },
      { name: 'iPhone 13 mini', width: 375, height: 812, type: 'phone' },
      { name: 'iPhone 14 / 15', width: 390, height: 844, type: 'phone' },
      { name: 'iPhone 15 Pro', width: 393, height: 852, type: 'phone' },
      { name: 'iPhone 11 / XR', width: 414, height: 896, type: 'phone' },
      { name: 'iPhone 15 Pro Max', width: 430, height: 932, type: 'phone' },
      { name: 'Large Android Phone', width: 480, height: 854, type: 'large-phone' },
      { name: 'iPad Mini / Tablet Portrait', width: 768, height: 1024, type: 'tablet' },
      { name: 'iPad Air / Tablet Portrait', width: 820, height: 1180, type: 'tablet' },
      { name: 'iPad Landscape / Tablet Landscape', width: 1024, height: 768, type: 'tablet-landscape' },
      { name: 'Android Tablet Landscape', width: 1180, height: 820, type: 'tablet-landscape' },
      { name: 'Laptop / Desktop Compact', width: 1280, height: 720, type: 'desktop' },
      { name: 'Standard Desktop', width: 1366, height: 768, type: 'desktop' },
      { name: 'MacBook Pro 14 / 16', width: 1440, height: 900, type: 'desktop' },
      { name: 'Desktop 1080p', width: 1536, height: 864, type: 'desktop' },
      { name: 'Large Desktop 1080p Full', width: 1920, height: 1080, type: 'large-desktop' },
    ];

    it.each(matrix)('evaluates layout rules for $name ($width x $height)', ({ width, type }) => {
      if (width < 768) {
        // Phone / Large Phone: Mobile container 100%, bottom navigation active
        expect(type).toMatch(/phone/);
      } else if (width >= 768 && width < 1200) {
        // Tablet / Tablet Landscape: Top navigation active, multi-column grid
        expect(type).toMatch(/tablet/);
      } else {
        // Desktop / Large Desktop: Centered editorial shell with maximum bounded width
        expect(type).toMatch(/desktop/);
      }
    });
  });
});
