import {
  WardrobeItem,
  Category,
  Subcategory,
  Occasion,
  Season,
  GeneratedOutfit,
  RecommendationRequest,
  RecommendationResultWithTelemetry,
  RecommendationSet,
  RecommendedOutfit,
  ScoreBreakdown,
  RecommendationExplanation,
  ExplanationEvidenceSource,
  OutfitSlotRole,
  MissingOutfitRequirement,
} from '../types';
import { TEMPLATES } from './outfitTemplates';
import { compatible, seasonFit } from './compatibility';
import { harmony, getOutfitWhyReasons } from './scoring';
import { getPatternCompatibilityScore } from './patternIntelligence';
import { calculatePersonalStyleScore, getPersonalStyleExplanations } from './styleBrain';
import { calculateWeatherComfortScore, getContextWhyReasons } from './contextScoring';
import {
  evaluateTier1HardConstraints,
  evaluateCulturalTierScore,
} from './hardConstraints';
import { preRankSlotCandidates } from './candidatePreRank';
import {
  calculateOutfitDistance,
  DIVERSIFICATION_DISTANCE_THRESHOLD,
} from './diversification';
import {
  computeCanonicalOutfitId,
  computeWardrobeFingerprint,
  selectDeterministicExploreCandidate,
} from './explorationModel';
import { fashionKnowledgeEngine } from './knowledge/fashionKnowledgeEngine';
import { FashionKnowledgeContext, FashionKnowledgeSignal } from './knowledge/types';
import { getExplanationForSignal } from './knowledge/explanations';

const OCCASION_FORMALITY_TARGETS: Record<string, number> = {
  college: 1.8,
  everyday: 2.0,
  'casual outing': 2.2,
  travel: 2.0,
  'family gathering': 3.2,
  puja: 3.6,
  date: 3.2,
  party: 3.8,
  office: 3.8,
  'family function': 4.0,
  festive: 4.2,
  Diwali: 4.3,
  Eid: 4.3,
  Holi: 2.2,
  interview: 4.5,
  celebration: 4.6,
  'wedding guest': 4.8,
};

export const MAX_RECOMMENDATION_CANDIDATES = 350;

function isDrapedAccessory(item: WardrobeItem): boolean {
  const s = (item.subcategory || '').toLowerCase();
  const n = item.name.toLowerCase();
  const drapedKeywords = ['dupatta', 'shawl', 'scarf', 'stole', 'chunni', 'dupatto', 'muffler'];
  return drapedKeywords.some((kw) => s.includes(kw) || n.includes(kw));
}

function isOuterwearItem(item: WardrobeItem): boolean {
  if (item.category === 'Outerwear') return true;
  const subcategories = ['blazer', 'jacket', 'shrug', 'nehru jacket', 'trench coat', 'cardigan', 'coat'];
  return subcategories.includes((item.subcategory || '').toLowerCase());
}

function buildMissingRequirement(
  anchorItem: WardrobeItem,
  template: (typeof TEMPLATES)[0],
  missingSlot: string
): MissingOutfitRequirement {
  let missingRole: OutfitSlotRole = 'bottom';
  let expectedCategory: Category = 'Bottoms';
  let compatibleSubcategories: Subcategory[] = ['trousers', 'jeans', 'palazzo', 'churidar'];
  let explanation = `Your ${anchorItem.name} needs a compatible bottom. Add trousers, jeans, or a skirt to your wardrobe to create a complete look.`;

  if (missingSlot === 'bottom') {
    missingRole = 'bottom';
    expectedCategory = 'Bottoms';
    compatibleSubcategories = ['trousers', 'jeans', 'palazzo', 'churidar', 'salwar', 'skirt'];
    explanation = `Your ${anchorItem.name} needs a compatible bottom. Add trousers, jeans, or a skirt to your wardrobe to create a complete look.`;
  } else if (missingSlot === 'top' || missingSlot === 'blouse') {
    missingRole = 'top';
    if (anchorItem.subcategory === 'saree' || anchorItem.subcategory === 'lehenga') {
      expectedCategory = 'Ethnic';
      compatibleSubcategories = ['blouse', 'crop top'];
      explanation = `Your ${anchorItem.name} needs a compatible blouse. Add a blouse or fitted crop top to your wardrobe to create a complete look.`;
    } else {
      expectedCategory = 'Tops';
      compatibleSubcategories = ['shirt', 't-shirt', 'top', 'kurta'];
      explanation = `Your outfit needs a compatible top. Add a shirt, top, or kurta to your wardrobe to create a complete look.`;
    }
  } else if (missingSlot === 'footwear' || missingSlot === 'shoes') {
    missingRole = 'footwear';
    expectedCategory = 'Footwear';
    compatibleSubcategories = ['sneakers', 'loafers', 'flats', 'juttis', 'formal shoes'];
    explanation = `Your outfit needs compatible footwear. Add shoes or juttis to your wardrobe to complete this look.`;
  } else if (missingSlot === 'outerwear' || missingSlot === 'jacket') {
    missingRole = 'layer';
    expectedCategory = 'Outerwear';
    compatibleSubcategories = ['blazer', 'jacket', 'nehru jacket'];
    explanation = `Your outfit needs a compatible layer. Add a blazer or jacket to your wardrobe to complete this look.`;
  } else if (missingSlot === 'dupatta') {
    missingRole = 'dupatta';
    expectedCategory = 'Ethnic';
    compatibleSubcategories = ['dupatta', 'scarf'];
    explanation = `Your ${anchorItem.name} look needs a compatible dupatta or scarf to complete the ensemble.`;
  } else if (missingSlot === 'dress') {
    missingRole = 'dress';
    expectedCategory = 'Dresses';
    compatibleSubcategories = ['dress', 'western dress'];
    explanation = `Your outfit requires a dress to complete the look.`;
  }

  return {
    templateId: template.name.toLowerCase().replace(/\s+/g, '_'),
    templateName: template.name,
    missingRole,
    expectedCategory,
    compatibleSubcategories,
    explanation,
  };
}

