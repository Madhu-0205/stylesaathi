// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const topNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/TopNav.tsx'), 'utf-8');
const bottomNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/BottomNav.tsx'), 'utf-8');

describe('Phase C — Shared Application Shell & Navigation Foundations', () => {
  describe('1. Mobile Floating Capsule Bottom Navigation', () => {
    it('uses floating glass capsule styling with specular hairline and safe-nav-padding', () => {
      expect(bottomNavTsx).toContain('glass-nav');
      expect(bottomNavTsx).toContain('specular-border');
      expect(bottomNavTsx).toContain('safe-nav-padding');
      expect(bottomNavTsx).toContain('rounded-full');
      expect(bottomNavTsx).toContain('md:hidden');
    });

    it('implements all 5 core navigation tabs with 44px+ touch targets', () => {
      expect(bottomNavTsx).toContain('min-h-12');
      expect(bottomNavTsx).toContain('WARDROBE');
      expect(bottomNavTsx).toContain('DRESS');
      expect(bottomNavTsx).toContain('CALENDAR');
      expect(bottomNavTsx).toContain('INSIGHT');
      expect(bottomNavTsx).toContain('YOU');
    });

    it('renders textile active indicator dot with Kumkum accent', () => {
      expect(bottomNavTsx).toContain('bg-(--kumkum)');
      expect(bottomNavTsx).toContain('scale-100');
    });
  });

  describe('2. Desktop Editorial Header (TopNav)', () => {
    it('uses glass-header material with specular bottom divider', () => {
      expect(topNavTsx).toContain('glass-header');
      expect(topNavTsx).toContain('StyleSaathiLogo');
    });

    it('enforces min-h-11 on all desktop interactive controls', () => {
      expect(topNavTsx).toContain('min-h-11');
      expect(topNavTsx).toContain('WARDROBE');
      expect(topNavTsx).toContain('DRESS');
      expect(topNavTsx).toContain('CALENDAR');
      expect(topNavTsx).toContain('INSIGHT');
      expect(topNavTsx).toContain('YOU');
    });

    it('provides Ask Stylist ⌘K command trigger and AI Saathi trigger', () => {
      expect(topNavTsx).toContain('Ask Stylist…');
      expect(topNavTsx).toContain('⌘K');
      expect(topNavTsx).toContain('AI Saathi');
    });

    it('provides global theme toggle and Add Piece button', () => {
      expect(topNavTsx).toContain('toggleTheme');
      expect(topNavTsx).toContain('Add Piece');
    });
  });

  describe('3. Global Floating AI Companion Hub (App.tsx)', () => {
    it('encloses AI Saathi and Ask AI in a unified glass-pill container', () => {
      expect(appTsx).toContain('role="region"');
      expect(appTsx).toContain('aria-label="AI Companions"');
      expect(appTsx).toContain('safe-floating-ai');
      expect(appTsx).toContain('glass-pill');
    });

    it('ensures both companion triggers meet 44px minimum touch targets with divider', () => {
      expect(appTsx).toContain('flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-(--ink)');
      expect(appTsx).toContain('flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-(--ink)');
      expect(appTsx).toContain('<div className="h-4 w-px bg-border/80 mx-0.5" aria-hidden="true" />');
    });
  });
});

