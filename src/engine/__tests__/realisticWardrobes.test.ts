import { describe, it, expect } from 'vitest';
import { generateOutfits, calculateOutfitScore, simulateBuy } from '../index';
import { WardrobeItem, Occasion } from '../../types';

const createItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `item-${Math.random()}`,
  name: 'Wardrobe Piece',
  category: 'Tops',
  subcategory: 't-shirt',
  colors: ['white'],
  seasons: ['summer'],
  occasions: ['college', 'everyday'],
  formality: 2,
  status: 'clean',
  favorite: false,
  note: '',
  timesWorn: 0,
  ...overrides,
});

describe('Realistic Indian & Global Wardrobes Validation (Suites A–J)', () => {
  // =========================================================================
  // SUITE A: Western-only wardrobe
  // =========================================================================
  describe('Suite A: Western-only wardrobe', () => {
    const westernWardrobe: WardrobeItem[] = [
      createItem({
        id: 'w-tee-1',
        name: 'White Crewneck Tee',
        category: 'Tops',
        subcategory: 't-shirt',
        colors: ['white'],
        occasions: ['college', 'everyday'],
        formality: 1.5,
      }),
      createItem({
        id: 'w-shirt-1',
        name: 'Light Blue Oxford Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['blue'],
        occasions: ['office', 'college', 'interview'],
        formality: 4,
      }),
      createItem({
        id: 'w-jeans-1',
        name: 'Slim Indigo Jeans',
        category: 'Bottoms',
        subcategory: 'jeans',
        colors: ['navy'],
        occasions: ['college', 'everyday', 'casual outing'],
        formality: 2,
      }),
      createItem({
        id: 'w-trousers-1',
        name: 'Charcoal Wool Trousers',
        category: 'Bottoms',
        subcategory: 'trousers',
        colors: ['grey'],
        occasions: ['office', 'interview'],
        formality: 4.5,
      }),
      createItem({
        id: 'w-blazer-1',
        name: 'Navy Structured Blazer',
        category: 'Outerwear',
        subcategory: 'blazer',
        colors: ['navy'],
        occasions: ['office', 'interview'],
        formality: 4.5,
      }),
      createItem({
        id: 'w-dress-1',
        name: 'Black Wrap Midi Dress',
        category: 'Dresses',
        subcategory: 'western dress',
        colors: ['black'],
        occasions: ['date', 'party', 'office'],
        formality: 3.5,
      }),
      createItem({
        id: 'w-shoes-1',
        name: 'White Leather Sneakers',
        category: 'Footwear',
        subcategory: 'sneakers',
        colors: ['white'],
        occasions: ['college', 'everyday', 'casual outing'],
        formality: 1.8,
      }),
      createItem({
        id: 'w-shoes-2',
        name: 'Black Leather Loafers',
        category: 'Footwear',
        subcategory: 'loafers',
        colors: ['black'],
        occasions: ['office', 'interview'],
        formality: 4.5,
      }),
    ];

    it('generates valid Western and Tailored Western looks without fabricating ethnic pieces', () => {
      const collegeOutfits = generateOutfits(westernWardrobe, 'college', 'summer');
      expect(collegeOutfits.length).toBeGreaterThan(0);
      for (const o of collegeOutfits) {
        expect(['Western', 'Tailored Western', 'Western dress']).toContain(o.template);
        const pieces = Object.values(o.slots).flat();
        expect(pieces.some((p) => p.category === 'Ethnic')).toBe(false);
      }

      const officeOutfits = generateOutfits(westernWardrobe, 'office', 'summer');
      expect(officeOutfits.length).toBeGreaterThan(0);
      expect(officeOutfits.some((o) => o.template === 'Tailored Western')).toBe(true);
    });

    it('never suggests ethnic templates when only western items exist', () => {
      const pujaOutfits = generateOutfits(westernWardrobe, 'puja', 'summer');
      // No ethnic pieces tagged for puja
      expect(pujaOutfits.length).toBe(0);
    });
  });

  // =========================================================================
  // SUITE B: Indian-only wardrobe
  // =========================================================================
  describe('Suite B: Indian-only wardrobe', () => {
    const indianWardrobe: WardrobeItem[] = [
      createItem({
        id: 'i-kurta-1',
        name: 'Mustard Cotton Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['mustard'],
        occasions: ['puja', 'festive', 'family gathering', 'college'],
        formality: 3.5,
      }),
      createItem({
        id: 'i-salwar-1',
        name: 'Off-White Patiala Salwar',
        category: 'Ethnic',
        subcategory: 'salwar',
        colors: ['cream'],
        occasions: ['puja', 'festive', 'family gathering', 'college'],
        formality: 3,
      }),
      createItem({
        id: 'i-churidar-1',
        name: 'Maroon Churidar',
        category: 'Ethnic',
        subcategory: 'churidar',
        colors: ['red'],
        occasions: ['festive', 'wedding guest', 'puja'],
        formality: 4,
      }),
      createItem({
        id: 'i-dupatta-1',
        name: 'Banarasi Pink Dupatta',
        category: 'Ethnic',
        subcategory: 'dupatta',
        colors: ['pink'],
        occasions: ['puja', 'festive', 'wedding guest'],
        formality: 4,
      }),
      createItem({
        id: 'i-saree-1',
        name: 'Kanjeevaram Silk Saree',
        category: 'Ethnic',
        subcategory: 'saree',
        colors: ['red', 'gold'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
      }),
      createItem({
        id: 'i-blouse-1',
        name: 'Gold Brocade Blouse',
        category: 'Ethnic',
        subcategory: 'blouse',
        colors: ['gold'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
      }),
      createItem({
        id: 'i-juttis-1',
        name: 'Embroidered Mojaris / Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        colors: ['gold'],
        occasions: ['puja', 'festive', 'wedding guest', 'family gathering'],
        formality: 4,
      }),
    ];

    it('generates authentic Indian ensembles: Saree look and Kurta with dupatta', () => {
      const festiveOutfits = generateOutfits(indianWardrobe, 'festive', 'summer');
      expect(festiveOutfits.length).toBeGreaterThan(0);
      const templates = festiveOutfits.map((o) => o.template);
      expect(
        templates.includes('Saree look') ||
        templates.includes('Kurta with dupatta') ||
        templates.includes('Kurta look')
      ).toBe(true);

      // Verify Kurta with dupatta pairing
      const kurtaDupattaLook = festiveOutfits.find((o) => o.template === 'Kurta with dupatta');
      if (kurtaDupattaLook) {
        expect(kurtaDupattaLook.slots.top[0].subcategory).toBe('kurta');
        expect(kurtaDupattaLook.slots.dupatta[0].subcategory).toBe('dupatta');
        expect(['salwar', 'churidar']).toContain(kurtaDupattaLook.slots.bottom[0].subcategory);
      }
    });

    it('never forces western templates when only Indian pieces exist', () => {
      const outfits = generateOutfits(indianWardrobe, 'puja', 'summer');
      for (const o of outfits) {
        expect(o.template).not.toBe('Western');
        expect(o.template).not.toBe('Tailored Western');
        expect(o.template).not.toBe('Western dress');
      }
    });
  });

  // =========================================================================
  // SUITE C: Mixed Indian + Western wardrobe
  // =========================================================================
  describe('Suite C: Mixed Indian + Western wardrobe', () => {
    const mixedWardrobe: WardrobeItem[] = [
      createItem({
        id: 'm-kurti-1',
        name: 'Block-Print Short Kurti',
        category: 'Ethnic',
        subcategory: 'kurti',
        colors: ['blue'],
        occasions: ['college', 'casual outing', 'everyday'],
        formality: 2,
      }),
      createItem({
        id: 'm-jeans-1',
        name: 'Straight Leg Denim Jeans',
        category: 'Bottoms',
        subcategory: 'jeans',
        colors: ['blue'],
        occasions: ['college', 'casual outing', 'everyday'],
        formality: 2,
      }),
      createItem({
        id: 'm-sneakers-1',
        name: 'Canvas Sneakers',
        category: 'Footwear',
        subcategory: 'sneakers',
        colors: ['white'],
        occasions: ['college', 'casual outing', 'everyday'],
        formality: 1.8,
      }),
      createItem({
        id: 'm-blazer-1',
        name: 'Structured Blazer',
        category: 'Outerwear',
        subcategory: 'blazer',
        colors: ['black'],
        occasions: ['college', 'office', 'date'],
        formality: 4,
      }),
    ];

    it('generates authentic Indo-Western combinations (kurti + jeans + sneakers)', () => {
      const collegeOutfits = generateOutfits(mixedWardrobe, 'college', 'summer');
      expect(collegeOutfits.length).toBeGreaterThan(0);
      const templates = collegeOutfits.map((o) => o.template);
      expect(templates.some((t) => ['Indo-western', 'Kurta look'].includes(t))).toBe(true);

      const look = collegeOutfits[0];
      const pieces = Object.values(look.slots).flat();
      expect(pieces.some((p) => p.subcategory === 'kurti')).toBe(true);
      expect(pieces.some((p) => p.subcategory === 'jeans')).toBe(true);
      expect(pieces.some((p) => p.subcategory === 'sneakers')).toBe(true);
    });
  });

  // =========================================================================
  // SUITE D: Saree wardrobe
  // =========================================================================
  describe('Suite D: Saree wardrobe validation', () => {
    it('generates Saree look ONLY when a compatible blouse/top exists', () => {
      const saree = createItem({
        id: 's-1',
        name: 'Chanderi Silk Saree',
        category: 'Ethnic',
        subcategory: 'saree',
        colors: ['green'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
      });
      const juttis = createItem({
        id: 'j-1',
        name: 'Traditional Juttis',
        category: 'Footwear',
        subcategory: 'juttis',
        colors: ['gold'],
        occasions: ['wedding guest', 'festive'],
        formality: 4,
      });

      // Saree without blouse: MUST be 0 outfits
      const withoutBlouse = generateOutfits([saree, juttis], 'wedding guest', 'summer');
      expect(withoutBlouse).toHaveLength(0);

      // Saree with blouse: Successfully generates Saree look
      const blouse = createItem({
        id: 'b-1',
        name: 'Green Raw Silk Blouse',
        category: 'Ethnic',
        subcategory: 'blouse',
        colors: ['green'],
        occasions: ['wedding guest', 'festive'],
        formality: 5,
      });
      const withBlouse = generateOutfits([saree, blouse, juttis], 'wedding guest', 'summer');
      expect(withBlouse.length).toBeGreaterThan(0);
      expect(withBlouse[0].template).toBe('Saree look');
      expect(withBlouse[0].slots.saree[0].id).toBe('s-1');
      expect(withBlouse[0].slots.blouse[0].id).toBe('b-1');
    });

    it('never attaches jewelry or accessories not owned by the user', () => {
      const saree = createItem({
        category: 'Ethnic',
        subcategory: 'saree',
        occasions: ['wedding guest'],
        formality: 5,
      });
      const blouse = createItem({
        category: 'Ethnic',
        subcategory: 'blouse',
        occasions: ['wedding guest'],
        formality: 5,
      });
      const juttis = createItem({
        category: 'Footwear',
        subcategory: 'juttis',
        occasions: ['wedding guest'],
        formality: 4,
      });

      const outfits = generateOutfits([saree, blouse, juttis], 'wedding guest', 'summer');
      expect(outfits.length).toBeGreaterThan(0);
      for (const o of outfits) {
        const pieceSubs = Object.values(o.slots).flat().map((p) => p.subcategory);
        expect(pieceSubs.includes('jewellery')).toBe(false);
      }
    });

    it('contextual footwear scoring: juttis/heels score higher than sneakers for a saree', () => {
      const saree = createItem({ category: 'Ethnic', subcategory: 'saree', formality: 5, colors: ['red'] });
      const blouse = createItem({ category: 'Ethnic', subcategory: 'blouse', formality: 5, colors: ['gold'] });
      const juttis = createItem({ category: 'Footwear', subcategory: 'juttis', formality: 4, colors: ['gold'] });
      const sneakers = createItem({ category: 'Footwear', subcategory: 'sneakers', formality: 1.5, colors: ['white'] });

      const juttiScore = calculateOutfitScore([saree, blouse, juttis], 'wedding guest');
      const sneakerScore = calculateOutfitScore([saree, blouse, sneakers], 'wedding guest');
      expect(juttiScore).toBeGreaterThan(sneakerScore);
    });
  });

  // =========================================================================
  // SUITE E: Kurta-heavy wardrobe
  // =========================================================================
  describe('Suite E: Kurta-heavy wardrobe validation', () => {
    const kurtaWardrobe: WardrobeItem[] = [
      createItem({
        id: 'k-1',
        name: 'Indigo Straight Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['blue'],
        occasions: ['office', 'college', 'everyday'],
        formality: 3,
      }),
      createItem({
        id: 'k-2',
        name: 'White Chikankari Kurta',
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['white'],
        occasions: ['puja', 'festive', 'college'],
        formality: 3.5,
      }),
      createItem({
        id: 'sal-1',
        name: 'White Cotton Salwar',
        category: 'Ethnic',
        subcategory: 'salwar',
        colors: ['white'],
        occasions: ['puja', 'festive', 'college', 'everyday'],
        formality: 3,
      }),
      createItem({
        id: 'chur-1',
        name: 'Black Churidar',
        category: 'Ethnic',
        subcategory: 'churidar',
        colors: ['black'],
        occasions: ['office', 'college', 'everyday'],
        formality: 3,
      }),
      createItem({
        id: 'dup-1',
        name: 'Yellow Chiffon Dupatta',
        category: 'Ethnic',
        subcategory: 'dupatta',
        colors: ['yellow'],
        occasions: ['puja', 'festive'],
        formality: 3.5,
      }),
      createItem({
        id: 'flats-1',
        name: 'Kolhapuri Leather Flats',
        category: 'Footwear',
        subcategory: 'kolhapuris',
        colors: ['brown'],
        occasions: ['puja', 'festive', 'college', 'everyday', 'office'],
        formality: 3,
      }),
    ];

    it('generates Kurta + Salwar and Kurta + Dupatta when appropriate', () => {
      const pujaOutfits = generateOutfits(kurtaWardrobe, 'puja', 'summer');
      expect(pujaOutfits.length).toBeGreaterThan(0);

      // Verify Kurta with dupatta is formed with harmonious colors
      const lookWithDupatta = pujaOutfits.find((o) => o.template === 'Kurta with dupatta');
      expect(lookWithDupatta).toBeDefined();
      if (lookWithDupatta) {
        expect(lookWithDupatta.slots.dupatta[0].subcategory).toBe('dupatta');
      }
    });

    it('does not attach the dupatta indiscriminately to casual everyday looks', () => {
      const everydayOutfits = generateOutfits(kurtaWardrobe, 'everyday', 'summer');
      expect(everydayOutfits.length).toBeGreaterThan(0);
      // Clean Kurta look without dupatta is supported
      expect(everydayOutfits.some((o) => o.template === 'Kurta look')).toBe(true);
    });
  });

  // =========================================================================
  // SUITE F: Festive & Wedding Wardrobe (Lehenga validation)
  // =========================================================================
  describe('Suite F: Festive & Wedding Wardrobe', () => {
    it('Lehenga ensemble requires blouse + lehenga + dupatta + footwear (never topless)', () => {
      const lehenga = createItem({
        id: 'leh-1',
        name: 'Embroidered Velvet Lehenga',
        category: 'Ethnic',
        subcategory: 'lehenga',
        colors: ['red'],
        occasions: ['wedding guest', 'celebration'],
        formality: 5,
      });
      const dupatta = createItem({
        id: 'dup-1',
        name: 'Net Zari Dupatta',
        category: 'Ethnic',
        subcategory: 'dupatta',
        colors: ['gold'],
        occasions: ['wedding guest', 'celebration'],
        formality: 5,
      });
      const heels = createItem({
        id: 'h-1',
        name: 'Metallic Gold Heels',
        category: 'Footwear',
        subcategory: 'heels',
        colors: ['gold'],
        occasions: ['wedding guest', 'celebration'],
        formality: 4.5,
      });

      // Without blouse, Lehenga ensemble template must NOT be generated
      const withoutBlouse = generateOutfits([lehenga, dupatta, heels], 'wedding guest', 'summer');
      const hasToplessLehengaEnsemble = withoutBlouse.some((o) => o.template === 'Lehenga ensemble');
      expect(hasToplessLehengaEnsemble).toBe(false);

      // With blouse, complete Lehenga ensemble generates
      const blouse = createItem({
        id: 'bl-1',
        name: 'Gold Zari Blouse',
        category: 'Ethnic',
        subcategory: 'blouse',
        colors: ['gold'],
        occasions: ['wedding guest', 'celebration'],
        formality: 5,
      });
      const withBlouse = generateOutfits([lehenga, blouse, dupatta, heels], 'wedding guest', 'summer');
      expect(withBlouse.length).toBeGreaterThan(0);
      const ensemble = withBlouse.find((o) => o.template === 'Lehenga ensemble');
      expect(ensemble).toBeDefined();
      if (ensemble) {
        expect(ensemble.slots.blouse[0].id).toBe('bl-1');
        expect(ensemble.slots.lehenga[0].id).toBe('leh-1');
        expect(ensemble.slots.dupatta[0].id).toBe('dup-1');
        expect(ensemble.slots.footwear[0].id).toBe('h-1');
      }
    });
  });

  // =========================================================================
  // SUITE G: Office vs Interview Logic
  // =========================================================================
  describe('Suite G: Office vs Interview Logic', () => {
    const corporateWardrobe: WardrobeItem[] = [
      createItem({
        id: 'c-shirt',
        name: 'Crisp White Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        formality: 4.5,
        occasions: ['office', 'interview'],
      }),
      createItem({
        id: 'c-trousers',
        name: 'Tailored Black Trousers',
        category: 'Bottoms',
        subcategory: 'trousers',
        formality: 4.5,
        occasions: ['office', 'interview'],
      }),
      createItem({
        id: 'c-blazer',
        name: 'Black Blazer',
        category: 'Outerwear',
        subcategory: 'blazer',
        formality: 5,
        occasions: ['office', 'interview'],
      }),
      createItem({
        id: 'c-formal-shoes',
        name: 'Black Formal Oxfords',
        category: 'Footwear',
        subcategory: 'formal shoes',
        formality: 4.5,
        occasions: ['office', 'interview'],
      }),
      createItem({
        id: 'c-sneakers',
        name: 'White Sneakers',
        category: 'Footwear',
        subcategory: 'sneakers',
        formality: 2,
        occasions: ['office'],
      }),
    ];

    it('Interview strictly favors formal shoes and blazers over casual pieces', () => {
      const formalScore = calculateOutfitScore(
        [corporateWardrobe[0], corporateWardrobe[1], corporateWardrobe[2], corporateWardrobe[3]],
        'interview'
      );
      const casualScore = calculateOutfitScore(
        [corporateWardrobe[0], corporateWardrobe[1], corporateWardrobe[4]],
        'interview'
      );
      expect(formalScore).toBeGreaterThan(casualScore);
    });

    it('Office supports structured Western and allows clean professional styling', () => {
      const officeOutfits = generateOutfits(corporateWardrobe, 'office', 'summer');
      expect(officeOutfits.length).toBeGreaterThan(0);
      expect(officeOutfits.some((o) => o.template === 'Tailored Western')).toBe(true);
    });
  });

  // =========================================================================
  // SUITE H: College vs Puja Logic (College ≠ Puja)
  // =========================================================================
  describe('Suite H: College ≠ Puja distinct behavior', () => {
    it('Puja penalizes black and favors traditional auspicious colors', () => {
      const whiteKurta = createItem({
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['yellow'],
        formality: 3.5,
        occasions: ['puja', 'college'],
      });
      const blackKurta = createItem({
        category: 'Ethnic',
        subcategory: 'kurta',
        colors: ['black'],
        formality: 3.5,
        occasions: ['puja', 'college'],
      });
      const pajama = createItem({
        category: 'Ethnic',
        subcategory: 'pajama',
        colors: ['cream'],
        formality: 3,
        occasions: ['puja', 'college'],
      });
      const sandals = createItem({
        category: 'Footwear',
        subcategory: 'sandals',
        colors: ['brown'],
        formality: 3,
        occasions: ['puja', 'college'],
      });

      const auspiciousScore = calculateOutfitScore([whiteKurta, pajama, sandals], 'puja');
      const blackScore = calculateOutfitScore([blackKurta, pajama, sandals], 'puja');
      expect(auspiciousScore).toBeGreaterThan(blackScore);
    });

    it('College favors relaxed comfort (kurti-jeans) and penalizes stiff formal blazers', () => {
      const kurti = createItem({
        category: 'Ethnic',
        subcategory: 'kurti',
        formality: 2,
        occasions: ['college'],
      });
      const jeans = createItem({
        category: 'Bottoms',
        subcategory: 'jeans',
        formality: 2,
        occasions: ['college'],
      });
      const sneakers = createItem({
        category: 'Footwear',
        subcategory: 'sneakers',
        formality: 2,
        occasions: ['college'],
      });
      const blazer = createItem({
        category: 'Outerwear',
        subcategory: 'blazer',
        formality: 5,
        occasions: ['college'],
      });

      const relaxedScore = calculateOutfitScore([kurti, jeans, sneakers], 'college');
      const stiffScore = calculateOutfitScore([kurti, jeans, sneakers, blazer], 'college');
      expect(relaxedScore).toBeGreaterThan(stiffScore);
    });
  });

  // =========================================================================
  // SUITE I: Minimal wardrobe with only 5–7 items
  // =========================================================================
  describe('Suite I: Minimal wardrobe (6 items)', () => {
    const minimalWardrobe: WardrobeItem[] = [
      createItem({ id: 'top-1', category: 'Tops', subcategory: 't-shirt', occasions: ['college'] }),
      createItem({ id: 'top-2', category: 'Tops', subcategory: 'shirt', occasions: ['college'] }),
      createItem({ id: 'bot-1', category: 'Bottoms', subcategory: 'jeans', occasions: ['college'] }),
      createItem({ id: 'bot-2', category: 'Bottoms', subcategory: 'trousers', occasions: ['college'] }),
      createItem({ id: 'shoe-1', category: 'Footwear', subcategory: 'sneakers', occasions: ['college'] }),
      createItem({ id: 'shoe-2', category: 'Footwear', subcategory: 'flats', occasions: ['college'] }),
    ];

    it('generates exact valid combinations without fabricating extra pieces', () => {
      const outfits = generateOutfits(minimalWardrobe, 'college', 'summer');
      expect(outfits.length).toBeGreaterThan(0);
      for (const o of outfits) {
        expect(o.slots.top).toHaveLength(1);
        expect(o.slots.bottom).toHaveLength(1);
        expect(o.slots.footwear).toHaveLength(1);
      }
    });
  });

  // =========================================================================
  // SUITE J: Wardrobe containing unavailable/laundry items
  // =========================================================================
  describe('Suite J: Wardrobe containing laundry/needs_washing items', () => {
    it('strictly excludes in_laundry and needs_washing items', () => {
      const top = createItem({ category: 'Tops', status: 'clean', occasions: ['college'] });
      const cleanBottom = createItem({ category: 'Bottoms', status: 'clean', occasions: ['college'] });
      const laundryBottom = createItem({ category: 'Bottoms', status: 'in_laundry', occasions: ['college'] });
      const shoes = createItem({ category: 'Footwear', status: 'clean', occasions: ['college'] });

      const outfits = generateOutfits([top, cleanBottom, laundryBottom, shoes], 'college', 'summer');
      expect(outfits.length).toBeGreaterThan(0);
      for (const o of outfits) {
        const pieceIds = Object.values(o.slots).flat().map((p) => p.id);
        expect(pieceIds.includes(laundryBottom.id)).toBe(false);
      }
    });

    it('produces 0 outfits if the only compatible piece is in laundry (no bottomless outfits)', () => {
      const top = createItem({ category: 'Tops', status: 'clean', occasions: ['college'] });
      const laundryBottom = createItem({ category: 'Bottoms', status: 'in_laundry', occasions: ['college'] });
      const shoes = createItem({ category: 'Footwear', status: 'clean', occasions: ['college'] });

      const outfits = generateOutfits([top, laundryBottom, shoes], 'college', 'summer');
      expect(outfits).toHaveLength(0);
    });
  });
});
