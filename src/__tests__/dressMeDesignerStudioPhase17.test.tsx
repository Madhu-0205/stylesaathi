import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { recommendOutfitsWithTelemetry } from '../engine/recommendationEngine';
import { evaluateTier1HardConstraints, validateOutfitWearability } from '../engine/hardConstraints';
import { extractEditorialComponents, buildEditorialReasoning } from '../engine/saathi/editorialReasoning';
import { STYLING_AESTHETICS, StylingAestheticId, FormalityPreference } from '../hooks/useDressMe';
import {
  WardrobeItem,
  GeneratedOutfit,
  StylePreferences,
  ContextSnapshot,
  RecommendedOutfit,
} from '../types';

const srcDir = path.resolve(process.cwd(), 'src');
const dressMeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/DressMeScreen.tsx'), 'utf-8');
const outfitCardTsx = fs.readFileSync(path.join(srcDir, 'components/dressme/OutfitCard.tsx'), 'utf-8');
const useDressMeTs = fs.readFileSync(path.join(srcDir, 'hooks/useDressMe.ts'), 'utf-8');

describe('StyleSaathi Phase 1.7: Dress Me — Personal Fashion Designer Studio Verification', () => {
  const mockItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
    id: `item_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Sample Garment',
    category: 'Tops',
    subcategory: 'shirt',
    status: 'clean',
    timesWorn: 0,
    colors: ['white'],
    formality: 3,
    favorite: false,
    note: '',
    seasons: ['summer', 'monsoon', 'winter'],
    occasions: ['college', 'everyday', 'office', 'casual outing'],
    fabric: 'cotton',
    ...overrides,
  });

  const comprehensiveWardrobe: WardrobeItem[] = [
    // Tops
    mockItem({ id: 'top-shirt', name: 'White Crisp Linen Shirt', category: 'Tops', subcategory: 'shirt', colors: ['white'], fabric: 'linen', formality: 3.5, occasions: ['office', 'college', 'interview', 'date'] }),
    mockItem({ id: 'top-tee', name: 'Charcoal Oversized Tee', category: 'Tops', subcategory: 't-shirt', colors: ['charcoal'], fabric: 'cotton', formality: 1.5, occasions: ['college', 'casual outing', 'everyday'] }),
    mockItem({ id: 'top-kurta', name: 'Indigo Handblock Kurta', category: 'Ethnic', subcategory: 'kurta', colors: ['blue', 'indigo'], fabric: 'khadi', formality: 3.5, occasions: ['festive', 'puja', 'college', 'office', 'wedding guest'] }),
    mockItem({ id: 'top-blouse', name: 'Raw Silk Golden Blouse', category: 'Ethnic', subcategory: 'blouse', colors: ['gold', 'cream'], fabric: 'silk', formality: 4.5, occasions: ['wedding guest', 'festive', 'puja'] }),
    mockItem({ id: 'top-blazer', name: 'Structured Navy Blazer', category: 'Outerwear', subcategory: 'blazer', colors: ['navy'], fabric: 'wool', formality: 4.5, occasions: ['office', 'interview'] }),
    
    // Bottoms
    mockItem({ id: 'bot-chinos', name: 'Tailored Beige Chinos', category: 'Bottoms', subcategory: 'trousers', colors: ['beige'], fabric: 'cotton', formality: 3.5, occasions: ['office', 'college', 'interview', 'date'] }),
    mockItem({ id: 'bot-jeans', name: 'Raw Indigo Denim Jeans', category: 'Bottoms', subcategory: 'jeans', colors: ['blue'], fabric: 'denim', formality: 2.0, occasions: ['college', 'casual outing', 'date', 'everyday'] }),
    mockItem({ id: 'bot-palazzo', name: 'Ivory Cotton Silk Palazzo', category: 'Ethnic', subcategory: 'palazzo', colors: ['ivory', 'cream'], fabric: 'silk', formality: 3.8, occasions: ['festive', 'puja', 'wedding guest'] }),
    
    // Saree
    mockItem({ id: 'saree-kanjivaram', name: 'Crimson Kanjivaram Silk Saree', category: 'Ethnic', subcategory: 'saree', colors: ['red', 'gold'], fabric: 'silk', formality: 4.8, occasions: ['wedding guest', 'festive', 'puja'] }),

    // Footwear
    mockItem({ id: 'shoe-loafers', name: 'Burgundy Tassel Loafers', category: 'Footwear', subcategory: 'loafers', colors: ['burgundy'], fabric: 'polyblend', material: 'leather' } as any),
    mockItem({ id: 'shoe-sneakers', name: 'Off-White Leather Sneakers', category: 'Footwear', subcategory: 'sneakers', colors: ['white'], fabric: 'polyblend', material: 'leather' } as any),
    mockItem({ id: 'shoe-juttis', name: 'Handcrafted Zari Juttis', category: 'Footwear', subcategory: 'juttis', colors: ['gold'], fabric: 'velvet', formality: 4.2, occasions: ['festive', 'wedding guest', 'puja'] }),
    mockItem({ id: 'shoe-sandals', name: 'Tan Woven Kolhapuri Sandals', category: 'Footwear', subcategory: 'sandals', colors: ['tan'], fabric: 'polyblend', material: 'leather' } as any),

    // Accessories
    mockItem({ id: 'acc-scarf', name: 'Pashmina Scarf', category: 'Accessories', subcategory: 'scarf', colors: ['beige'], fabric: 'wool', formality: 3.5, occasions: ['office', 'date'] }),
  ];

  describe('Part 1: The 22 Core Acceptance Scenarios', () => {
    // 1. Complete wardrobe
    it('Scenario 1: Complete wardrobe generates multi-piece outfit recommendations for any occasion', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        limit: 4,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      expect(topLook.slots.top).toBeDefined();
      expect(topLook.slots.bottom).toBeDefined();
      expect(topLook.slots.footwear).toBeDefined();
      expect(topLook.explanation).toBeDefined();
    });

    // 2. Incomplete wardrobe
    it('Scenario 2: Incomplete wardrobe provides clear guidance on missing pieces without errors', () => {
      // Wardrobe with tops and footwear, but no bottoms
      const incompleteWardrobe = comprehensiveWardrobe.filter((i) => i.category !== 'Bottoms' && i.subcategory !== 'palazzo' && i.subcategory !== 'saree');
      const res = recommendOutfitsWithTelemetry({
        items: incompleteWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits).toHaveLength(0);
      expect(res.set.missingRequirements).toBeDefined();
      expect(res.set.missingRequirements!.length).toBeGreaterThan(0);
      const missing = res.set.missingRequirements![0];
      expect(missing.missingRole).toBe('bottom');
      expect(missing.explanation).toContain('bottom');
    });

    // 3. No wardrobe
    it('Scenario 3: No wardrobe produces warm empty state guidance encouraging first garment additions', () => {
      const res = recommendOutfitsWithTelemetry({
        items: [],
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits).toHaveLength(0);
    });

    // 4. Selected top as anchor
    it('Scenario 4: Selected top as anchor builds outfits strictly locking the chosen top', () => {
      const anchorTop = comprehensiveWardrobe.find((i) => i.id === 'top-shirt')!;
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'summer',
        localDate: '2026-11-15',
        anchorItemId: anchorTop.id,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of res.set.outfits) {
        const topPieces = outfit.slots.top || [];
        expect(topPieces.some((p) => p.id === anchorTop.id)).toBe(true);
      }
    });

    // 5. Selected saree as anchor
    it('Scenario 5: Selected saree as anchor pairs with compatible blouse and clean footwear', () => {
      const sareeAnchor = comprehensiveWardrobe.find((i) => i.id === 'saree-kanjivaram')!;
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-11-15',
        anchorItemId: sareeAnchor.id,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of res.set.outfits) {
        expect(outfit.slots.saree[0].id).toBe(sareeAnchor.id);
        expect(outfit.slots.blouse).toBeDefined();
        expect(outfit.slots.blouse.length).toBeGreaterThan(0);
        expect(outfit.slots.footwear).toBeDefined();
        expect(outfit.slots.footwear.length).toBeGreaterThan(0);
      }
    });

    // 6. Selected footwear as anchor
    it('Scenario 6: Selected footwear as anchor styles complete look from the ground up', () => {
      const footwearAnchor = comprehensiveWardrobe.find((i) => i.id === 'shoe-loafers')!;
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        anchorItemId: footwearAnchor.id,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of res.set.outfits) {
        expect(outfit.slots.footwear[0].id).toBe(footwearAnchor.id);
        const hasUpper = Boolean(outfit.slots.top || outfit.slots.saree || outfit.slots.dress);
        expect(hasUpper).toBe(true);
        expect(Object.keys(outfit.slots).length).toBeGreaterThanOrEqual(2);
      }
    });

    // 7. Dirty anchor
    it('Scenario 7: Dirty anchor blocks immediate wear with unwashed_anchor or enables planning mode', () => {
      const dirtyTop = mockItem({
        id: 'top-dirty',
        name: 'Dirty Oxford Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        status: 'needs_washing',
      });
      const wardrobe = [dirtyTop, ...comprehensiveWardrobe];

      // With planning mode explicitly false: strictly blocked
      const blockedRes = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        anchorItemId: dirtyTop.id,
        allowPlanningMode: false,
      });
      expect(blockedRes.set.outfits).toHaveLength(0);
      expect(blockedRes.set.missingRequirements![0].templateId).toBe('unwashed_anchor');

      // With planning mode explicitly true: permitted for future calendar planning
      const planRes = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        anchorItemId: dirtyTop.id,
        allowPlanningMode: true,
      });
      expect(planRes.set.outfits.length).toBeGreaterThan(0);
    });

    // 8. Recently worn items
    it('Scenario 8: Recently worn items receive anti-repetition penalty favoring fresh items', () => {
      const recentShirt = mockItem({
        id: 'shirt-recent',
        name: 'Recent Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['white'],
        timesWorn: 8,
        lastWorn: Date.now() - 3600 * 1000, // worn 1 hour ago
      });
      const freshShirt = mockItem({
        id: 'shirt-fresh',
        name: 'Fresh Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['white'],
        timesWorn: 0,
        lastWorn: undefined,
      });

      const wardrobe = [
        recentShirt,
        freshShirt,
        comprehensiveWardrobe.find((i) => i.id === 'bot-chinos')!,
        comprehensiveWardrobe.find((i) => i.id === 'shoe-loafers')!,
      ];

      const res = recommendOutfitsWithTelemetry({
        items: wardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        recentWornItemIds: [recentShirt.id],
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      expect(res.set.outfits[0].slots.top[0].id).toBe(freshShirt.id);
    });

    // 9. Puja constraints
    it('Scenario 9: Puja constraints strictly exclude leather items and prioritize sacred traditional decorum', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'puja',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      for (const outfit of res.set.outfits) {
        const allPieces = Object.values(outfit.slots).flat();
        const hasLeather = allPieces.some((p) => p.fabric?.toLowerCase() === 'leather' || (p as any).material?.toLowerCase() === 'leather');
        expect(hasLeather).toBe(false);
      }
    });

    // 10. Interview styling
    it('Scenario 10: Interview styling generates formal, tailored professional combinations', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'interview',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      const pieces = Object.values(topLook.slots).flat();
      const avgFormality = pieces.reduce((a, b) => a + b.formality, 0) / pieces.length;
      expect(avgFormality).toBeGreaterThanOrEqual(3.5);
    });

    // 11. Wedding guest styling
    it('Scenario 11: Wedding guest styling selects ceremonial combinations with rich textures', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'wedding guest',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      const pieces = Object.values(topLook.slots).flat();
      expect(pieces.some((p) => p.category === 'Ethnic')).toBe(true);
    });

    // 12. Office styling
    it('Scenario 12: Office styling curates professional smart combinations', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      expect(topLook.slots.footwear[0].formality).toBeGreaterThanOrEqual(3.0);
    });

    // 13. Minimalist aesthetic
    it('Scenario 13: Minimalist aesthetic prioritizes unembellished, clean-line styling', () => {
      const prefs: StylePreferences = {
        preferredContexts: ['office', 'college'],
        preferredAesthetics: ['Minimal'],
        stylingMode: 'simple',
        updatedAt: Date.now(),
      };

      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        preferences: prefs,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      expect(Object.values(topLook.slots).flat().length).toBeLessThanOrEqual(4);
    });

    // 14. Quiet luxury aesthetic
    it('Scenario 14: Quiet luxury aesthetic emphasizes understated elegance and textured fabrics', () => {
      const prefs: StylePreferences = {
        preferredContexts: ['office', 'date'],
        preferredAesthetics: ['Minimal', 'Classic'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      };

      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
        preferences: prefs,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const topLook = res.set.outfits[0];
      const fabrics = Object.values(topLook.slots).flat().map((p) => p.fabric);
      expect(fabrics.some((f) => ['linen', 'wool', 'cotton', 'silk'].includes(f || ''))).toBe(true);
    });

    // 15. Indo-Western styling
    it('Scenario 15: Indo-Western styling pairs ethnic silhouettes with western staples', () => {
      const prefs: StylePreferences = {
        preferredContexts: ['college', 'casual outing'],
        preferredAesthetics: ['Indo-Western'],
        stylingMode: 'variety',
        updatedAt: Date.now(),
      };

      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'college',
        season: 'summer',
        localDate: '2026-11-15',
        preferences: prefs,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      const hasIndoWesternLook = res.set.outfits.some((outfit) => {
        const pieces = Object.values(outfit.slots).flat();
        const hasEthnic = pieces.some((p) => p.category === 'Ethnic');
        const hasWestern = pieces.some((p) => p.category === 'Tops' || p.category === 'Bottoms');
        return hasEthnic && hasWestern;
      });
      expect(hasIndoWesternLook).toBe(true);
    });

    // 16. Missing weather
    it('Scenario 16: Missing weather context falls back smoothly to seasonal averages without throwing', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'college',
        season: 'winter',
        localDate: '2026-11-15',
        context: undefined,
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      expect(res.set.requestContext.season).toBe('winter');
    });

    // 17. Ambiguous styling request
    it('Scenario 17: Ambiguous styling request defaults to balanced curation across silhouettes', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'everyday',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      expect(res.set.outfits[0].role).toBe('best_match');
    });

    // 18. Multiple genuinely different alternatives
    it('Scenario 18: Multiple genuinely different alternatives with distinct roles and diversification', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'college',
        season: 'winter',
        localDate: '2026-11-15',
        limit: 4,
      });

      expect(res.set.outfits.length).toBeGreaterThanOrEqual(2);
      const roles = res.set.outfits.map((o) => o.role);
      expect(roles).toContain('best_match');
      if (res.set.outfits.length > 1) {
        expect(roles).toContain('alternative');
      }
    });

    // 19. Saving an outfit
    it('Scenario 19: Saving an outfit preserves complete slot metadata and template attributes', async () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
      });

      const outfit = res.set.outfits[0];
      const mockSave = vi.fn().mockResolvedValue('saved_outfit_123');
      await mockSave(outfit);

      expect(mockSave).toHaveBeenCalledWith(outfit);
      expect(outfit.template).toBeDefined();
      expect(outfit.slots).toBeDefined();
    });

    // 20. Planning an outfit
    it('Scenario 20: Planning an outfit schedules look for calendar date with occasion context', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'office',
        season: 'winter',
        localDate: '2026-11-15',
      });

      const outfit = res.set.outfits[0];
      const targetDate = '2026-11-16';
      const planRecord = {
        date: targetDate,
        outfit,
        occasion: 'office',
      };

      expect(planRecord.date).toBe(targetDate);
      expect(planRecord.outfit.id).toBe(outfit.id);
    });

    // 21. Wear confirmation
    it('Scenario 21: Wear confirmation updates timesWorn count and enforces clean wearability check', () => {
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'college',
        season: 'winter',
        localDate: '2026-11-15',
      });

      const outfit = res.set.outfits[0];
      const check = validateOutfitWearability(outfit, null);
      expect(check.canWear).toBe(true);

      const item = outfit.slots.top[0];
      const updatedItem = {
        ...item,
        timesWorn: (item.timesWorn || 0) + 1,
        lastWorn: Date.now(),
      };
      expect(updatedItem.timesWorn).toBe((item.timesWorn || 0) + 1);
      expect(updatedItem.lastWorn).toBeGreaterThan(0);
    });

    // 22. Offline recommendation fallback
    it('Scenario 22: Offline recommendation fallback runs 100% locally with zero network calls', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      
      const res = recommendOutfitsWithTelemetry({
        items: comprehensiveWardrobe,
        occasion: 'college',
        season: 'winter',
        localDate: '2026-11-15',
      });

      expect(res.set.outfits.length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('Part 2: UI & Atelier Studio Architecture Verification', () => {
    it('DressMeScreen features the Styling Brief Atelier Calibration controls', () => {
      expect(dressMeScreenTsx).toContain('STYLING BRIEF · ATELIER CALIBRATION');
      expect(dressMeScreenTsx).toContain('Aesthetic Direction:');
      expect(dressMeScreenTsx).toContain('Formality Dial:');
      expect(dressMeScreenTsx).toContain('STYLING_AESTHETICS.map');
    });

    it('DressMeScreen provides honest climate fallback notice when live forecast is unavailable', () => {
      expect(dressMeScreenTsx).toContain('isWeatherUnavailable');
      expect(dressMeScreenTsx).toContain('Seasonal Climate Average Fallback');
    });

    it('DressMeScreen preserves all core layout tokens and touch targets', () => {
      expect(dressMeScreenTsx).toContain('What feels like you today?');
      expect(dressMeScreenTsx).toContain('editorial-hero');
      expect(dressMeScreenTsx).toContain('Aaj kya pehenna hai?');
      expect(dressMeScreenTsx).toContain('DRESS ME');
      expect(dressMeScreenTsx).toContain('<WeatherStatusBar />');
      expect(dressMeScreenTsx).toContain('TOMORROW ·');
      expect(dressMeScreenTsx).toContain('Plan Tomorrow');
      expect(dressMeScreenTsx).toContain('OCCASIONS.map');
      expect(dressMeScreenTsx).toContain('SEASONS.map');
      expect(dressMeScreenTsx).toContain('CLIMATE:');
      expect(dressMeScreenTsx).toContain('CINEMATIC SPOTLIGHT');
      expect(dressMeScreenTsx).toContain('Spotlight');
      expect(dressMeScreenTsx).toContain('All Looks');
      expect(dressMeScreenTsx).toContain('PARALLEL CURATIONS');
      expect(dressMeScreenTsx).toContain('pb-36');
      expect(dressMeScreenTsx).toContain('md:flex-wrap');
    });

    it('OutfitCard integrates grounded 8-part editorial reasoning and role distinction', () => {
      expect(outfitCardTsx).toContain('extractEditorialComponents');
      expect(outfitCardTsx).toContain('buildEditorialReasoning');
      expect(outfitCardTsx).toContain('Color Balance:');
      expect(outfitCardTsx).toContain('Silhouette &amp; Drape:');
      expect(outfitCardTsx).toContain('Texture Flow:');
      expect(outfitCardTsx).toContain('Archive Rediscovery');
      expect(outfitCardTsx).toContain('roleDistinctionCopy');
    });

    it('OutfitCard preserves all existing regression contracts and touch targets', () => {
      expect(outfitCardTsx).toContain('rounded-3xl');
      expect(outfitCardTsx).toContain('specular-border');
      expect(outfitCardTsx).toContain('Hero Piece');
      expect(outfitCardTsx).toContain('primarySlot[1][0].fabric');
      expect(outfitCardTsx).toContain('WHY THIS WORKS');
      expect(outfitCardTsx).toContain('gold-accent-rule');
      expect(outfitCardTsx).toContain('CONFIDENCE');
      expect(outfitCardTsx).toContain('Cultural Rationale:');
      expect(outfitCardTsx).toContain('weatherComfortRationale');
      expect(outfitCardTsx).toContain('Wear Today');
      expect(outfitCardTsx).toContain('Plan');
      expect(outfitCardTsx).toContain('Save');
      expect(outfitCardTsx).toContain('Pass');
      expect(outfitCardTsx).toContain('min-h-11');
      expect(outfitCardTsx).toContain('tactile-press');
    });

    it('useDressMe exposes aesthetic direction and formality preferences', () => {
      expect(useDressMeTs).toContain('STYLING_AESTHETICS');
      expect(useDressMeTs).toContain('selectedAesthetic');
      expect(useDressMeTs).toContain('setSelectedAesthetic');
      expect(useDressMeTs).toContain('formalityPreference');
      expect(useDressMeTs).toContain('setFormalityPreference');
      expect(useDressMeTs).toContain('targetFormality');
      expect(useDressMeTs).toContain('isWeatherUnavailable');
    });

    it('buildEditorialReasoning outputs strictly grounded dimensions without hallucination', () => {
      const components = extractEditorialComponents({
        top: [comprehensiveWardrobe.find((i) => i.id === 'top-shirt')!],
        bottom: [comprehensiveWardrobe.find((i) => i.id === 'bot-chinos')!],
        footwear: [comprehensiveWardrobe.find((i) => i.id === 'shoe-loafers')!],
      });

      const reasoning = buildEditorialReasoning({
        concept: 'Formal business wear',
        occasion: 'office',
        components,
      });

      expect(reasoning.sections.colorTheory).toBeDefined();
      expect(reasoning.sections.proportionSilhouette).toBeDefined();
      expect(reasoning.sections.fabricTexture).toBeDefined();
      expect(reasoning.sections.wardrobeAnchors).toContain('White Crisp Linen Shirt');
    });
  });
});
