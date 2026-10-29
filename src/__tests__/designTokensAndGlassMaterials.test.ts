// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buttonVariants } from '../components/ui/button';
import { badgeVariants } from '../components/ui/badge';

const srcDir = path.resolve(process.cwd(), 'src');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');

describe('Phase B — Design Tokens & Apple-Grade Liquid Glass Foundations', () => {
  describe('1. Editorial Color Palette & Surfaces', () => {
    it('defines warm editorial foundation surfaces in :root', () => {
      expect(indexCss).toContain('--ivory: #F8F5F0');
      expect(indexCss).toContain('--paper: #FFFDF9');
      expect(indexCss).toContain('--background: #F8F5F0');
      expect(indexCss).toContain('--card: #FFFDF9');
      expect(indexCss).toContain('--text: #121110');
      expect(indexCss).toContain('--ink: #121110');
      expect(indexCss).toContain('--muted: #6E6862');
      expect(indexCss).toContain('--border: #E8E2D8');
    });

    it('defines restrained Indian fashion accent tokens in :root', () => {
      expect(indexCss).toContain('--kumkum: #8A1B36');
      expect(indexCss).toContain('--marigold: #C98B22');
      expect(indexCss).toContain('--mehndi: #4D543B');
      expect(indexCss).toContain('--indigo: #1C2A39');
      expect(indexCss).toContain('--burnished-gold: #9E7B3B');
      expect(indexCss).toContain('--gold-rule: #BF9E58');
    });

    it('defines rich dark mode surfaces and burnished gold highlights', () => {
      expect(indexCss).toContain('.dark {');
      expect(indexCss).toContain('--background: #141312');
      expect(indexCss).toContain('--card: #1D1B1A');
      expect(indexCss).toContain('--text: #F5F1ED');
      expect(indexCss).toContain('--ink: #F5F1ED');
      expect(indexCss).toContain('--burnished-gold: #C49F5A');
    });

    it('maps luxury tokens to Tailwind @theme inline for first-class utility classes', () => {
      expect(indexCss).toContain('--color-ivory: var(--ivory);');
      expect(indexCss).toContain('--color-paper: var(--paper);');
      expect(indexCss).toContain('--color-ink: var(--ink);');
      expect(indexCss).toContain('--color-kumkum: var(--kumkum);');
      expect(indexCss).toContain('--color-burnished-gold: var(--burnished-gold);');
      expect(indexCss).toContain('--color-gold-rule: var(--gold-rule);');
    });
  });

  describe('2. Apple-Grade Liquid Glass Materials', () => {
    it('defines .glass-pill with backdrop blur, specular border, and light/dark treatments', () => {
      expect(indexCss).toContain('.glass-pill {');
      expect(indexCss).toContain('.dark .glass-pill {');
      expect(indexCss).toMatch(/\.glass-pill\s*\{[^}]*backdrop-filter:\s*blur\(16px\)/);
      expect(indexCss).toMatch(/\.glass-pill\s*\{[^}]*inset 0 1px 0/);
    });

    it('defines .glass-nav for floating capsule navigation', () => {
      expect(indexCss).toContain('.glass-nav {');
      expect(indexCss).toContain('.dark .glass-nav {');
      expect(indexCss).toMatch(/\.glass-nav\s*\{[^}]*backdrop-filter:\s*blur\(20px\)/);
    });

    it('defines .glass-card for editorial cards with ambient elevation', () => {
      expect(indexCss).toContain('.glass-card {');
      expect(indexCss).toContain('.dark .glass-card {');
      expect(indexCss).toMatch(/\.glass-card\s*\{[^}]*backdrop-filter:\s*blur\(12px\)/);
    });

    it('defines .glass-header, .glass-sheet, and .glass-floating materials', () => {
      expect(indexCss).toContain('.glass-header {');
      expect(indexCss).toContain('.glass-sheet {');
      expect(indexCss).toContain('.glass-floating {');
    });

    it('provides graceful non-blur fallbacks for browsers without backdrop-filter', () => {
      expect(indexCss).toContain('@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))');
      expect(indexCss).toContain('.glass-pill, .glass-nav, .glass-card, .glass-header, .glass-sheet, .glass-floating');
    });
  });

  describe('3. Editorial Typographic Hierarchy', () => {
    it('defines editorial typography classes with Cormorant Garamond and Manrope', () => {
      expect(indexCss).toContain('.editorial-title {');
      expect(indexCss).toContain('.editorial-headline {');
      expect(indexCss).toContain('.editorial-sub {');
      expect(indexCss).toContain('.editorial-kicker {');
      expect(indexCss).toContain('.editorial-quote {');
      expect(indexCss).toContain('.caps-label {');
    });

    it('enforces disciplined tracking for editorial kickers and caps labels', () => {
      expect(indexCss).toMatch(/\.editorial-kicker\s*\{[^}]*letter-spacing:\s*0\.22em/);
      expect(indexCss).toMatch(/\.caps-label\s*\{[^}]*letter-spacing:\s*0\.12em/);
    });
  });

  describe('4. Tactile Motion & Spring Physics', () => {
    it('defines Apple-inspired cubic-bezier spring variables in motion tokens', () => {
      expect(indexCss).toContain('--spring-snappy: cubic-bezier(0.16, 1, 0.3, 1)');
      expect(indexCss).toContain('--spring-smooth: cubic-bezier(0.32, 0.72, 0, 1)');
      expect(indexCss).toContain('--spring-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1)');
    });

    it('defines tactile micro-press classes with physical scale feedback', () => {
      expect(indexCss).toContain('.tactile-press {');
      expect(indexCss).toContain('.tactile-press:active {');
      expect(indexCss).toContain('.tactile-press-sm {');
      expect(indexCss).toContain('.spring-transition {');
    });

    it('enforces strict prefers-reduced-motion accessibility fallbacks', () => {
      expect(indexCss).toContain('@media (prefers-reduced-motion: reduce)');
      expect(indexCss).toContain('animation-duration: 0.01ms !important');
      expect(indexCss).toContain('transition-duration: 0.01ms !important');
    });
  });

  describe('5. UI Primitives Integration', () => {
    it('exposes glass variant in button component', () => {
      const glassBtnClass = buttonVariants({ variant: 'glass' });
      expect(glassBtnClass).toContain('glass-pill');
    });

    it('exposes luxury textile variants in badge component', () => {
      expect(badgeVariants({ variant: 'gold' })).toContain('text-(--burnished-gold)');
      expect(badgeVariants({ variant: 'marigold' })).toContain('text-(--marigold)');
      expect(badgeVariants({ variant: 'mehndi' })).toContain('text-(--mehndi)');
      expect(badgeVariants({ variant: 'indigo' })).toContain('text-(--indigo)');
    });
  });
});

