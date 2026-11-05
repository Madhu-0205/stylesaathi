import {
  WardrobeItem,
  Occasion,
  Season,
  ContextSnapshot,
  StylePreferences,
  PersonalStyleProfile,
} from '../../types';
import { enrichWardrobeItem } from '../features/featureEnricher';
import { classifyGarmentPair } from './pairClassifier';
import { evaluatePairHardIncompatibility } from './hardIncompatibility';
import { evaluateColorDimension } from './dimensions/colorDimension';
import { evaluateSilhouetteDimension } from './dimensions/silhouetteDimension';
import { evaluateFabricDimension } from './dimensions/fabricDimension';
import { evaluatePatternDimension } from './dimensions/patternDimension';
import { evaluateFormalityDimension } from './dimensions/formalityDimension';
import { evaluateCulturalPairSynergy } from './culturalPairEngine';
import {
  PairwiseCompatibilityResult,
  DimensionEvaluation,
  CompatibilityClassification,
  PersonalizationAdjustment,
} from './types';

export interface PairwiseEvaluationOptions {
  occasion?: Occasion;
  season?: Season;
  context?: ContextSnapshot;
  preferences?: StylePreferences;
  styleProfile?: PersonalStyleProfile;
  allowPlanningMode?: boolean;
}

/**
 * StyleSaathi 3.0 — Pairwise Garment Compatibility Engine
 *
 * Evaluates the multidimensional compatibility between two actual wardrobe garments.
 * Combines physical constraints, color harmony, silhouette proportions, fabric physics,
 * pattern interactions, formality, cultural/regional synergy, and Bayesian personalization.
 */
export class PairwiseCompatibilityEngine {
  readonly version = '3.0.0';