export class RecommendationEngine {
  readonly version = '2.0.0';

  public recommend(request: RecommendationRequest): RecommendationResultWithTelemetry {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const {
      items,
      occasion,
      season,
      localDate,
      explorationSeedOffset = 0,
      preferences,
      styleProfile,
      context,
      culturalSignals,
      limit = 3,
      anchorItemId,
    } = request;

    // Filter templates for occasion
    const occasionTemplates = TEMPLATES.filter((t) => {
      if (t.name === 'Indo-western') {
        return ['college', 'casual outing', 'everyday', 'date', 'travel', 'party'].includes(occasion);
      }
      if (t.name === 'Indo-western tailored') {
        return ['office', 'date', 'party', 'college', 'casual outing', 'family function', 'family gathering'].includes(occasion);
      }
      if (t.name === 'Kurta & Nehru jacket') {
        return ['wedding guest', 'celebration', 'festive', 'Diwali', 'Eid', 'family function', 'family gathering', 'puja'].includes(occasion);
      }
      if (t.name === 'Tailored Western') {
        return ['office', 'interview', 'date', 'party', 'family function', 'family gathering', 'celebration'].includes(occasion);
      }
      if (t.name === 'Lehenga ensemble') {
        return ['wedding guest', 'celebration', 'festive', 'Diwali', 'family function'].includes(occasion);
      }
      if (t.name === 'Kurta with dupatta') {
        return [
          'puja',
          'festive',
          'wedding guest',
          'celebration',
          'Diwali',
          'Eid',
          'family function',
          'family gathering',
          'office',
          'college',
          'everyday',
        ].includes(occasion);
      }
      if (t.name === 'Western dress') {
        return !['puja', 'wedding guest'].includes(occasion);
      }
      return true;
    });

    // 1. Stratified Candidate Generation
    const tGen0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let totalGeneratedCount = 0;

    const anchorItem = anchorItemId ? items.find((i) => i.id === anchorItemId) : undefined;

    // If anchor was specified but does not exist or has an un-plannable status (e.g. archived/donated)
    if (
      anchorItemId &&
      (!anchorItem ||
        (anchorItem.status !== 'clean' &&
          anchorItem.status !== 'needs_washing' &&
          anchorItem.status !== 'in_laundry'))
    ) {
      const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;
      return {
        set: {
          outfits: [],
          roles: [],
          generatedAt: localDate,
          algorithmVersion: this.version,
          requestContext: {
            occasion,
            season,
            localDate,
            explorationSeedOffset,
            anchorItemId,
          },
          missingRequirements: [],
        },
        telemetry: {
          candidateCount: 0,
          validCandidateCount: 0,
          timings: {
            candidateGenerationMs: 0,
            hardFilteringMs: 0,
            compatibilityMs: 0,
            scoringMs: 0,
            diversificationMs: 0,
            totalMs: tEnd - t0,
          },
        },
      };
    }

    // Micro-accessory anchor handling: graceful explanatory state without fabricating unnatural templates
    if (anchorItem && anchorItem.category === 'Accessories' && !isDrapedAccessory(anchorItem)) {
      const missingReq: MissingOutfitRequirement = {
        templateId: 'accessory_anchor_unsupported',
        templateName: 'Accessory Styling Guidance',
        missingRole: 'top',
        expectedCategory: 'Tops',
        compatibleSubcategories: ['shirt', 'kurta', 't-shirt'],
        explanation:
          'Pieces like watches, jewellery, and bags complement finished outfits rather than defining garment structure. Select a top, bottom, dress, outerwear piece, or footwear to anchor your outfit.',
      };
      const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;
      return {
        set: {
          outfits: [],
          roles: [],
          generatedAt: localDate,
          algorithmVersion: this.version,
          requestContext: {
            occasion,
            season,
            localDate,
            explorationSeedOffset,
            anchorItemId,
          },
          missingRequirements: [missingReq],
        },
        telemetry: {
          candidateCount: 0,
          validCandidateCount: 0,
          timings: {
            candidateGenerationMs: 0,
            hardFilteringMs: 0,
            compatibilityMs: 0,
            scoringMs: 0,
            diversificationMs: 0,
            totalMs: tEnd - t0,
          },
        },
      };
    }

    // Filter available pieces (companions must be strictly clean and season-appropriate)
    const eligiblePool = items.filter((i) => {
      if (anchorItemId && i.id === anchorItemId) return false;
      return i.status === 'clean' && seasonFit(i, season);
    });

    interface RawCandidate {
      template: (typeof TEMPLATES)[0];
      slots: Record<string, WardrobeItem[]>;
    }

    const rawCandidates: RawCandidate[] = [];

    // Identify viable occasion templates and pre-rank slot candidates
    interface ViableTemplate {
      template: (typeof TEMPLATES)[0];
      slotCandidates: Record<string, WardrobeItem[]>;
      requiredKeys: string[];
    }

    const viableTemplates: ViableTemplate[] = [];
    interface UnmetTemplateRecord {
      template: (typeof TEMPLATES)[0];
      missingSlot: string;
    }
    const unmetTemplates: UnmetTemplateRecord[] = [];

    for (const t of occasionTemplates) {
      let effectiveTemplate = t;
      let anchorSlot: string | null = null;

      if (anchorItem) {
        // 1. Check if anchor matches a required slot
        for (const reqSlot of Object.keys(t.required)) {
          if (compatible(reqSlot, anchorItem, t)) {
            anchorSlot = reqSlot;
            break;
          }
        }

        // 2. Outerwear anchor: promote optional layer/outerwear slot to required
        if (!anchorSlot && isOuterwearItem(anchorItem)) {
          for (const optSlot of Object.keys(t.optional)) {
            if (
              (optSlot === 'outerwear' || optSlot === 'jacket') &&
              compatible(optSlot, anchorItem, t)
            ) {
              anchorSlot = optSlot;
              effectiveTemplate = {
                name: t.name,
                required: { ...t.required, [optSlot]: t.optional[optSlot] },
                optional: { ...t.optional },
              };
              delete (effectiveTemplate.optional as Record<string, string[]>)[optSlot];
              break;
            }
          }
        }

        // 3. Draped accessory anchor: promote optional dupatta/accessory slot to required
        if (!anchorSlot && isDrapedAccessory(anchorItem)) {
          for (const optSlot of Object.keys(t.optional)) {
            if (
              (optSlot === 'dupatta' || optSlot === 'accessory') &&
              compatible(optSlot, anchorItem, t)
            ) {
              anchorSlot = optSlot;
              effectiveTemplate = {
                name: t.name,
                required: { ...t.required, [optSlot]: t.optional[optSlot] },
                optional: { ...t.optional },
              };
              delete (effectiveTemplate.optional as Record<string, string[]>)[optSlot];
              break;
            }
          }
        }

        // If template cannot structurally accommodate this anchor, skip it
        if (!anchorSlot) continue;
      }

      const slotCandidates: Record<string, WardrobeItem[]> = {};
      let hasAllRequired = true;
      let firstMissingSlot: string | null = null;

      for (const [slot] of Object.entries(effectiveTemplate.required)) {
        if (anchorItem && slot === anchorSlot) {
          slotCandidates[anchorSlot] = [anchorItem];
        } else {
          const matching = eligiblePool.filter((i) => compatible(slot, i, effectiveTemplate));
          const ranked = preRankSlotCandidates(
            matching,
            slot,
            occasion,
            season,
            preferences,
            styleProfile
          );
          if (ranked.length === 0) {
            hasAllRequired = false;
            if (!firstMissingSlot) firstMissingSlot = slot;
            break;
          }
          slotCandidates[slot] = ranked;
        }
      }

      if (!hasAllRequired) {
        if (firstMissingSlot) {
          unmetTemplates.push({ template: effectiveTemplate, missingSlot: firstMissingSlot });
        }
        continue;
      }

      for (const [slot] of Object.entries(effectiveTemplate.optional)) {
        const matching = eligiblePool.filter((i) => compatible(slot, i, effectiveTemplate));
        slotCandidates[slot] = preRankSlotCandidates(
          matching,
          slot,
          occasion,
          season,
          preferences,
          styleProfile
        );
      }

      viableTemplates.push({
        template: effectiveTemplate,
        slotCandidates,
        requiredKeys: Object.keys(effectiveTemplate.required),
      });
    }

    // Handle sparse wardrobe around anchor item when no complete outfit can be formed
    if (anchorItem && viableTemplates.length === 0) {
      let missingRequirements: MissingOutfitRequirement[] = [];
      if (unmetTemplates.length > 0) {
        const bestUnmet = unmetTemplates[0];
        missingRequirements = [
          buildMissingRequirement(anchorItem, bestUnmet.template, bestUnmet.missingSlot),
        ];
      } else {
        missingRequirements = [
          {
            templateId: 'unsupported_anchor_occasion',
            templateName: 'Wardrobe Complementarity',
            missingRole: 'top',
            expectedCategory: 'Tops',
            compatibleSubcategories: ['shirt', 'kurta', 't-shirt'],
            explanation: `Unable to form complete looks around ${anchorItem.name} for ${occasion}. Add complementary wardrobe essentials to style this piece.`,
          },
        ];
      }
      const tGen1 = typeof performance !== 'undefined' ? performance.now() : 0;
      return {
        set: {
          outfits: [],
          roles: [],
          generatedAt: localDate,
          algorithmVersion: this.version,
          requestContext: {
            occasion,
            season,
            localDate,
            explorationSeedOffset,
            anchorItemId,
          },
          missingRequirements,
        },
        telemetry: {
          candidateCount: 0,
          validCandidateCount: 0,
          timings: {
            candidateGenerationMs: tGen1 - tGen0,
            hardFilteringMs: 0,
            compatibilityMs: 0,
            scoringMs: 0,
            diversificationMs: 0,
            totalMs: tGen1 - t0,
          },
        },
      };
    }

    // Fair allocation of combination budget across all viable occasion templates
    const perTemplateBudget = viableTemplates.length > 0
      ? Math.max(20, Math.floor(MAX_RECOMMENDATION_CANDIDATES / viableTemplates.length))
      : 0;

    const generateGridCombos = (
      keys: string[],
      grid: WardrobeItem[][],
      idx: number,
      current: Record<string, WardrobeItem[]>
    ): Record<string, WardrobeItem[]>[] => {
      if (idx === keys.length) return [current];
      const k = keys[idx];
      const items = grid[idx] || [];
      return items.flatMap((item) =>
        generateGridCombos(keys, grid, idx + 1, { ...current, [k]: [item] })
      );
    };

    for (const vt of viableTemplates) {
      if (rawCandidates.length >= MAX_RECOMMENDATION_CANDIDATES) break;

      const { template: t, slotCandidates, requiredKeys } = vt;
      const templateCombos: Record<string, WardrobeItem[]>[] = [];
      const seenComboKeys = new Set<string>();

      const tryAddCombo = (c: Record<string, WardrobeItem[]>): boolean => {
        if (templateCombos.length >= perTemplateBudget) return false;
        if (rawCandidates.length + templateCombos.length >= MAX_RECOMMENDATION_CANDIDATES) return false;

        const comboKey = requiredKeys.map((k) => `${k}:${c[k]?.[0]?.id}`).join('|');
        if (seenComboKeys.has(comboKey)) return true;
        seenComboKeys.add(comboKey);
        templateCombos.push(c);
        return true;
      };

      // Strata 1: Pure Core Combinations (Staples / Favorites / Highest Styling Affinity)
      const coreGrid = requiredKeys.map((k) => (slotCandidates[k] || []).slice(0, 2));
      for (const c of generateGridCombos(requiredKeys, coreGrid, 0, {})) {
        if (!tryAddCombo(c)) break;
      }

      // Strata 2: Freshness / Rotation Combinations (Unworn or Longest Since Worn)
      for (let sIdx = 0; sIdx < requiredKeys.length; sIdx++) {
        if (templateCombos.length >= perTemplateBudget) break;
        const targetKey = requiredKeys[sIdx];
        const freshItems = (slotCandidates[targetKey] || []).slice(4, 7);
        if (freshItems.length === 0) continue;

        const freshGrid = requiredKeys.map((k, idx) => {
          if (idx === sIdx) return freshItems;
          return (slotCandidates[k] || []).slice(0, 1);
        });

        for (const c of generateGridCombos(requiredKeys, freshGrid, 0, {})) {
          if (!tryAddCombo(c)) break;
        }
      }

      // Strata 3: Novelty / Exploration Combinations (Under-Explored / Low Sample Count)
      for (let sIdx = 0; sIdx < requiredKeys.length; sIdx++) {
        if (templateCombos.length >= perTemplateBudget) break;
        const targetKey = requiredKeys[sIdx];
        const novelItems = (slotCandidates[targetKey] || []).slice(7, 10);
        if (novelItems.length === 0) continue;

        const novelGrid = requiredKeys.map((k, idx) => {
          if (idx === sIdx) return novelItems;
          return (slotCandidates[k] || []).slice(0, 1);
        });

        for (const c of generateGridCombos(requiredKeys, novelGrid, 0, {})) {
          if (!tryAddCombo(c)) break;
        }
      }

      // Strata 4: Stratified Breadth Combinations up to perTemplateBudget
      if (
        templateCombos.length < perTemplateBudget &&
        rawCandidates.length + templateCombos.length < MAX_RECOMMENDATION_CANDIDATES
      ) {
        const breadthGrid = requiredKeys.map((k) => (slotCandidates[k] || []).slice(0, 5));
        for (const c of generateGridCombos(requiredKeys, breadthGrid, 0, {})) {
          if (!tryAddCombo(c)) break;
        }
      }

      if (
        templateCombos.length < perTemplateBudget &&
        rawCandidates.length + templateCombos.length < MAX_RECOMMENDATION_CANDIDATES
      ) {
        const fullGrid = requiredKeys.map((k) => (slotCandidates[k] || []).slice(0, 8));
        for (const c of generateGridCombos(requiredKeys, fullGrid, 0, {})) {
          if (!tryAddCombo(c)) break;
        }
      }

      for (const c of templateCombos) {
        totalGeneratedCount++;
        rawCandidates.push({ template: t, slots: c });
      }
    }
    const tGen1 = typeof performance !== 'undefined' ? performance.now() : 0;

    // 2. Tier 1 Hard Constraints Filtering
    const tHard0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const validCandidates: RawCandidate[] = [];
    const seenOutfitIds = new Set<string>();

    for (const cand of rawCandidates) {
      let hardCheck;
      if (
        anchorItem &&
        (anchorItem.status === 'needs_washing' || anchorItem.status === 'in_laundry')
      ) {
        // Planning/inspiration mode: anchor item permitted while companions must be strictly clean
        const proxySlots: Record<string, WardrobeItem[]> = {};
        for (const [k, v] of Object.entries(cand.slots)) {
          proxySlots[k] = v.map((item) =>
            item.id === anchorItem.id ? { ...item, status: 'clean' as const } : item
          );
        }
        hardCheck = evaluateTier1HardConstraints(
          { template: cand.template, slots: proxySlots },
          context
        );
      } else {
        hardCheck = evaluateTier1HardConstraints(cand, context);
      }
      if (!hardCheck.passed) continue;

      const outfitId = computeCanonicalOutfitId({
        template: cand.template.name,
        slots: cand.slots,
      });

      if (seenOutfitIds.has(outfitId)) continue;
      seenOutfitIds.add(outfitId);

      validCandidates.push(cand);
    }
    const tHard1 = typeof performance !== 'undefined' ? performance.now() : 0;

    // 3. Compatibility & Multi-Dimensional Scoring
    const tScore0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const referenceEpoch = new Date(localDate).getTime() || 0;

    interface ScoredCandidate extends GeneratedOutfit {
      id: string;
      template: string;
      slots: Record<string, WardrobeItem[]>;
      score: number;
      why: string;
      scoreBreakdown: ScoreBreakdown;
      pieces: WardrobeItem[];
      culturalEvalReasons: string[];
      knowledgeSignals?: FashionKnowledgeSignal[];
    }

    const scoredPool: ScoredCandidate[] = [];

    for (const cand of validCandidates) {
      const pieces = Object.values(cand.slots).flat();
      const id = computeCanonicalOutfitId({
        template: cand.template.name,
        slots: cand.slots,
      });

      // A. Base Compatibility
      const numPairs = (pieces.length * (pieces.length - 1)) / 2;
      let harmonySum = 0;
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          harmonySum += harmony(pieces[i].colors, pieces[j].colors);
        }
      }
      const colorHarmonyScore = numPairs > 0 ? (harmonySum / numPairs) * 3 : 0;

