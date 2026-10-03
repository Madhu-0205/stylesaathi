import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { StyleSaathiLogo } from '../components/brand/StyleSaathiLogo';
import { StyleSaathiLoader } from '../components/loading/StyleSaathiLoader';
import { StyleSaathiLoadingOverlay } from '../components/loading/StyleSaathiLoadingOverlay';

const srcDir = path.resolve(process.cwd(), 'src');
const publicDir = path.resolve(process.cwd(), 'public');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
const topNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/TopNav.tsx'), 'utf-8');
const onboardingTsx = fs.readFileSync(path.join(srcDir, 'screens/OnboardingScreen.tsx'), 'utf-8');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');

describe('StyleSaathi Official Brand Logo & Premium Loader Verification', () => {

  describe('1. Official StyleSaathi Logo Component Variants', () => {
    it('Variant A: Full Logo renders canonical wardrobe rack symbol and STYLESAATHI wordmark', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { variant: 'full', size: 'md' }));
      expect(html).toContain('STYLESAATHI');
      expect(html).toContain('<svg');
      // Contains the wardrobe architectural lines and garment drapes
      expect(html).toContain('heroGarmentGrad');
      expect(html).toContain('leftGarmentGrad');
      expect(html).toContain('rightGarmentGrad');
    });

    it('Variant B: Compact Mark renders wardrobe clothing symbol only without wordmark text', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { variant: 'mark', size: 'sm' }));
      expect(html).toContain('<svg');
      expect(html).not.toContain('STYLESAATHI');
    });

    it('Variant C: Wordmark renders typographical mark without SVG wardrobe symbol', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { variant: 'wordmark', size: 'md' }));
      expect(html).toContain('STYLESAATHI');
      expect(html).not.toContain('<svg');
    });

    it('Variant D: Favicon renders simplified high-contrast badge for 16/32px scale', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { variant: 'favicon', size: 'md' }));
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 64 64"');
      // Does not squeeze wordmark into icon
      expect(html).not.toContain('STYLESAATHI');
    });

    it('Stacked Layout renders logo centered with stacked alignment', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { layout: 'stacked', size: 'lg' }));
      expect(html).toContain('flex-col items-center');
      expect(html).toContain('STYLESAATHI');
    });

    it('Header Constraint: "SINCE 2026" is NOT rendered in normal logo instances', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { variant: 'full' }));
      expect(html).not.toContain('SINCE 2026');
    });

    it('Dedicated Splash/Brand presentation: "SINCE 2026" displays only when showSince={true}', () => {
      const html = renderToString(
        React.createElement(StyleSaathiLogo, { layout: 'stacked', showSince: true })
      );
      expect(html).toContain('SINCE 2026');
    });

    it('Supports tagline rendering when showTagline is enabled', () => {
      const html = renderToString(React.createElement(StyleSaathiLogo, { showTagline: true }));
      expect(html).toContain('Wardrobe');
    });

    it('Renders all size tokens gracefully (xs, sm, md, lg, xl)', () => {
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
      for (const size of sizes) {
        const html = renderToString(React.createElement(StyleSaathiLogo, { size }));
        expect(html).toContain('STYLESAATHI');
      }
    });
  });

  describe('2. Original Wardrobe Loading Animation Component', () => {
    it('Renders the custom animated wardrobe rack with authentic Indian garments', () => {
      const html = renderToString(React.createElement(StyleSaathiLoader, { size: 'md' }));
      expect(html).toContain('<svg');
      expect(html).toContain('animate-rail-draw');
      expect(html).toContain('animate-garment-1'); // Blush Kurti
      expect(html).toContain('animate-garment-2'); // Shirt
      expect(html).toContain('animate-garment-3-hero'); // Hero Saree
      expect(html).toContain('animate-garment-4'); // Tailored Drape
    });

    it('Provides proper accessibility semantics (role="status", aria-live="polite", aria-busy="true")', () => {
      const html = renderToString(React.createElement(StyleSaathiLoader, {}));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-busy="true"');
    });

    it('Displays customizable status text and subtext', () => {
      const html = renderToString(
        React.createElement(StyleSaathiLoader, {
          statusText: 'Styling your evening look…',
          subtext: 'Selecting compatible silhouettes',
        })
      );
      expect(html).toContain('Styling your evening look…');
      expect(html).toContain('Selecting compatible silhouettes');
    });

    it('Compact mode hides text and retains minimal wardrobe animation', () => {
      const html = renderToString(React.createElement(StyleSaathiLoader, { compact: true }));
      expect(html).toContain('animate-rail-draw');
      expect(html).not.toContain('STYLESAATHI');
    });

    it('Supports different sizes (sm, md, lg)', () => {
      const smHtml = renderToString(React.createElement(StyleSaathiLoader, { size: 'sm' }));
      const lgHtml = renderToString(React.createElement(StyleSaathiLoader, { size: 'lg' }));
      expect(smHtml).toContain('width="140"');
      expect(lgHtml).toContain('width="290"');
    });
  });

  describe('3. Loading Overlay Component', () => {
    it('Renders overlay dialog when visible', () => {
      const html = renderToString(React.createElement(StyleSaathiLoadingOverlay, { isVisible: true }));
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('STYLESAATHI');
    });

    it('Returns null when not visible and not fading out', () => {
      const html = renderToString(
        React.createElement(StyleSaathiLoadingOverlay, { isVisible: false, isFadingOut: false })
      );
      expect(html).toBe('');
    });

    it('Applies fadeout classes during exit transition', () => {
      const html = renderToString(
        React.createElement(StyleSaathiLoadingOverlay, { isVisible: true, isFadingOut: true })
      );
      expect(html).toContain('opacity-0');
      expect(html).toContain('pointer-events-none');
    });
  });

  describe('4. CSS Animation Rules & Accessibility (Reduced Motion)', () => {
    it('Contains railDraw keyframe animation', () => {
      expect(indexCss).toContain('@keyframes railDraw');
    });

    it('Contains sequential drop keyframes for garments (garmentDrop1-4)', () => {
      expect(indexCss).toContain('@keyframes garmentDrop1');
      expect(indexCss).toContain('@keyframes garmentDrop2');
      expect(indexCss).toContain('@keyframes garmentDrop3');
      expect(indexCss).toContain('@keyframes garmentDrop4');
    });

    it('Contains fabric swaying keyframes (gentleSwayA, gentleSwayB, heroPieceCurate)', () => {
      expect(indexCss).toContain('@keyframes gentleSwayA');
      expect(indexCss).toContain('@keyframes gentleSwayB');
      expect(indexCss).toContain('@keyframes heroPieceCurate');
    });

    it('Implements prefers-reduced-motion to disable sway and movement for motion-sensitive users', () => {
      expect(indexCss).toContain('@media (prefers-reduced-motion: reduce)');
      expect(indexCss).toContain('.animate-garment-1');
      expect(indexCss).toContain('transform: none !important');
      expect(indexCss).toContain('opacity: 1 !important');
    });
  });

  describe('5. Application Integration & Metadata Verification', () => {
    it('index.html links to /favicon.svg and /apple-touch-icon.svg', () => {
      expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
      expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.svg" />');
    });

    it('public/favicon.svg exists and is clean vector SVG', () => {
      const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf-8');
      expect(faviconSvg).toContain('<svg');
      expect(faviconSvg).toContain('viewBox="0 0 64 64"');
      expect(faviconSvg).not.toContain('STYLESAATHI'); // No tiny text squeeze
    });

    it('public/apple-touch-icon.svg exists and has squircle layout', () => {
      const appleTouchSvg = fs.readFileSync(path.join(publicDir, 'apple-touch-icon.svg'), 'utf-8');
      expect(appleTouchSvg).toContain('<svg');
      expect(appleTouchSvg).toContain('viewBox="0 0 180 180"');
    });

    it('TopNav.tsx imports and renders StyleSaathiLogo', () => {
      expect(topNavTsx).toContain('StyleSaathiLogo');
      expect(topNavTsx).toContain('variant="full"');
    });

    it('OnboardingScreen.tsx imports StyleSaathiLogo with dedicated brand presentation', () => {
      expect(onboardingTsx).toContain('StyleSaathiLogo');
      expect(onboardingTsx).toContain('showSince={true}');
    });

    it('WardrobeScreen.tsx renders compact mark on mobile', () => {
      expect(wardrobeScreenTsx).toContain('StyleSaathiLogo');
      expect(wardrobeScreenTsx).toContain('variant="mark"');
    });

    it('App.tsx integrates StyleSaathiLoadingOverlay for initial boot transition', () => {
      expect(appTsx).toContain('StyleSaathiLoadingOverlay');
      expect(appTsx).toContain('isBooting');
      expect(appTsx).toContain('isFadingOut');
    });
  });
});
