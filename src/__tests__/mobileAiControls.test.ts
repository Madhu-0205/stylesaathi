// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');
const needleCommandBarTsx = fs.readFileSync(path.join(srcDir, 'components/needle/NeedleCommandBar.tsx'), 'utf-8');

describe('Mobile AI Controls & Companion Hub Coordination', () => {
  describe('1. Coordinated Single Container Architecture', () => {
    it('encloses both AI Saathi and Ask AI in a single shared floating companion container', () => {
      // Must have role="region" and aria-label="AI Companions"
      expect(appTsx).toContain('role="region"');
      expect(appTsx).toContain('aria-label="AI Companions"');

      // Both buttons are present inside App.tsx
      expect(appTsx).toContain('aria-label="Open AI Saathi conversation"');
      expect(appTsx).toContain('Open Ask AI command palette (Command + K)');
      expect(appTsx).toContain('AI Saathi');
      expect(appTsx).toContain('Ask AI');
    });

    it('ensures neither button has independent conflicting fixed positions', () => {
      // The floating buttons in App.tsx should NOT have individual fixed positioning
      expect(appTsx).not.toMatch(/className="[^"]*fixed[^"]*"[^>]*>\s*<Sparkles[^>]*>\s*<span[^>]*>AI Saathi<\/span>/s);

      // NeedleCommandBar should NOT render an uncoordinated mobile fixed floating button
      expect(needleCommandBarTsx).not.toContain('md:hidden fixed bottom-20 right-4');
    });
  });

  describe('2. Safe Area & Dynamic Clearance', () => {
    it('defines .safe-floating-ai in index.css with env(safe-area-inset-bottom)', () => {
      expect(indexCss).toContain('.safe-floating-ai');
      expect(indexCss).toMatch(/\.safe-floating-ai\s*\{[^}]*bottom:\s*calc\([^}]*env\(safe-area-inset-bottom/);
    });

    it('includes desktop media query resetting bottom on md viewports', () => {
      expect(indexCss).toMatch(/@media\s*\(min-width:\s*768px\)\s*\{\s*\.safe-floating-ai\s*\{[^}]*bottom:/);
    });

    it('applies safe-floating-ai to the floating container in App.tsx', () => {
      expect(appTsx).toContain('safe-floating-ai');
    });
  });

  describe('3. Touch Target and Accessibility Standards', () => {
    it('ensures both AI triggers satisfy minimum 44px touch height (min-h-11)', () => {
      // Both buttons must contain min-h-11
      expect(appTsx).toContain('aria-label="Open AI Saathi conversation"');
      expect(appTsx).toContain('className="flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-(--ink)');

      expect(appTsx).toContain('aria-label="Open Ask AI command palette (Command + K)"');
      expect(appTsx).toContain('className="flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-(--ink)');
    });

    it('places a subtle visual divider between the two buttons for tactile separation', () => {
      expect(appTsx).toContain('<div className="h-4 w-px bg-border/80 mx-0.5" aria-hidden="true" />');
    });
  });

  describe('4. Event Dispatching and Functional Integrity', () => {
    it('triggers open-needle-command custom event from the Ask AI button', () => {
      expect(appTsx).toContain("window.dispatchEvent(new CustomEvent('open-needle-command'))");
    });

    it('NeedleCommandBar listens to open-needle-command event', () => {
      expect(needleCommandBarTsx).toContain("window.addEventListener('open-needle-command'");
    });
  });
});
