import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('StyleSaathi Actual Luxury UI Transformation Verification', () => {
  const rootDir = process.cwd();
  const cssPath = path.join(rootDir, 'src/index.css');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const dressMePath = path.join(rootDir, 'src/screens/DressMeScreen.tsx');
  const wardrobePath = path.join(rootDir, 'src/screens/WardrobeScreen.tsx');
  const outfitCardPath = path.join(rootDir, 'src/components/dressme/OutfitCard.tsx');
  const androidPublicDir = path.join(rootDir, 'android/app/src/main/assets/public');

  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
  const dressMeContent = fs.readFileSync(dressMePath, 'utf-8');
  const wardrobeContent = fs.readFileSync(wardrobePath, 'utf-8');
  const outfitCardContent = fs.readFileSync(outfitCardPath, 'utf-8');

  describe('1. Typography Stack & Font Availability', () => {
    it('defines a resilient editorial serif font stack with Apple New York and Android Noto Serif fallbacks', () => {
      expect(cssContent).toContain('--font-serif:');
      expect(cssContent).toContain('Cormorant Garamond');
      expect(cssContent).toContain('-apple-system-ui-serif');
      expect(cssContent).toContain('New York');
      expect(cssContent).toContain('Noto Serif');
      expect(cssContent).toContain('Charter');
    });

    it('defines a modern, high-legibility UI sans-serif stack', () => {
      expect(cssContent).toContain('--font-sans:');
      expect(cssContent).toContain('Manrope');
      expect(cssContent).toContain('Inter');
      expect(cssContent).toContain('-apple-system');
      expect(cssContent).toContain('SF Pro Text');
    });

    it('provides explicit editorial typographic hierarchy tokens', () => {
      expect(cssContent).toContain('.editorial-hero');
      expect(cssContent).toContain('.editorial-headline');
      expect(cssContent).toContain('.editorial-title');
      expect(cssContent).toContain('.editorial-kicker');
      expect(cssContent).toContain('.editorial-quote');
    });

    it('includes Cormorant Garamond and Noto Serif Devanagari webfont links in index.html', () => {
      expect(indexHtmlContent).toContain('family=Cormorant+Garamond');
      expect(indexHtmlContent).toContain('family=Noto+Serif+Devanagari');
      expect(indexHtmlContent).toContain('family=Manrope');
    });

    it('declares local @font-face rules and preloads bundled .woff2 fonts', () => {
      expect(cssContent).toContain("@font-face");
      expect(cssContent).toContain("/fonts/cormorant-garamond-normal.woff2");
      expect(cssContent).toContain("/fonts/inter-normal.woff2");
      expect(indexHtmlContent).toContain('rel="preload" href="/fonts/cormorant-garamond-normal.woff2"');
      expect(fs.existsSync(path.join(rootDir, 'public/fonts/cormorant-garamond-normal.woff2'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'public/fonts/inter-normal.woff2'))).toBe(true);
    });
  });

  describe('2. Dress Me — Signature Editorial Experience', () => {
    it('features prominent editorial hero headline "What feels like you today?"', () => {
      expect(dressMeContent).toContain('What feels like you today?');
      expect(dressMeContent).toContain('editorial-hero');
      expect(dressMeContent).toContain('Aaj kya pehenna hai?');
    });

    it('OutfitCard uses editorial-headline for commanding look titles', () => {
      expect(outfitCardContent).toContain('editorial-headline');
      expect(outfitCardContent).toContain('specular-border');
      expect(outfitCardContent).toContain('glass-card');
    });
  });

  describe('3. Wardrobe — Personal Fashion Archive', () => {
    it('features Personal Archive editorial hero headline', () => {
      expect(wardrobeContent).toContain('Personal Archive');
      expect(wardrobeContent).toContain('editorial-hero');
      expect(wardrobeContent).toContain('WARDROBE');
    });
  });

  describe('4. Android Build Synchronization Verification', () => {
    it('verifies android public directory contains fresh assets synced today', () => {
      expect(fs.existsSync(androidPublicDir)).toBe(true);
      const androidIndexHtml = fs.readFileSync(path.join(androidPublicDir, 'index.html'), 'utf-8');
      expect(androidIndexHtml).toContain('Cormorant+Garamond');
      // Must not reference the Oct 14 stale hash index-BEL7Htz4.js
      expect(androidIndexHtml).not.toContain('index-BEL7Htz4.js');
    });
  });
});

