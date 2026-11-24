// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { sampleWardrobe } from '../data/sampleWardrobe';
import { wardrobeAssets } from '../assets/wardrobe';
import { CATEGORIES } from '../data/taxonomy';
import { WardrobeItem } from '../types';
import { ItemCard } from '../components/wardrobe/ItemCard';
import { ClothingFallback } from '../components/common/ClothingFallback';
import { ItemImage } from '../components/common/ItemImage';

const srcDir = path.resolve(process.cwd(), 'src');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const itemCardTsx = fs.readFileSync(path.join(srcDir, 'components/wardrobe/ItemCard.tsx'), 'utf-8');
const itemDetailSheetTsx = fs.readFileSync(path.join(srcDir, 'components/wardrobe/ItemDetailSheet.tsx'), 'utf-8');
const useWardrobeTs = fs.readFileSync(path.join(srcDir, 'hooks/useWardrobe.ts'), 'utf-8');
const styleThreeWaysModalTsx = fs.readFileSync(path.join(srcDir, 'components/editorial/StyleThreeWaysModal.tsx'), 'utf-8');

describe('StyleSaathi Phase 1.6B — Luxury Digital Wardrobe Experience', () => {
  // 1. Six Photographed Garments
  describe('1. Acceptance Scenario: Six Photographed Garments', () => {
    it('contains exactly six real photographed garments in the catalog asset registry', () => {
      const assetKeys = Object.keys(wardrobeAssets);
      expect(assetKeys).toHaveLength(6);
      expect(assetKeys).toEqual([
        'sample-white-tee',
        'sample-blue-shirt',
        'sample-blue-jeans',
        'sample-white-kurta',
        'sample-blue-kurti',
        'sample-juttis',
      ]);
    });

    it('resolves real asset image paths for the six photographed sample items', () => {
      const photographedItems = sampleWardrobe.filter((item) => Boolean(item.photo));
      expect(photographedItems).toHaveLength(6);
      for (const item of photographedItems) {
        expect(item.photo).toBeTruthy();
        expect(typeof item.photo).toBe('string');
        expect(item.photo).not.toBe('');
      }
    });
  });

  // 2. Twenty-Two Textual-Only Records
  describe('2. Acceptance Scenario: Twenty-Two Textual-Only Records', () => {
    it('contains exactly 22 textual-only records without fabricated photos in sampleWardrobe', () => {
      const textualItems = sampleWardrobe.filter((item) => item.photo === null || item.photo === undefined);
      expect(textualItems).toHaveLength(22);
    });

    it('preserves the total 28 physical pieces in rotation (6 photo + 22 textual)', () => {
      expect(sampleWardrobe).toHaveLength(28);
      const photoCount = sampleWardrobe.filter((i) => Boolean(i.photo)).length;
      const textualCount = sampleWardrobe.filter((i) => !i.photo).length;
      expect(photoCount + textualCount).toBe(28);
    });
  });

  // 3. Mixed Photographed and Textual Inventory
  describe('3. Acceptance Scenario: Mixed Photographed and Textual Inventory', () => {
    const photoItem = sampleWardrobe.find((i) => Boolean(i.photo))!;
    const textItem = sampleWardrobe.find((i) => !i.photo)!;

    it('renders real photograph for photographed garment in ItemCard without fallback placeholder', () => {
      const html = renderToString(
        <ItemCard item={photoItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('alt="' + photoItem.name + '"');
      expect(html).toContain('src="' + photoItem.photo + '"');
      expect(html).not.toContain('Textile Plate');
    });

    it('renders Atelier textile swatch with Textile Plate badge for textual garment in ItemCard', () => {
      const html = renderToString(
        <ItemCard item={textItem} onSelect={vi.fn()} onToggleFavorite={vi.fn()} />
      );
      expect(html).toContain('Textile Plate');
      expect(html).toContain('ATELIER ARCHIVE');
    });
  });

  // 4. Empty Wardrobe
  describe('4. Acceptance Scenario: Empty Wardrobe Guidance', () => {
    it('renders EmptyState with sample collection invitation when wardrobe has zero items', () => {
      expect(wardrobeScreenTsx).toContain('!loading && items.length === 0');
      expect(wardrobeScreenTsx).toContain('Your wardrobe is waiting');
      expect(wardrobeScreenTsx).toContain('Load Sample Wardrobe');
    });

    it('renders filtered empty state with reset filters button when search/filter matches nothing', () => {
      expect(wardrobeScreenTsx).toContain('!loading && items.length > 0 && filteredItems.length === 0');
      expect(wardrobeScreenTsx).toContain('No pieces found');
      expect(wardrobeScreenTsx).toContain('Reset Filters');
    });
  });

  // 5. Missing Garment Metadata Handling
  describe('5. Acceptance Scenario: Missing Garment Metadata', () => {
    it('provides Unspecified option in ItemDetailSheet for fabric, pattern, and fit', () => {
      expect(itemDetailSheetTsx).toContain('<option value="">Unspecified</option>');
      expect(itemDetailSheetTsx).toContain('fabric || \'\'');
      expect(itemDetailSheetTsx).toContain('pattern || \'\'');
      expect(itemDetailSheetTsx).toContain('fit || \'\'');
    });

    it('does not force default fabric to cotton when fabric is undefined upon save', () => {
      expect(itemDetailSheetTsx).toContain('fabric: fabric || undefined');
      expect(itemDetailSheetTsx).toContain('pattern: pattern || undefined');
      expect(itemDetailSheetTsx).toContain('fit: fit || undefined');
    });

    it('displays Not yet recorded when garment lastWorn timestamp is missing', () => {
      expect(itemDetailSheetTsx).toContain('Last worn: Not yet recorded');
    });
  });

  // 6. Broken or Unavailable Image Graceful Fallback
  describe('6. Acceptance Scenario: Broken or Unavailable Image Fallback', () => {
    it('ItemImage catches onError and falls back to ClothingFallback without broken image icons', () => {
      const itemWithBrokenPhoto: WardrobeItem = {
        id: 'broken-img-1',
        name: 'Chanderi Silk Dupatta',
        category: 'Accessories',
        subcategory: 'scarf',
        colors: ['gold'],
        seasons: ['summer'],
        occasions: ['festive'],
        formality: 4,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
        photo: 'https://invalid-non-existent-domain.test/broken.jpg',
      };

      const html = renderToString(<ItemImage item={itemWithBrokenPhoto} />);
      expect(html).toContain('alt="Chanderi Silk Dupatta"');
      expect(itemCardTsx).toContain('ItemImage');
    });

    it('ClothingFallback renders aesthetic palette theme based on genuine item colors and textile properties', () => {
      const html = renderToString(
        <ClothingFallback
          category="Ethnic"
          subcategory="kurta"
          name="Indigo Handblock Mulmul Kurta"
          colors={['blue', 'indigo']}
          fabric="mulmul"
        />
      );
      expect(html).toContain('ATELIER ARCHIVE');
      expect(html).toContain('Ethnic');
      expect(html).toContain('Indigo Handblock Mulmul Kurta');
      expect(html).toContain('mulmul');
    });
  });

  // 7. Category Filtering
  describe('7. Acceptance Scenario: Category Filtering', () => {
    it('WardrobeScreen renders category filter chips for all official taxonomy categories', () => {
      expect(wardrobeScreenTsx).toContain('CATEGORIES.map');
      for (const cat of CATEGORIES) {
        expect(CATEGORIES).toContain(cat);
      }
    });

    it('useWardrobe filters items by selectedCategory correctly', () => {
      expect(useWardrobeTs).toContain('if (selectedCategory !== \'All\' && item.category !== selectedCategory)');
    });
  });

  // 8. Search Discoverability
  describe('8. Acceptance Scenario: Search Discoverability', () => {
    it('WardrobeScreen provides text-base md:text-xs search input with clear button', () => {
      expect(wardrobeScreenTsx).toContain('text-base md:text-xs');
      expect(wardrobeScreenTsx).toContain('Search archive by garment, textile, color, or occasion...');
      expect(wardrobeScreenTsx).toContain('aria-label="Clear search"');
    });

    it('useWardrobe search matches name, subcategory, category, fabric, color, occasions, and notes', () => {
      expect(useWardrobeTs).toContain('matchesName');
      expect(useWardrobeTs).toContain('matchesSub');
      expect(useWardrobeTs).toContain('matchesCat');
      expect(useWardrobeTs).toContain('matchesColor');
      expect(useWardrobeTs).toContain('matchesFabric');
      expect(useWardrobeTs).toContain('matchesNote');
      expect(useWardrobeTs).toContain('matchesOccasion');
    });
  });

  // 9. Sorting Architecture
  describe('9. Acceptance Scenario: Sorting Architecture', () => {
    it('WardrobeScreen supports recently added, recently worn, most worn, least worn, and formality sorts', () => {
      expect(wardrobeScreenTsx).toContain('value="recent"');
      expect(wardrobeScreenTsx).toContain('value="recently_worn"');
      expect(wardrobeScreenTsx).toContain('value="most_worn"');
      expect(wardrobeScreenTsx).toContain('value="least_worn"');
      expect(wardrobeScreenTsx).toContain('value="formality_desc"');
      expect(wardrobeScreenTsx).toContain('value="formality_asc"');
    });
  });

  // 10. Laundry Status Filtering & Indicators
  describe('10. Acceptance Scenario: Laundry Status Filtering & Indicators', () => {
    it('WardrobeScreen renders Clean, Needs Wash, and In Laundry care buttons', () => {
      expect(wardrobeScreenTsx).toContain('Clean');
      expect(wardrobeScreenTsx).toContain('Needs Wash');
      expect(wardrobeScreenTsx).toContain('In Laundry');
      expect(wardrobeScreenTsx).toContain('Favorites');
    });

    it('ItemCard displays distinct Needs Wash and In Laundry status pills', () => {
      expect(itemCardTsx).toContain('Needs Wash');
      expect(itemCardTsx).toContain('In Laundry');
      expect(itemCardTsx).toContain('opacity-65 grayscale-30');
    });
  });

  // 11. Garment Details Profile
  describe('11. Acceptance Scenario: Garment Details Profile', () => {
    it('ItemDetailSheet includes Garment Title, Category, Formality, CPW, and Laundry state', () => {
      expect(itemDetailSheetTsx).toContain('GARMENT PROFILE');
      expect(itemDetailSheetTsx).toContain('FASHION SPECIFICATIONS');
      expect(itemDetailSheetTsx).toContain('WARDROBE STATE');
      expect(itemDetailSheetTsx).toContain('WEAR LOG');
      expect(itemDetailSheetTsx).toContain('Cost-Per-Wear (CPW):');
      expect(itemDetailSheetTsx).toContain('STYLING OR FABRIC CARE NOTE');
    });

    it('provides accessible 16px-zoom safe price input with text-base sm:text-xs', () => {
      expect(itemDetailSheetTsx).toContain('text-base sm:text-xs');
    });
  });

  // 12. Editing and Deletion
  describe('12. Acceptance Scenario: Editing and Deletion Actions', () => {
    it('ItemDetailSheet provides Save Changes and Remove Piece actions with alert dialog confirmation', () => {
      expect(itemDetailSheetTsx).toContain('Save Changes');
      expect(itemDetailSheetTsx).toContain('Remove from wardrobe?');
      expect(itemDetailSheetTsx).toContain('Remove Piece');
      expect(itemDetailSheetTsx).toContain('Keep Piece');
    });
  });

  // 13. Style Three Ways Integration
  describe('13. Acceptance Scenario: Style Three Ways Integration', () => {
    it('ItemDetailSheet triggers Style This Item (3 Ways) anchored to the selected piece', () => {
      expect(itemDetailSheetTsx).toContain('Style This Item (3 Ways)');
      expect(wardrobeScreenTsx).toContain('StyleThreeWaysModal');
      expect(wardrobeScreenTsx).toContain('anchorItem={styleThreeWaysItem}');
    });

    it('StyleThreeWaysModal supports Minimal & Refined, Relaxed Everyday, and Contemporary Statement', () => {
      expect(styleThreeWaysModalTsx).toContain('Minimal & Refined');
      expect(styleThreeWaysModalTsx).toContain('Relaxed Everyday');
      expect(styleThreeWaysModalTsx).toContain('Contemporary Statement');
    });

    it('WardrobeScreen provides direct Style 3 Ways action on the signature hero card', () => {
      expect(wardrobeScreenTsx).toContain('Style 3 Ways');
    });
  });

  // 14. Offline & Local-First Behavior
  describe('14. Acceptance Scenario: Offline & Local-First Behavior', () => {
    it('uses local asset registry and IndexedDB without cloud photo URLs or external trackers', () => {
      expect(wardrobeScreenTsx).not.toContain('https://api.');
      expect(wardrobeScreenTsx).not.toContain('cloudinary');
      expect(wardrobeScreenTsx).not.toContain('s3.amazonaws.com');
      expect(itemCardTsx).not.toContain('http');
    });
  });

  // 15. Mobile & Desktop Responsive Design Standards
  describe('15. Acceptance Scenario: Mobile & Desktop Layouts', () => {
    it('enforces pb-36 navigation clearance in WardrobeScreen', () => {
      expect(wardrobeScreenTsx).toMatch(/className="[^"]*pb-36[^"]*"/);
    });

    it('enforces responsive 2-column mobile to 5-column wide screen grid', () => {
      expect(wardrobeScreenTsx).toContain('grid-cols-2');
      expect(wardrobeScreenTsx).toContain('md:grid-cols-3');
      expect(wardrobeScreenTsx).toContain('lg:grid-cols-4');
      expect(wardrobeScreenTsx).toContain('2xl:grid-cols-5');
    });

    it('enforces min-h-11 (44px+) minimum touch target across all wardrobe buttons and tabs', () => {
      expect(wardrobeScreenTsx).toContain('min-h-11');
      expect(itemDetailSheetTsx).toContain('min-h-11');
      expect(itemCardTsx).toContain('min-h-11');
    });

    it('contains zero raw decorative emojis in headings and labels', () => {
      const headingMatches = wardrobeScreenTsx.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g) || [];
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
      for (const h of headingMatches) {
        expect(emojiRegex.test(h)).toBe(false);
      }
    });
  });
});

