import { describe, it, expect } from 'vitest';
import {
  getColorFamily,
  getColorTone,
  detectColorAmbiguity,
  extractColorIntelligence,
  getGarmentClassification,
  getFabricMaterialProperties,
  getDisentangledStyleAttributes,
  createAttributeProvenanceRecord,
} from '../garmentAttributeModel';
import {
  extractGarmentFeaturesFromImage,
  ImageFeatureExtractionResult,
} from '../imageFeatureExtractor';
import {
  enrichWardrobeItem,
  enrichWardrobe,
  isAttributeKnown,
  getEnrichedAttributeScoreDelta,
} from '../featureEnricher';
import { autoTagImage } from '../../../services/autoTag';
import { WardrobeItem, AttributeAffinity, PersonalStyleProfile } from '../../../types';
import { derivePersonalStyleProfile } from '../../styleBrain';

describe('StyleSaathi 3.0 — Phase 2: Wardrobe Feature Intelligence & Garment Attribute Accuracy', () => {
  // ==========================================================================
  // SUITE 1: INDIAN TRADITIONAL GARMENTS CLASSIFICATION & ANATOMY
  // ==========================================================================
  describe('1. Indian Traditional Garments Classification & Structural Anatomy', () => {
    it('classifies saree with floor length, draped silhouette, and drape layering role', async () => {
      const result = await extractGarmentFeaturesFromImage('banarasi-silk-saree-red-gold.jpg');
      expect(result.category).toBe('Ethnic');
      expect(result.subcategory).toBe('saree');
      expect(result.length).toBe('floor_length');
      expect(result.layeringRole).toBe('drape');
      expect(result.silhouette).toBe('draped');
      expect(result.fabric).toBe('banarasi');
      expect(result.regionalTradition).toBe('banarasi');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.85);
      expect(result.confidenceLevel).toBe('HIGH');
    });

    it('classifies knee-length kurta with full sleeves, mandarin collar, and straight silhouette', async () => {
      const result = await extractGarmentFeaturesFromImage('white-cotton-kurta-mandarin.jpg');
      expect(result.category).toBe('Ethnic');
      expect(result.subcategory).toBe('kurta');
      expect(result.length).toBe('knee_length');
      expect(result.sleeveType).toBe('full_sleeve');
      expect(result.neckline).toBe('mandarin_collar');
      expect(result.silhouette).toBe('straight');
      expect(result.layeringRole).toBe('standalone');
      expect(result.fabric).toBe('cotton');
    });

    it('classifies hip-length kurti with three-quarter sleeves and A-line silhouette', async () => {
      const result = await extractGarmentFeaturesFromImage('yellow-chikankari-kurti.jpg');
      expect(result.category).toBe('Ethnic');
      expect(result.subcategory).toBe('kurti');
      expect(result.length).toBe('hip_length');
      expect(result.sleeveType).toBe('three_quarter');
      expect(result.silhouette).toBe('a_line');
      expect(result.pattern).toBe('chikankari');
      expect(result.regionalTradition).toBe('lucknowi_chikankari');
    });

    it('classifies anarkali suit with flared ankle length and traditional ceremonial context', async () => {
      const result = await extractGarmentFeaturesFromImage('anarkali-suit-maroon.png');
      expect(result.category).toBe('Ethnic');
      expect(result.subcategory).toBe('anarkali');
      expect(result.length).toBe('ankle_length');
      expect(result.silhouette).toBe('anarkali');
    });

    it('classifies ceremonial sherwani with knee length, structured coat type and outer layering', async () => {
      const result = await extractGarmentFeaturesFromImage('ivory-raw-silk-sherwani.jpg');
      expect(result.category).toBe('Ethnic');
      expect(result.subcategory).toBe('sherwani');
      expect(result.length).toBe('knee_length');
      expect(result.layeringRole).toBe('outer');
      expect(result.neckline).toBe('mandarin_collar');
      expect(result.culturalContext).toBe('ceremonial');
      expect(result.formality).toBe(5);
    });

    it('classifies traditional dhoti and lungi with ankle length and draped silhouette', async () => {
      const dhoti = await extractGarmentFeaturesFromImage('cream-gold-dhoti.jpg');
      expect(dhoti.category).toBe('Ethnic');
      expect(dhoti.subcategory).toBe('dhoti');
      expect(dhoti.length).toBe('ankle_length');
      expect(dhoti.silhouette).toBe('draped');
    });
  });

  // ==========================================================================
  // SUITE 2: WESTERN CLOTHING CLASSIFICATION & ANATOMY
  // ==========================================================================
  describe('2. Western Clothing Classification & Structural Anatomy', () => {
    it('classifies denim jeans with ankle length, twill fabric, and straight silhouette', async () => {
      const result = await extractGarmentFeaturesFromImage('vintage-blue-denim-jeans.jpg');
      expect(result.category).toBe('Bottoms');
      expect(result.subcategory).toBe('jeans');
      expect(result.fabric).toBe('denim');
      expect(result.length).toBe('ankle_length');
      expect(result.silhouette).toBe('straight');
      expect(result.fabricWeight).toBe('heavyweight');
    });

    it('classifies collared shirt with full sleeves and base layering role', async () => {
      const result = await extractGarmentFeaturesFromImage('white-linen-shirt.jpg');
      expect(result.category).toBe('Tops');
      expect(result.subcategory).toBe('shirt');
      expect(result.neckline).toBe('collared');
      expect(result.sleeveType).toBe('full_sleeve');
      expect(result.layeringRole).toBe('base');
      expect(result.fabric).toBe('linen');
    });

    it('classifies tailored blazer with collared neckline and outer layering role', async () => {
      const result = await extractGarmentFeaturesFromImage('navy-wool-blazer.jpg');
      expect(result.category).toBe('Outerwear');
      expect(result.subcategory).toBe('blazer');
      expect(result.neckline).toBe('collared');
      expect(result.layeringRole).toBe('outer');
      expect(result.fabric).toBe('wool');
    });

    it('classifies crew-neck t-shirt with short sleeves and base layering role', async () => {
      const result = await extractGarmentFeaturesFromImage('black-cotton-tee.jpg');
      expect(result.category).toBe('Tops');
      expect(result.subcategory).toBe('t-shirt');
      expect(result.neckline).toBe('round');
      expect(result.sleeveType).toBe('short_sleeve');
      expect(result.layeringRole).toBe('base');
    });
  });

  // ==========================================================================
  // SUITE 3: CROSS-CULTURAL AESTHETICS (KOREAN & JAPANESE)
  // ==========================================================================
  describe('3. Cross-Cultural Aesthetics (Korean Contemporary & Japanese Workwear)', () => {
    it('identifies Korean relaxed aesthetic from oversized blazer cut', () => {
      const attrs = getDisentangledStyleAttributes(
        'blazer',
        'Outerwear',
        'oversized',
        'polyblend',
        'solid',
        'korean-minimal-oversized-blazer'
      );
      expect(attrs.styleFamily).toBe('korean_relaxed');
      expect(attrs.fitType).toBe('oversized');
      expect(attrs.silhouette).toBe('boxy');
    });

    it('identifies Japanese workwear aesthetic from relaxed linen trousers', () => {
      const attrs = getDisentangledStyleAttributes(
        'trousers',
        'Bottoms',
        'relaxed',
        'linen',
        'solid',
        'japanese-relaxed-linen-trousers'
      );
      expect(attrs.styleFamily).toBe('japanese_workwear');
      expect(attrs.fitType).toBe('relaxed');
      expect(attrs.silhouette).toBe('boxy');
    });
  });

  // ==========================================================================
  // SUITE 4: FUSION OUTFITS & INDO-WESTERN HARMONY
  // ==========================================================================
  describe('4. Fusion Outfits & Indo-Western Style Families', () => {
    it('classifies kurti paired with denim as indo-western fusion', () => {
      const attrs = getDisentangledStyleAttributes(
        'kurti',
        'Ethnic',
        'regular',
        'cotton',
        'solid',
        'indo-western-kurti-denim-fusion'
      );
      expect(attrs.styleFamily).toBe('indo_western_fusion');
      expect(attrs.silhouette).toBe('a_line');
    });

    it('classifies nehru jacket styled as mid-layer over shirt', () => {
      const classification = getGarmentClassification('nehru jacket', 'Ethnic');
      expect(classification.layeringRole).toBe('mid');
      expect(classification.sleeveType).toBe('sleeveless');
      expect(classification.neckline).toBe('mandarin_collar');
    });
  });

  // ==========================================================================
  // SUITE 5: COLOR INTELLIGENCE & PALETTE AMBIGUITY
  // ==========================================================================
  describe('5. Color Intelligence, Palettes & Ambiguity Detection', () => {
    it('maps colors accurately to canonical ColorFamily and ColorTone', () => {
      expect(getColorFamily('navy')).toBe('blues');
      expect(getColorTone('navy')).toBe('cool');

      expect(getColorFamily('mustard')).toBe('yellows_oranges');
      expect(getColorTone('mustard')).toBe('warm');

      expect(getColorFamily('charcoal')).toBe('neutrals');
      expect(getColorTone('charcoal')).toBe('neutral');

      expect(getColorFamily('gold')).toBe('metallics');
      expect(getColorFamily('terracotta')).toBe('earth_tones');
    });

    it('detects pattern-related color ambiguity on multicolored craft prints', () => {
      // Solid with 1 color -> unambiguous
      expect(detectColorAmbiguity(['white'], 'solid')).toBe(false);

      // Multicolored floral print with 2+ colors -> ambiguous
      expect(detectColorAmbiguity(['pink', 'green'], 'floral')).toBe(true);

      // Bandhani tie-dye with 2 colors -> ambiguous
      expect(detectColorAmbiguity(['red', 'yellow'], 'bandhani')).toBe(true);

      // 3 or more colors -> always ambiguous
      expect(detectColorAmbiguity(['red', 'blue', 'gold'])).toBe(true);
    });

    it('extracts structured ColorIntelligenceResult with calibrated confidence', () => {
      const result = extractColorIntelligence(['maroon', 'gold'], 'zari_brocade');
      expect(result.primaryColor).toBe('maroon');
      expect(result.secondaryColor).toBe('gold');
      expect(result.colorFamily).toBe('reds_pinks');
      expect(result.colorTone).toBe('warm');
      expect(result.colorConfidence).toBeGreaterThanOrEqual(0.70);
    });
  });

  // ==========================================================================
  // SUITE 6: AMBIGUOUS PHOTOGRAPHS & TRUTH-IN-AI (ZERO HALLUCINATION)
  // ==========================================================================
  describe('6. Ambiguous Photographs & Truth-in-AI (Zero Hallucination)', () => {
    it('assigns low confidence (< 0.25) and requests user confirmation for generic camera files', async () => {
      const result = await extractGarmentFeaturesFromImage('IMG_20261106_001247.jpg');
      expect(result.overallConfidence).toBeLessThanOrEqual(0.25);
      expect(result.confidenceLevel).toBe('LOW');
      expect(result.needsUserConfirmation).toBe(true);
      expect(result.ambiguityReasons).toContain(
        'Generic camera filename with no identifiable fashion keywords'
      );
      // NEVER fabricates cotton fabric or fake composition
      expect(result.fabric).toBeUndefined();
      expect(result.fabricVerificationStatus).toBe('unknown');
      expect(result.materialComposition).toBe('Unspecified fabric composition');
    });

    it('never invents fabric composition percentages on unlabelled photos', async () => {
      const genericPhoto = await extractGarmentFeaturesFromImage('DSC_0982.png');
      expect(genericPhoto.materialComposition).not.toContain('100%');
      expect(genericPhoto.materialComposition).not.toContain('80%');
      expect(genericPhoto.fabricVerificationStatus).toBe('unknown');
    });

    it('never hallucinates synthetic viewing angles', async () => {
      const item: WardrobeItem = {
        id: 'item-unverified-1',
        name: 'Unverified Photo',
        category: 'Tops',
        subcategory: 't-shirt',
        colors: ['grey'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
      };
      const enriched = enrichWardrobeItem(item);
      // No fake 3D angles or multi-view coordinates fabricated
      expect((enriched as any).viewingAngles).toBeUndefined();
      expect((enriched as any).synthetic3DModel).toBeUndefined();
    });
  });

  // ==========================================================================
  // SUITE 7: DISAMBIGUATION OF SIMILAR-LOOKING FABRICS
  // ==========================================================================
  describe('7. Disambiguation of Similar-Looking Fabrics', () => {
    it('differentiates chiffon vs georgette based on crepe texture and weave structure', () => {
      const chiffon = getFabricMaterialProperties('chiffon');
      const georgette = getFabricMaterialProperties('georgette');

      expect(chiffon.texture).toBe('sheer');
      expect(chiffon.genericComposition).toContain('plain balanced sheer crepe');

      expect(georgette.texture).toBe('rough');
      expect(georgette.genericComposition).toContain('crinkled crepe');
    });

    it('differentiates natural silk vs synthetic satin weave', () => {
      const silk = getFabricMaterialProperties('silk');
      expect(silk.texture).toBe('smooth');
      expect(silk.genericComposition).toContain('Natural protein silk');
      expect(silk.breathability).toBe('medium');
    });

    it('differentiates hand-spun khadi vs flax linen', () => {
      const khadi = getFabricMaterialProperties('khadi');
      const linen = getFabricMaterialProperties('linen');

      expect(khadi.texture).toBe('textured');
      expect(khadi.genericComposition).toContain('Hand-spun natural cotton or silk');
      expect(khadi.weight).toBe('medium_weight');

      expect(linen.texture).toBe('crisp');
      expect(linen.genericComposition).toContain('Natural flax fibers');
      expect(linen.weight).toBe('lightweight');
    });
  });

  // ==========================================================================
  // SUITE 8: MULTIPLE GARMENTS IN ONE IMAGE & FLATLAY DETECTION
  // ==========================================================================
  describe('8. Multiple Garments in One Image & Flatlay Detection', () => {
    it('detects flatlay ensembles and requests user cropping/isolation', async () => {
      const result = await extractGarmentFeaturesFromImage('kurta-with-palazzo-suit-set-flatlay.jpg');
      expect(result.isMultiGarmentOrFlatlay).toBe(true);
      expect(result.needsUserConfirmation).toBe(true);
      expect(result.ambiguityReasons.some((r) => r.includes('flatlay') || r.includes('coordinating'))).toBe(true);
    });

    it('dampens confidence when multiple garment keywords collide in a single image', async () => {
      const result = await extractGarmentFeaturesFromImage('shirt-and-trousers-combo.jpg');
      expect(result.isMultiGarmentOrFlatlay).toBe(true);
      expect(result.overallConfidence).toBeLessThan(0.80);
    });
  });

  // ==========================================================================
  // SUITE 9: LOW QUALITY IMAGES & UNIDENTIFIABLE FILES
  // ==========================================================================
  describe('9. Low-Quality Images & Unidentifiable Files', () => {
    it('handles short or uninformative filenames gracefully', async () => {
      const result = await extractGarmentFeaturesFromImage('a.jpg');
      expect(result.overallConfidence).toBeLessThanOrEqual(0.25);
      expect(result.confidenceLevel).toBe('LOW');
      expect(result.needsUserConfirmation).toBe(true);
    });

    it('marks attribute provenance accurately for missing attributes', () => {
      const prov = createAttributeProvenanceRecord('unknown', 0, 'No data available');
      expect(prov.source).toBe('unknown');
      expect(prov.confidence).toBe(0);
      expect(prov.verifiedAt).toBeUndefined();
    });
  });

  // ==========================================================================
  // SUITE 10: USER-CORRECTED ATTRIBUTES OVERRIDING AI (RULE 10 INVIOLABILITY)
  // ==========================================================================
  describe('10. User-Corrected Attributes Overriding AI (Rule 10 Inviolability)', () => {
    it('preserves user_confirmed provenance and prevents AI overwrite', () => {
      const userItem: WardrobeItem = {
        id: 'user-confirmed-item',
        name: 'Handloom Cotton Saree',
        category: 'Ethnic',
        subcategory: 'saree',
        colors: ['indigo', 'white'],
        seasons: ['summer'],
        occasions: ['office', 'casual outing'],
        formality: 3,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 2,
        fabric: 'cotton',
        userVerified: true,
        aiConfidence: 0.60,
      };

      const enriched = enrichWardrobeItem(userItem);

      expect(enriched.attributeProvenance?.category.source).toBe('user_confirmed');
      expect(enriched.attributeProvenance?.category.confidence).toBe(1.0);
      expect(enriched.attributeProvenance?.fabric.source).toBe('user_confirmed');
      expect(enriched.attributeProvenance?.fabric.confidence).toBe(1.0);
      expect(enriched.fabricVerificationStatus).toBe('user_confirmed');
    });

    it('treats legacy items without userVerified flag as inferred or unknown', () => {
      const legacyItem: WardrobeItem = {
        id: 'legacy-item',
        name: 'Old Top',
        category: 'Tops',
        subcategory: 't-shirt',
        colors: ['black'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
      };

      const enriched = enrichWardrobeItem(legacyItem);
      expect(enriched.attributeProvenance?.fabric.source).toBe('unknown');
      expect(enriched.attributeProvenance?.fabric.confidence).toBe(0.0);
      expect(enriched.fabricVerificationStatus).toBe('unknown');
    });
  });

  // ==========================================================================
  // SUITE 11: UNKNOWN VS VERIFIED VALUES IN RECOMMENDATION SCORING
  // ==========================================================================
  describe('11. Unknown vs Verified Values in Recommendation Scoring', () => {
    it('awards perfectly neutral delta (0.0) for unknown attributes', () => {
      const itemWithUnknownFabric: WardrobeItem = {
        id: 'unknown-fabric-item',
        name: 'Unspecified Top',
        category: 'Tops',
        subcategory: 't-shirt',
        colors: ['white'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
        fabric: 'unknown',
      };

      const fabricAffinity: AttributeAffinity = {
        score: -0.8,
        confidence: 0.7,
        sampleCount: 5,
        lastInteractedAt: Date.now(),
        status: 'observed',
        alpha: 2,
        beta: 6,
        variance: 0.02,
        uncertainty: 0.3,
        provenance: {
          status: 'observed',
          observationCount: 5,
          alpha: 2,
          beta: 6,
          variance: 0.02,
          uncertainty: 0.3,
          credibleInterval: [-0.9, -0.4],
          signalCounts: { rejected: 2 },
          lastInteractedAt: Date.now(),
          isExplicitOverride: false,
        },
      };

      // Item has unknown fabric -> score delta MUST be neutral 0.0 (no false penalty)
      const delta = getEnrichedAttributeScoreDelta(itemWithUnknownFabric, 'fabric', fabricAffinity);
      expect(delta).toBe(0.0);
    });

    it('applies calibrated delta when attribute is verified and known', () => {
      const itemWithKnownFabric: WardrobeItem = {
        id: 'known-fabric-item',
        name: 'Cotton Shirt',
        category: 'Tops',
        subcategory: 'shirt',
        colors: ['blue'],
        seasons: ['summer'],
        occasions: ['college'],
        formality: 2,
        status: 'clean',
        favorite: false,
        note: '',
        timesWorn: 0,
        fabric: 'cotton',
      };

      const cottonAffinity: AttributeAffinity = {
        score: 0.8,
        confidence: 0.75,
        sampleCount: 6,
        lastInteractedAt: Date.now(),
        status: 'observed',
        alpha: 6,
        beta: 2,
        variance: 0.02,
        uncertainty: 0.25,
        provenance: {
          status: 'observed',
          observationCount: 6,
          alpha: 6,
          beta: 2,
          variance: 0.02,
          uncertainty: 0.25,
          credibleInterval: [0.4, 0.9],
          signalCounts: { worn: 3 },
          lastInteractedAt: Date.now(),
          isExplicitOverride: false,
        },
      };

      const delta = getEnrichedAttributeScoreDelta(itemWithKnownFabric, 'fabric', cottonAffinity);
      expect(delta).toBe(0.60); // 0.8 * 0.75
    });
  });

  // ==========================================================================
  // SUITE 12: QUANTITATIVE PRECISION, RECALL, F1 & CALIBRATION BENCHMARK
  // ==========================================================================
  describe('12. Quantitative Evaluation Dataset & Benchmark Metrics', () => {
    interface LabeledSample {
      input: string;
      expectedCategory: string;
      expectedSubcategory?: string;
      expectedFabric?: string;
      expectedSilhouette?: string;
      isAmbiguous: boolean;
    }

    const BENCHMARK_SAMPLES: LabeledSample[] = [
      // Indian Traditional
      { input: 'pure-silk-kanjivaram-saree-gold.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'saree', expectedFabric: 'silk', expectedSilhouette: 'draped', isAmbiguous: false },
      { input: 'lucknowi-chikankari-cotton-kurta-white.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'kurta', expectedFabric: 'cotton', expectedSilhouette: 'straight', isAmbiguous: false },
      { input: 'handloom-chanderi-silk-kurti-green.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'kurti', expectedFabric: 'chanderi', expectedSilhouette: 'a_line', isAmbiguous: false },
      { input: 'bridal-lehenga-choli-red-embroidered.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'lehenga', expectedFabric: 'silk', expectedSilhouette: 'flared', isAmbiguous: false },
      { input: 'anarkali-suit-navy-georgette.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'anarkali', expectedFabric: 'georgette', expectedSilhouette: 'anarkali', isAmbiguous: false },
      { input: 'ceremonial-sherwani-cream-silk.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'sherwani', expectedFabric: 'silk', expectedSilhouette: 'fitted', isAmbiguous: false },
      { input: 'traditional-dhoti-cream-cotton.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'dhoti', expectedFabric: 'cotton', expectedSilhouette: 'draped', isAmbiguous: false },
      { input: 'nehru-jacket-black-wool.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'nehru jacket', expectedFabric: 'wool', expectedSilhouette: 'fitted', isAmbiguous: false },
      { input: 'bandhgala-suit-jacket-charcoal.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'bandhgala', expectedSilhouette: 'fitted', isAmbiguous: false },
      { input: 'flared-palazzo-pants-beige-cotton.jpg', expectedCategory: 'Ethnic', expectedSubcategory: 'palazzo', expectedFabric: 'cotton', expectedSilhouette: 'flared', isAmbiguous: false },

      // Western
      { input: 'raw-denim-jeans-indigo.jpg', expectedCategory: 'Bottoms', expectedSubcategory: 'jeans', expectedFabric: 'denim', expectedSilhouette: 'straight', isAmbiguous: false },
      { input: 'formal-oxford-shirt-white-cotton.jpg', expectedCategory: 'Tops', expectedSubcategory: 'shirt', expectedFabric: 'cotton', expectedSilhouette: 'straight', isAmbiguous: false },
      { input: 'tailored-blazer-navy-wool.jpg', expectedCategory: 'Outerwear', expectedSubcategory: 'blazer', expectedFabric: 'wool', expectedSilhouette: 'fitted', isAmbiguous: false },
      { input: 'basic-crew-t-shirt-black-cotton.jpg', expectedCategory: 'Tops', expectedSubcategory: 't-shirt', expectedFabric: 'cotton', expectedSilhouette: 'straight', isAmbiguous: false },
      { input: 'pleated-chinos-trousers-tan.jpg', expectedCategory: 'Bottoms', expectedSubcategory: 'trousers', expectedSilhouette: 'straight', isAmbiguous: false },

      // Ambiguous / Generic Files
      { input: 'IMG_20261106_1001.jpg', expectedCategory: 'Tops', isAmbiguous: true },
      { input: 'DSC_4901.jpg', expectedCategory: 'Tops', isAmbiguous: true },
      { input: 'PHOTO_0029.png', expectedCategory: 'Tops', isAmbiguous: true },
      { input: 'screenshot_981.jpg', expectedCategory: 'Tops', isAmbiguous: true },
      { input: 'upload_temp_4819.jpeg', expectedCategory: 'Tops', isAmbiguous: true },
    ];

    it('achieves >= 90% Precision and >= 85% Recall on labeled garment dataset', async () => {
      let tpCategory = 0;
      let fpCategory = 0;
      let fnCategory = 0;

      let tpSubcategory = 0;
      let fpSubcategory = 0;
      let fnSubcategory = 0;

      let tpFabric = 0;
      let fpFabric = 0;
      let fnFabric = 0;

      for (const sample of BENCHMARK_SAMPLES) {
        const result = await extractGarmentFeaturesFromImage(sample.input);

        // Check Category (for non-ambiguous samples)
        if (!sample.isAmbiguous) {
          if (result.category === sample.expectedCategory) {
            tpCategory++;
          } else {
            fpCategory++;
            fnCategory++;
          }

          // Check Subcategory
          if (sample.expectedSubcategory) {
            if (result.subcategory === sample.expectedSubcategory) {
              tpSubcategory++;
            } else {
              fpSubcategory++;
              fnSubcategory++;
            }
          }

          // Check Fabric
          if (sample.expectedFabric) {
            if (result.fabric === sample.expectedFabric) {
              tpFabric++;
            } else {
              fpFabric++;
              fnFabric++;
            }
          }
        } else {
          // For ambiguous samples, must be marked needsUserConfirmation and confidence <= 0.25
          expect(result.needsUserConfirmation).toBe(true);
          expect(result.overallConfidence).toBeLessThanOrEqual(0.25);
        }
      }

      const catPrecision = tpCategory / (tpCategory + fpCategory);
      const catRecall = tpCategory / (tpCategory + fnCategory);
      const catF1 = (2 * catPrecision * catRecall) / (catPrecision + catRecall);

      const subPrecision = tpSubcategory / (tpSubcategory + fpSubcategory);
      const subRecall = tpSubcategory / (tpSubcategory + fnSubcategory);
      const subF1 = (2 * subPrecision * subRecall) / (subPrecision + subRecall);

      const fabPrecision = tpFabric / (tpFabric + fpFabric);
      const fabRecall = tpFabric / (tpFabric + fnFabric);
      const fabF1 = (2 * fabPrecision * fabRecall) / (fabPrecision + fabRecall);

      // Quantitative benchmarks
      expect(catPrecision).toBeGreaterThanOrEqual(0.95);
      expect(catRecall).toBeGreaterThanOrEqual(0.95);
      expect(catF1).toBeGreaterThanOrEqual(0.95);

      expect(subPrecision).toBeGreaterThanOrEqual(0.90);
      expect(subRecall).toBeGreaterThanOrEqual(0.90);
      expect(subF1).toBeGreaterThanOrEqual(0.90);

      expect(fabPrecision).toBeGreaterThanOrEqual(0.90);
      expect(fabRecall).toBeGreaterThanOrEqual(0.90);
      expect(fabF1).toBeGreaterThanOrEqual(0.90);
    });

    it('verifies statistical confidence calibration: high confidence correlates with high accuracy', async () => {
      let highConfTotal = 0;
      let highConfCorrect = 0;

      for (const sample of BENCHMARK_SAMPLES) {
        if (!sample.isAmbiguous) {
          const result = await extractGarmentFeaturesFromImage(sample.input);
          if (result.overallConfidence >= 0.80) {
            highConfTotal++;
            if (result.category === sample.expectedCategory && result.subcategory === sample.expectedSubcategory) {
              highConfCorrect++;
            }
          }
        }
      }

      expect(highConfTotal).toBeGreaterThan(0);
      const calibrationAccuracy = highConfCorrect / highConfTotal;
      // High-confidence tier must achieve >= 95% empirical correctness
      expect(calibrationAccuracy).toBeGreaterThanOrEqual(0.95);
    });

    it('verifies that autoTagImage passes through Phase 2 enriched intelligence', async () => {
      const mockFile = new File(['mock'], 'handloom-chanderi-silk-kurti.jpg', { type: 'image/jpeg' });
      const tagResult = await autoTagImage(mockFile);

      expect(tagResult.category).toBe('Ethnic');
      expect(tagResult.subcategory).toBe('kurti');
      expect(tagResult.fabric).toBe('chanderi');
      expect(tagResult.silhouette).toBe('a_line');
      expect(tagResult.regionalTradition).toBe('chanderi');
      expect(tagResult.confidenceLevel).toBe('HIGH');
      expect(tagResult.attributeProvenance?.fabric.source).toBe('inferred');
    });
  });
});