  /**
   * Evaluates pairwise compatibility between two wardrobe items.
   */
  public evaluate(
    rawItemA: WardrobeItem,
    rawItemB: WardrobeItem,
    options: PairwiseEvaluationOptions = {}
  ): PairwiseCompatibilityResult {
    const { occasion, season, context, preferences, styleProfile, allowPlanningMode } = options;

    // 1. Dynamic Attribute Enrichment & Normalization
    const itemA = enrichWardrobeItem(rawItemA);
    const itemB = enrichWardrobeItem(rawItemB);

    // 2. Classify Relationship Type
    const pairType = classifyGarmentPair(itemA, itemB);

    // 3. Evaluate Deterministic Tier 1 Hard Incompatibility Constraints
    const hardCheck = evaluatePairHardIncompatibility(itemA, itemB, pairType, {
      context,
      preferences,
      occasion,
      allowPlanningMode,
    });

    if (hardCheck.isIncompatible) {
      return {
        itemAId: itemA.id,
        itemBId: itemB.id,
        pairType,
        isHardIncompatible: true,
        hardIncompatibilityReason: hardCheck.reason,
        overallScore: 0.0,
        normalizedScore: -1.0,
        classification: 'hard_incompatible',
        confidence: 1.0,
        activeDimensions: [],
        explanations: [hardCheck.reason || 'Hard incompatibility constraint violated.'],
        uncertaintyNotes: [],
        needsUserConfirmation: false,
      };
    }

    // 4. Multidimensional Compatibility Evaluations
    const dimensions: DimensionEvaluation[] = [];

    // A. Color Harmony Dimension
    dimensions.push(evaluateColorDimension(itemA, itemB));

    // B. Silhouette & Proportion Dimension
    dimensions.push(evaluateSilhouetteDimension(itemA, itemB, pairType, preferences));

    // C. Fabric & Texture Dimension
    dimensions.push(evaluateFabricDimension(itemA, itemB, pairType));

    // D. Pattern Interaction Dimension
    dimensions.push(evaluatePatternDimension(itemA, itemB));

    // E. Formality Alignment Dimension
    dimensions.push(evaluateFormalityDimension(itemA, itemB, occasion));

    // F. Cultural & Regional Synergy Dimension
    const culturalResult = evaluateCulturalPairSynergy(itemA, itemB, occasion, preferences);
    dimensions.push(culturalResult.evaluation);

    // Filter to active applied dimensions
    const activeDimensions = dimensions.filter((d) => d.applied);

    // 5. Uncertainty Propagation & Missing Data Neutrality
    const uncertaintyNotes: string[] = [];
    let needsUserConfirmation = false;

    for (const d of activeDimensions) {
      if (d.evidenceSource === 'unknown' || d.confidence === 0.0) {
        uncertaintyNotes.push(d.reason);
        needsUserConfirmation = true;
      }
    }

    const itemNeedsConf = (item: WardrobeItem) =>
      (item as any).needsUserConfirmation === true ||
      (!item.userVerified && typeof item.aiConfidence === 'number' && item.aiConfidence <= 0.35);

    if (itemNeedsConf(itemA) || itemNeedsConf(itemB)) {
      needsUserConfirmation = true;
      uncertaintyNotes.push('One or both garments require user confirmation of inferred tags.');
    }

    // Mathematical aggregation: weighted sum normalized by verified evidence certainty
    let weightedScoreSum = 0;
    let totalEffectiveWeight = 0;
    let confidenceSum = 0;

    for (const d of activeDimensions) {
      // Dimensions with confidence 0.0 contribute 0 to the sum and 0 to effective weight (neutral 0.0)
      const effWeight = d.weight * d.confidence;
      weightedScoreSum += d.score * effWeight;
      totalEffectiveWeight += effWeight;
      confidenceSum += d.confidence;
    }

    const rawNormalizedScore =
      totalEffectiveWeight > 0 ? weightedScoreSum / totalEffectiveWeight : 0.0;

    const aggregateConfidence =
      activeDimensions.length > 0 ? confidenceSum / activeDimensions.length : 0.5;

    // Non-compensatory clash penalty:
    // In fashion styling, a severe visual clash (e.g. chromatic clash, competing busy prints,
    // or sheer-on-rigid denim clash) cannot be washed away by generic "both are casual" formality points.
    let baselineNormalizedScore = rawNormalizedScore;
    const severeNegativeDimensions = activeDimensions.filter(
      (d) =>
        (d.dimension === 'color_harmony' ||
          d.dimension === 'pattern_interaction' ||
          d.dimension === 'fabric_texture') &&
        d.score <= -0.4 &&
        d.confidence >= 0.7
    );
    if (severeNegativeDimensions.length > 0) {
      const minClashScore = Math.min(...severeNegativeDimensions.map((d) => d.score));
      baselineNormalizedScore = Math.min(baselineNormalizedScore, minClashScore);
    }

    // Uncertainty shrinkage towards uninformative prior mean (0.0 normalized = 5.0/10)
    // If critical attributes (color, fabric, pattern) are unknown,
    // contract score toward 0.0 so unverified items never claim false high compatibility.
    const unknownDimensionsCount = activeDimensions.filter((d) => d.evidenceSource === 'unknown').length;
    let shrinkageFactor = 1.0;

    if (unknownDimensionsCount >= 3 || (needsUserConfirmation && unknownDimensionsCount >= 2)) {
      shrinkageFactor = 0.0; // Completely unknown pieces revert strictly to prior mean (5.0 / 10.0)
    } else if (unknownDimensionsCount > 0 || needsUserConfirmation) {
      shrinkageFactor = Math.max(0.2, aggregateConfidence);
    }

    baselineNormalizedScore = baselineNormalizedScore * shrinkageFactor;

    // 6. Bayesian Personalization Adjustments (Soft Bias Only)
    let personalizationDelta = 0;
    const personalizationReasons: string[] = [];

    if (styleProfile) {
      // Color preference affinity
      const userColors = (itemA.colors || []).concat(itemB.colors || []);
      for (const c of userColors) {
        const cLower = c.toLowerCase();
        const colorPref = styleProfile.colorAffinities?.[cLower];
        if (
          colorPref &&
          (colorPref.sampleCount >= 2 ||
            (colorPref as any).observationCount >= 2 ||
            (colorPref.provenance && colorPref.provenance.observationCount >= 2))
        ) {
          const delta = (colorPref.score - 0.5) * 0.15; // Small normalized delta
          personalizationDelta += delta;
          if (Math.abs(delta) >= 0.05) {
            personalizationReasons.push(
              `${delta > 0 ? 'Favored' : 'Less favored'} color preference for ${cLower}.`
            );
          }
        }
      }

      // Pair combination affinity (if specific interaction recorded)
      const pairKey1 = `${itemA.category}:${itemB.category}`.toLowerCase();
      const pairKey2 = `${itemB.category}:${itemA.category}`.toLowerCase();
      const comboWeight =
        styleProfile.combinationAffinities?.[pairKey1] ??
        styleProfile.combinationAffinities?.[pairKey2];

      if (typeof comboWeight === 'number' && comboWeight !== 0) {
        const comboDelta = Math.max(-0.25, Math.min(0.25, comboWeight * 0.05));
        personalizationDelta += comboDelta;
        personalizationReasons.push('Personal pairing history adjusted preference score.');
      }
    }

    // Aesthetic preference alignment
    if (preferences?.preferredAesthetics && preferences.preferredAesthetics.length > 0) {
      const preferred = preferences.preferredAesthetics.map((a) => a.toLowerCase());
      if (
        (preferred.includes('traditional') && culturalResult.culturalContext.synergyType === 'traditional_ensemble') ||
        (preferred.includes('indo-western') && culturalResult.culturalContext.synergyType === 'indo_western_fusion')
      ) {
        personalizationDelta += 0.1;
        personalizationReasons.push(`Matches declared "${preferences.preferredAesthetics[0]}" aesthetic preference.`);
      }
    }

    // Clamp personalization delta to safe soft range [-0.25, +0.25]
    personalizationDelta = Math.max(-0.25, Math.min(0.25, personalizationDelta));

    const finalNormalizedScore = Math.max(
      -1.0,
      Math.min(1.0, baselineNormalizedScore + personalizationDelta)
    );

    // Map [-1.0, 1.0] to [0.0, 10.0]
    const overallScore = Math.round(((finalNormalizedScore + 1.0) / 2.0) * 10.0 * 10) / 10;

    // 7. Classification Determination
    let classification: CompatibilityClassification = 'neutral';
    if (overallScore >= 8.0) classification = 'highly_compatible';
    else if (overallScore >= 6.0) classification = 'compatible';
    else if (overallScore >= 4.0) classification = 'neutral';
    else classification = 'clashing';

    // 8. Human-Readable Explanations
    const explanations: string[] = [];

    // Prioritize prominent driver reasons
    const sortedDimensions = [...activeDimensions].sort(
      (a, b) => Math.abs(b.score * b.confidence) - Math.abs(a.score * a.confidence)
    );

    for (const d of sortedDimensions) {
      if (d.confidence > 0.4 && Math.abs(d.score) >= 0.5) {
        explanations.push(d.reason);
      }
    }

    if (explanations.length === 0) {
      explanations.push(
        `Balanced pairing between ${itemA.name} and ${itemB.name} with consistent styling.`
      );
    }

    const personalizationAdjustment: PersonalizationAdjustment | undefined =
      personalizationReasons.length > 0
        ? {
            delta: Math.round(personalizationDelta * 100) / 100,
            reasons: personalizationReasons,
          }
        : undefined;

    return {
      itemAId: itemA.id,
      itemBId: itemB.id,
      pairType,
      isHardIncompatible: false,
      overallScore,
      normalizedScore: Math.round(finalNormalizedScore * 100) / 100,
      classification,
      confidence: Math.round(aggregateConfidence * 100) / 100,
      activeDimensions,
      culturalContext: culturalResult.culturalContext,
      personalizationAdjustment,
      explanations,
      uncertaintyNotes,
      needsUserConfirmation,
    };
  }
}

export const pairwiseCompatibilityEngine = new PairwiseCompatibilityEngine();