      const avgFormality = pieces.reduce((a, x) => a + x.formality, 0) / pieces.length;
      const targetFormality = OCCASION_FORMALITY_TARGETS[occasion] ?? 2.5;
      const formalityDeltaScore = -Math.abs(avgFormality - targetFormality) * 1.5;

      let patternScore = 0;
      if (pieces.length >= 2) {
        let patternScoreSum = 0;
        let patternPairs = 0;
        for (let i = 0; i < pieces.length; i++) {
          for (let j = i + 1; j < pieces.length; j++) {
            if (pieces[i].pattern && pieces[j].pattern) {
              patternScoreSum += getPatternCompatibilityScore(pieces[i].pattern, pieces[j].pattern);
              patternPairs++;
            }
          }
        }
        if (patternPairs > 0) {
          patternScore = (patternScoreSum / patternPairs) * 0.8;
        }
      }

      // Knowledge Graph Context & Structured Domain Signals
      const knowledgeContext: FashionKnowledgeContext = {
        occasion,
        season,
        regionalPreference: culturalSignals?.regionalTradition,
        festivalContext: culturalSignals?.festivalContext,
        declaredModestyLevel: culturalSignals?.declaredModestyLevel,
        userAesthetics: preferences?.preferredAesthetics,
      };
      const knowledgeSignals = fashionKnowledgeEngine.getSignals(pieces, knowledgeContext);

