import { describe, it, expect } from 'vitest';
import { WardrobeItem } from '../../../types';
import {
  getEnsembleIntegritySignals,
  getFabricCompatibilitySignal,
  getOutfitFabricSignals,
  getSilhouetteBalanceSignals,
  getFootwearCompatibilitySignals,
  getAccessoryAndLayeringSignals,
} from '../compatibility';

function mockPiece(patch: Partial<WardrobeItem>): WardrobeItem {
  return {
    id: patch.id || 'item-1',
    name: patch.name || 'Mock Item',
    category: patch.category || 'Tops',
    subcategory: patch.subcategory || 'shirt',
    colors: patch.colors || ['blue'],
    seasons: patch.seasons || ['summer'],
    occasions: patch.occasions || ['everyday'],
    formality: patch.formality || 2,
    status: patch.status || 'clean',
    favorite: false,
    note: '',
    timesWorn: 0,
    ...patch,
  };
}

describe('IFKG Compatibility Engine', () => {
  describe('Ensemble Structural Integrity', () => {
    it('emits a positive signal when saree is paired with a blouse', () => {
      const saree = mockPiece({ id: 'saree-1', category: 'Ethnic', subcategory: 'saree' });
      const blouse = mockPiece({ id: 'blouse-1', category: 'Ethnic', subcategory: 'blouse' });
      const signals = getEnsembleIntegritySignals([saree, blouse]);

      expect(signals.length).toBe(1);
      expect(signals[0].type).toBe('garment_compatibility');
      expect(signals[0].strength).toBeGreaterThan(0.5);
      expect(signals[0].explanationKey).toBe('saree_structural_complete');
    });

    it('emits a negative incomplete signal when saree is missing an upper component', () => {
      const saree = mockPiece({ id: 'saree-1', category: 'Ethnic', subcategory: 'saree' });
      const signals = getEnsembleIntegritySignals([saree]);

      expect(signals.length).toBe(1);
      expect(signals[0].type).toBe('garment_compatibility');
      expect(signals[0].strength).toBe(-1.0);
      expect(signals[0].explanationKey).toBe('saree_missing_blouse');
    });

    it('emits a complete signal when lehenga is paired with crop top or blouse', () => {
      const lehenga = mockPiece({ id: 'leh-1', category: 'Ethnic', subcategory: 'lehenga' });
      const cropTop = mockPiece({ id: 'crop-1', category: 'Tops', subcategory: 'crop top' });
      const signals = getEnsembleIntegritySignals([lehenga, cropTop]);

      expect(signals.length).toBe(1);
      expect(signals[0].strength).toBe(0.9);
      expect(signals[0].metadata?.complete).toBe(true);
    });
  });

  describe('Fabric Compatibility', () => {
    it('detects high synergy between natural breathable handlooms (cotton & khadi)', () => {
      const sig = getFabricCompatibilitySignal('cotton', 'khadi');
      expect(sig).not.toBeNull();
      expect(sig?.type).toBe('fabric_compatibility');
      expect(sig?.strength).toBe(0.8);
      expect(sig?.explanationKey).toBe('natural_breathable_harmony');
    });

    it('detects high synergy between regal ceremonial textiles (silk & banarasi)', () => {
      const sig = getFabricCompatibilitySignal('silk', 'banarasi');
      expect(sig).not.toBeNull();
      expect(sig?.strength).toBe(0.85);
      expect(sig?.explanationKey).toBe('regal_ceremonial_fabrics');
    });

    it('detects negative tension between delicate sheer chiffon and rigid heavy denim', () => {
      const sig = getFabricCompatibilitySignal('chiffon', 'denim');
      expect(sig).not.toBeNull();
      expect(sig?.strength).toBe(-0.5);
      expect(sig?.explanationKey).toBe('delicate_heavy_fabric_clash');
    });

    it('evaluates ensemble fabrics across pieces correctly', () => {
      const p1 = mockPiece({ id: '1', fabric: 'cotton' });
      const p2 = mockPiece({ id: '2', fabric: 'linen' });
      const signals = getOutfitFabricSignals([p1, p2]);

      expect(signals.length).toBe(1);
      expect(signals[0].strength).toBe(0.8);
    });
  });

  describe('Silhouette Volume Balance', () => {
    it('detects balanced silhouette for fitted top and flared palazzo/bottom', () => {
      const top = mockPiece({ id: 't1', category: 'Tops', subcategory: 'shirt', fit: 'slim' });
      const bottom = mockPiece({ id: 'b1', category: 'Ethnic', subcategory: 'palazzo', fit: 'flared' });
      const signals = getSilhouetteBalanceSignals([top, bottom]);

      expect(signals.length).toBe(1);
      expect(signals[0].type).toBe('silhouette_balance');
      expect(signals[0].strength).toBe(0.8);
      expect(signals[0].explanationKey).toBe('fitted_top_flared_bottom');
    });

    it('detects balanced silhouette for relaxed top and tailored/slim bottom', () => {
      const top = mockPiece({ id: 't1', category: 'Ethnic', subcategory: 'kurta', fit: 'relaxed' });
      const bottom = mockPiece({ id: 'b1', category: 'Bottoms', subcategory: 'trousers', fit: 'slim' });
      const signals = getSilhouetteBalanceSignals([top, bottom]);

      expect(signals.length).toBe(1);
      expect(signals[0].strength).toBe(0.75);
      expect(signals[0].explanationKey).toBe('relaxed_top_tailored_bottom');
    });

    it('emits negative signal for double oversized pairing without anchor', () => {
      const top = mockPiece({ id: 't1', category: 'Tops', subcategory: 'hoodie', fit: 'oversized' });
      const bottom = mockPiece({ id: 'b1', category: 'Bottoms', subcategory: 'joggers', fit: 'oversized' });
      const signals = getSilhouetteBalanceSignals([top, bottom]);

      expect(signals.length).toBe(1);
      expect(signals[0].strength).toBe(-0.5);
      expect(signals[0].explanationKey).toBe('unanchored_volume_collision');
    });
  });

  describe('Footwear and Layering Harmony', () => {
    it('rewards traditional juttis when paired with ethnic kurta', () => {
      const kurta = mockPiece({ id: 'k1', category: 'Ethnic', subcategory: 'kurta' });
      const juttis = mockPiece({ id: 'f1', category: 'Footwear', subcategory: 'juttis' });
      const signals = getFootwearCompatibilitySignals([kurta, juttis]);

      expect(signals.length).toBe(1);
      expect(signals[0].type).toBe('footwear_compatibility');
      expect(signals[0].strength).toBe(0.85);
      expect(signals[0].explanationKey).toBe('ethnic_footwear_harmony');
    });

    it('rewards formal shoes when paired with tailored trousers', () => {
      const trousers = mockPiece({ id: 'tr1', category: 'Bottoms', subcategory: 'trousers', formality: 4 });
      const formalShoes = mockPiece({ id: 'f1', category: 'Footwear', subcategory: 'formal shoes' });
      const signals = getFootwearCompatibilitySignals([trousers, formalShoes]);

      expect(signals.length).toBe(1);
      expect(signals[0].strength).toBe(0.8);
      expect(signals[0].explanationKey).toBe('formal_footwear_harmony');
    });

    it('detects Nehru jacket layering over a kurta', () => {
      const kurta = mockPiece({ id: 'k1', category: 'Ethnic', subcategory: 'kurta' });
      const nehru = mockPiece({ id: 'n1', category: 'Ethnic', subcategory: 'nehru jacket' });
      const signals = getAccessoryAndLayeringSignals([kurta, nehru]);

      expect(signals.some((s) => s.explanationKey === 'nehru_jacket_layering')).toBe(true);
    });

    it('detects dupatta pairing with traditional kurta', () => {
      const kurta = mockPiece({ id: 'k1', category: 'Ethnic', subcategory: 'kurta' });
      const dupatta = mockPiece({ id: 'd1', category: 'Ethnic', subcategory: 'dupatta' });
      const signals = getAccessoryAndLayeringSignals([kurta, dupatta]);

      expect(signals.some((s) => s.explanationKey === 'traditional_dupatta_pairing')).toBe(true);
    });
  });
});
