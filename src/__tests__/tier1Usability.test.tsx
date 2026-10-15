// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { ItemCard } from '../components/wardrobe/ItemCard';
import { WardrobeItem } from '../types';

const srcDir = path.resolve(process.cwd(), 'src');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');
const aiSaathiChatTsx = fs.readFileSync(path.join(srcDir, 'components/saathi/AISaathiChatView.tsx'), 'utf-8');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const itemDetailSheetTsx = fs.readFileSync(path.join(srcDir, 'components/wardrobe/ItemDetailSheet.tsx'), 'utf-8');
const authViewTsx = fs.readFileSync(path.join(srcDir, 'components/auth/AuthView.tsx'), 'utf-8');

const mockItem: WardrobeItem = {
  id: 'test-item-1',
  name: 'Handloom Tussar Silk Saree with Zari Border',
  category: 'Ethnic',
  subcategory: 'saree',
  colors: ['gold', 'maroon'],
  seasons: ['winter'],
  occasions: ['festive', 'wedding guest'],
  formality: 5,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 3,
  createdAt: Date.now(),
  fabric: 'silk',
  pattern: 'zari_brocade',
};

describe('Tier 1 Usability & Platform Safeguards Verification', () => {
  describe('1. Mobile Input Font-Size Safeguards (16px zoom prevention)', () => {
    it('enforces 16px minimum font size for coarse pointers in index.css', () => {
      expect(indexCss).toContain('@media (pointer: coarse)');
      expect(indexCss).toMatch(/font-size:\s*16px/);
    });

    it('sets text-base sm:text-xs in AISaathiChatView to prevent iOS zoom while keeping desktop design', () => {
      expect(aiSaathiChatTsx).toContain('text-base sm:text-xs');
      expect(aiSaathiChatTsx).not.toMatch(/className="[^"]*\btext-xs\b[^"]*"\s*placeholder="Ask AI Saathi/);
    });

    it('sets text-base md:text-xs in WardrobeScreen search input', () => {
      expect(wardrobeScreenTsx).toContain('text-base md:text-xs');
    });

    it('sets text-base sm:text-xs in ItemDetailSheet price input', () => {
      expect(itemDetailSheetTsx).toContain('text-base sm:text-xs');
    });

    it('sets text-base sm:text-sm in AuthView name and email inputs', () => {
      expect(authViewTsx).toContain('text-base sm:text-sm');
    });
  });

  describe('2. Dual Theme-Color Metadata & Native Status Bar Coordination', () => {
    it('declares light and dark theme-color meta tags with media queries in index.html', () => {
      expect(indexHtml).toContain('media="(prefers-color-scheme: light)"');
      expect(indexHtml).toContain('content="#F7F2E9"');
      expect(indexHtml).toContain('media="(prefers-color-scheme: dark)"');
      expect(indexHtml).toContain('content="#141312"');
    });

    it('declares color-scheme: light dark in index.html', () => {
      expect(indexHtml).toContain('<meta name="color-scheme" content="light dark" />');
    });
  });

  describe('3. ItemCard Discoverability & Accessibility', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('renders with role="button", tabIndex="0", and accessible aria-label on the card activation surface', () => {
      const html = renderToString(
        <ItemCard item={mockItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('role="button"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="View details for Handloom Tussar Silk Saree with Zari Border"');
    });

    it('renders heading with title attribute matching full un-truncated name without redundant aria-label', () => {
      const html = renderToString(
        <ItemCard item={mockItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('title="Handloom Tussar Silk Saree with Zari Border"');
      // No redundant aria-label on the h4 itself (text content supplies the accessible name)
      expect(html).not.toMatch(/<h4[^>]*aria-label=/);
    });

    it('uses line-clamp-2 and min-h-8 to display full multi-word titles directly on mobile touchscreens', () => {
      const html = renderToString(
        <ItemCard item={mockItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('line-clamp-2');
      expect(html).toContain('min-h-8');
      expect(html).not.toMatch(/<h4[^>]*class="[^"]*\btruncate\b/);
    });

    it('handles long 60+ character Indian garment names without breaking markup or omitting accessible attributes', () => {
      const longItem: WardrobeItem = {
        ...mockItem,
        name: 'Royal Heritage Banarasi Brocade Kanjeevaram Pattu Saree with Contrast Pallu',
      };
      const html = renderToString(
        <ItemCard item={longItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('aria-label="View details for Royal Heritage Banarasi Brocade Kanjeevaram Pattu Saree with Contrast Pallu"');
      expect(html).toContain('title="Royal Heritage Banarasi Brocade Kanjeevaram Pattu Saree with Contrast Pallu"');
    });

    it('eliminates nested interactive semantics by keeping favorite button as an independent sibling control', async () => {
      await act(async () => {
        root.render(<ItemCard item={mockItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />);
      });

      const cardSurface = container.querySelector('[role="button"]') as HTMLElement;
      const favoriteButton = container.querySelector('button[type="button"]') as HTMLButtonElement;

      expect(cardSurface).toBeTruthy();
      expect(favoriteButton).toBeTruthy();
      // Crucial APG requirement: the favorite button must NOT be inside the role="button" activation surface
      expect(cardSurface.contains(favoriteButton)).toBe(false);
    });

    it('triggers onSelect when Enter or Space is pressed directly on the card activation surface', async () => {
      const onSelect = vi.fn();
      await act(async () => {
        root.render(<ItemCard item={mockItem} onSelect={onSelect} onToggleFavorite={vi.fn()} />);
      });

      const cardSurface = container.querySelector('[role="button"]') as HTMLElement;

      // 1. Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      cardSurface.dispatchEvent(enterEvent);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(mockItem);

      // 2. Space key (must also prevent unintended scroll)
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      cardSurface.dispatchEvent(spaceEvent);
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(spaceEvent.defaultPrevented).toBe(true);
    });

    it('prevents keyboard events on the favorite button from bubbling into card detail selection', async () => {
      const onSelect = vi.fn();
      const onToggleFavorite = vi.fn();

      await act(async () => {
        root.render(<ItemCard item={mockItem} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />);
      });

      const favoriteButton = container.querySelector('button[type="button"]') as HTMLButtonElement;

      // Press Enter while focused on favorite button
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      favoriteButton.dispatchEvent(enterEvent);

      // Press Space while focused on favorite button
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      favoriteButton.dispatchEvent(spaceEvent);

      // Detail selection MUST NOT be triggered by keyboard interaction on favorite button
      expect(onSelect).not.toHaveBeenCalled();

      // Independent click on favorite button triggers favorite toggle without detail selection
      favoriteButton.click();
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