      let ifkgCompatibilityDelta = 0;
      for (const s of knowledgeSignals) {
        if (
          s.type === 'fabric_compatibility' ||
          s.type === 'silhouette_balance' ||
          s.type === 'garment_compatibility' ||
          s.type === 'footwear_compatibility' ||
          s.type === 'accessory_compatibility' ||
          s.type === 'layering_compatibility'
        ) {
          ifkgCompatibilityDelta += s.strength * s.confidence * 0.35;
        }
      }
      ifkgCompatibilityDelta = Math.max(-1.5, Math.min(1.5, ifkgCompatibilityDelta));

      const baseCompatibility = colorHarmonyScore + formalityDeltaScore + patternScore + ifkgCompatibilityDelta;

      // B. Personal Style Brain Behavioral Scoring
      let personalStyle = 0;
      if (styleProfile) {
        personalStyle += calculatePersonalStyleScore(pieces, occasion, styleProfile, preferences);
      }
      if (preferences?.preferredAesthetics) {
        if (preferences.preferredAesthetics.includes('Classic') && pieces.some((p) => p.category !== 'Accessories')) {
          personalStyle += 0.5;
        }
      }

      // C. Weather Context Fit (Strict Weather Honesty)
      let contextFit = 0;
      const hasGenuineWeather =
        context?.weather != null &&
        context.source !== 'simulated' &&
        context.source !== 'unavailable';

      if (hasGenuineWeather) {
        const comfort = calculateWeatherComfortScore(pieces, context!);
        contextFit = comfort.scoreDelta;
      }

      // D. Cultural Hierarchy (Tier 2 Soft Penalty & Tier 3 Soft Signals)
      const culturalEval = evaluateCulturalTierScore(pieces, occasion, preferences, culturalSignals);
      let ifkgCulturalBonus = 0;
      for (const s of knowledgeSignals) {
        if (s.type === 'cultural_resonance' || s.type === 'regional_resonance') {
          if (s.strength > 0) {
            ifkgCulturalBonus += s.strength * s.confidence * 0.4;
          }
        }
      }
      ifkgCulturalBonus = Math.min(1.0, ifkgCulturalBonus);
      const culturalFit = (culturalEval.bonus + ifkgCulturalBonus) - culturalEval.penalty;

      const combinedCulturalReasons = [...culturalEval.reasons];
      for (const s of knowledgeSignals) {
        if ((s.type === 'cultural_resonance' || s.type === 'regional_resonance') && s.explanationKey) {
          const exp = getExplanationForSignal(s);
          if (exp && !combinedCulturalReasons.includes(exp)) {
            combinedCulturalReasons.push(exp);
          }
        }
      }

      // E. Novelty Bonus
      const hasNovelty = pieces.some(
        (p) => (styleProfile?.itemAffinities?.[p.id]?.sampleCount ?? (p.timesWorn || 0)) <= 1 || (p.timesWorn || 0) === 0
      );
      const noveltyBonus = hasNovelty ? 0.3 : 0.0;

      // F. Deterministic Recency Wear Penalty
      let wearPenalty = 0;
      for (const p of pieces) {
        wearPenalty += Math.min(p.timesWorn || 0, 6) * 0.12;
        if (p.lastWorn && referenceEpoch > 0 && Math.abs(referenceEpoch - p.lastWorn) < 24 * 3600 * 1000) {
          wearPenalty += 0.8;
        }
      }

      const totalScore =
        baseCompatibility +
        personalStyle +
        contextFit +
        culturalFit +
        noveltyBonus -
        wearPenalty;

      scoredPool.push({
        id,
        template: cand.template.name,
        slots: cand.slots,
        score: totalScore,
        why: '',
        scoreBreakdown: {
          baseCompatibility,
          personalStyle,
          contextFit,
          culturalFit,
          noveltyBonus,
          penalty: wearPenalty,
          total: totalScore,
        },
        pieces,
        culturalEvalReasons: combinedCulturalReasons,
        knowledgeSignals,
      });
    }

    // Deterministic Sort
    scoredPool.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.0001) {
        return b.score - a.score;
      }
      return a.id.localeCompare(b.id);
    });
    const tScore1 = typeof performance !== 'undefined' ? performance.now() : 0;

    // 4. Diversification & Top-3 Curation
    const tDiv0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const curatedOutfits: RecommendedOutfit[] = [];

    if (scoredPool.length > 0) {
      // Role 1: BEST MATCH (Highest deterministic score)
      const best = scoredPool[0];
      const bestMatchOutfit: RecommendedOutfit = {
        id: best.id,
        template: best.template,
        slots: best.slots,
        score: best.score,
        role: 'best_match',
        scoreBreakdown: best.scoreBreakdown,
        explanation: this.buildExplanation(
          best,
          'best_match',
          occasion,
          preferences,
          styleProfile,
          context,
          anchorItem
        ),
        why: '',
        knowledgeSignals: best.knowledgeSignals,
      };
      bestMatchOutfit.why = bestMatchOutfit.explanation.reasons.join(' · ');
      curatedOutfits.push(bestMatchOutfit);

      // Role 2: ALTERNATIVE (Highest score with distance >= 0.35 from Best Match)
      let alternativeCandidate: ScoredCandidate | null = null;
      for (let i = 1; i < scoredPool.length; i++) {
        const cand = scoredPool[i];
        const dist = calculateOutfitDistance(bestMatchOutfit, cand);
        if (dist >= DIVERSIFICATION_DISTANCE_THRESHOLD) {
          alternativeCandidate = cand;
          break;
        }
      }

      let alternativeOutfit: RecommendedOutfit | null = null;
      if (alternativeCandidate) {
        alternativeOutfit = {
          id: alternativeCandidate.id,
          template: alternativeCandidate.template,
          slots: alternativeCandidate.slots,
          score: alternativeCandidate.score,
          role: 'alternative',
          scoreBreakdown: alternativeCandidate.scoreBreakdown,
          explanation: this.buildExplanation(
            alternativeCandidate,
            'alternative',
            occasion,
            preferences,
            styleProfile,
            context,
            anchorItem
          ),
          why: '',
          knowledgeSignals: alternativeCandidate.knowledgeSignals,
        };
        alternativeOutfit.why = alternativeOutfit.explanation.reasons.join(' · ');
        curatedOutfits.push(alternativeOutfit);
      }

      // Role 3: EXPLORE (Controlled novelty inside safe preference boundary)
      const wardrobeFingerprint = computeWardrobeFingerprint(items.map((i) => i.id));
      const deterministicSeedKey = `${localDate}|${occasion}|${wardrobeFingerprint}|v2|${explorationSeedOffset}|${anchorItemId || ''}`;

      const exploreCandidate = selectDeterministicExploreCandidate<ScoredCandidate>(
        scoredPool,
        bestMatchOutfit,
        alternativeOutfit,
        deterministicSeedKey,
        occasion,
        styleProfile,
        preferences,
        context
      );

      if (exploreCandidate) {
        const exploreOutfit: RecommendedOutfit = {
          id: exploreCandidate.id,
          template: exploreCandidate.template,
          slots: exploreCandidate.slots,
          score: exploreCandidate.score,
          role: 'explore',
          scoreBreakdown: exploreCandidate.scoreBreakdown,
          explanation: this.buildExplanation(
            exploreCandidate,
            'explore',
            occasion,
            preferences,
            styleProfile,
            context,
            anchorItem
          ),
          why: '',
          knowledgeSignals: exploreCandidate.knowledgeSignals,
        };
        exploreOutfit.why = exploreOutfit.explanation.reasons.join(' · ');
        curatedOutfits.push(exploreOutfit);
      }
    }
    const tDiv1 = typeof performance !== 'undefined' ? performance.now() : 0;
    const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;

    const resultOutfits = curatedOutfits.slice(0, limit);
    const recommendationSet: RecommendationSet = {
      outfits: resultOutfits,
      roles: resultOutfits.map((o) => o.role),
      generatedAt: localDate,
      algorithmVersion: this.version,
      requestContext: {
        occasion,
        season,
        localDate,
        explorationSeedOffset,
        anchorItemId,
      },
    };

    return {
      set: recommendationSet,
      telemetry: {
        candidateCount: totalGeneratedCount,
        validCandidateCount: scoredPool.length,
        timings: {
          candidateGenerationMs: Math.max(0, tGen1 - tGen0),
          hardFilteringMs: Math.max(0, tHard1 - tHard0),
          compatibilityMs: 0,
          scoringMs: Math.max(0, tScore1 - tScore0),
          diversificationMs: Math.max(0, tDiv1 - tDiv0),
          totalMs: Math.max(0, tEnd - t0),
        },
      },
    };
  }

  private buildExplanation(
    cand: {
      template: string;
      slots: Record<string, WardrobeItem[]>;
      score: number;
      scoreBreakdown: ScoreBreakdown;
      pieces: WardrobeItem[];
      culturalEvalReasons?: string[];
      knowledgeSignals?: FashionKnowledgeSignal[];
    },
    role: 'best_match' | 'alternative' | 'explore',
    occasion: Occasion,
    preferences?: any,
    styleProfile?: any,
    context?: any,
    anchorItem?: WardrobeItem
  ): RecommendationExplanation {
    const evidenceSources: ExplanationEvidenceSource[] = [];
    const reasons: string[] = [];

    // 0. Anchor Piece Synergy (evidence-backed pairing)
    if (anchorItem) {
      evidenceSources.push('compatibility');
      reasons.push(`Anchored around your ${anchorItem.name} with harmonious companion pieces`);
    }

    // 1. Weather evidence (ONLY when live or cached genuine weather)
    const hasGenuineWeather =
      context?.weather != null &&
      context.source !== 'simulated' &&
      context.source !== 'unavailable';

    if (hasGenuineWeather && Math.abs(cand.scoreBreakdown.contextFit) > 0.1) {
      const weatherReasons = getContextWhyReasons(cand.pieces, context);
      if (weatherReasons.length > 0) {
        evidenceSources.push('weather');
        reasons.push(weatherReasons[0]);
      }
    }

    // 2. Personal Style Brain evidence
    if (styleProfile && cand.scoreBreakdown.personalStyle > 0.2) {
      const personalReasons = getPersonalStyleExplanations(cand.pieces, occasion, styleProfile);
      if (personalReasons.length > 0) {
        evidenceSources.push('personal_style');
        reasons.push(personalReasons[0]);
      }
    }

    // 3. Cultural Evidence
    if (cand.culturalEvalReasons && cand.culturalEvalReasons.length > 0) {
      evidenceSources.push('cultural');
      reasons.push(cand.culturalEvalReasons[0]);
    }

    // 4. Role specific rationale
    if (role === 'explore') {
      evidenceSources.push('exploration');
      reasons.push('Introduces an under-explored piece while preserving a harmonious silhouette');
    } else if (role === 'alternative') {
      evidenceSources.push('compatibility');
      reasons.push(`Distinct silhouette variation using your ${cand.template.toLowerCase()}`);
    }

    // 5. IFKG Domain Compatibility Rationale
    if (reasons.length < 2 && cand.knowledgeSignals) {
      for (const s of cand.knowledgeSignals) {
        if (s.explanationKey && s.confidence >= 0.8 && s.strength > 0.5) {
          const domainExp = getExplanationForSignal(s);
          if (domainExp && !reasons.includes(domainExp) && reasons.length < 3) {
            evidenceSources.push('compatibility');
            reasons.push(domainExp);
          }
        }
      }
    }

    // 6. Baseline / Compatibility Fallback
    if (reasons.length < 2) {
      evidenceSources.push('compatibility');
      const standardReasons = getOutfitWhyReasons(
        cand.pieces,
        occasion,
        cand.score,
        preferences,
        styleProfile,
        context
      );
      for (const r of standardReasons) {
        if (!reasons.includes(r) && reasons.length < 3) {
          reasons.push(r);
        }
      }
    }

    if (reasons.length === 0) {
      evidenceSources.push('baseline');
      reasons.push('Balanced tonal pairing suitable for your daily routine');
    }

    let headline = 'Curated Daily Ensemble';
    if (role === 'best_match') headline = anchorItem ? 'Best Match · Anchored Ensemble' : 'Best Match · Highest Styling Affinity';
    else if (role === 'alternative') headline = anchorItem ? 'Alternative · Varied Silhouette' : 'Alternative · Varied Silhouette';
    else if (role === 'explore') headline = anchorItem ? 'Explore · Fresh Wardrobe Pairing' : 'Explore · Safe Wardrobe Discovery';

    return {
      headline,
      reasons: reasons.slice(0, 3),
      evidenceSources: Array.from(new Set(evidenceSources)),
    };
  }
}

/**
 * Functional wrapper for direct outfit recommendations.
 */
export function recommendOutfits(request: RecommendationRequest): RecommendedOutfit[] {
  const engine = new RecommendationEngine();
  return engine.recommend(request).set.outfits;
}

/**
 * Functional wrapper returning full recommendation set with pipeline telemetry.
 */
export function recommendOutfitsWithTelemetry(
  request: RecommendationRequest
): RecommendationResultWithTelemetry {
  const engine = new RecommendationEngine();
  return engine.recommend(request);
}
