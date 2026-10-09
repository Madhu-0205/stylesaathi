import {
  WardrobeItem,
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

    // Filter available pieces (season fit & basic clean availability)
    const eligiblePool = items.filter(
      (i) => i.status === 'clean' && seasonFit(i, season)
    );

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

    for (const t of occasionTemplates) {
      const slotCandidates: Record<string, WardrobeItem[]> = {};
      let hasAllRequired = true;

      for (const [slot] of Object.entries(t.required)) {
        const matching = eligiblePool.filter((i) => compatible(slot, i, t));
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
          break;
        }
        slotCandidates[slot] = ranked;
      }

      if (!hasAllRequired) continue;

      for (const [slot] of Object.entries(t.optional)) {
        const matching = eligiblePool.filter((i) => compatible(slot, i, t));
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
        template: t,
        slotCandidates,
        requiredKeys: Object.keys(t.required),
      });
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
      const hardCheck = evaluateTier1HardConstraints(cand, context);
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
          context
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
            context
          ),
          why: '',
          knowledgeSignals: alternativeCandidate.knowledgeSignals,
        };
        alternativeOutfit.why = alternativeOutfit.explanation.reasons.join(' · ');
        curatedOutfits.push(alternativeOutfit);
      }

      // Role 3: EXPLORE (Controlled novelty inside safe preference boundary)
      const wardrobeFingerprint = computeWardrobeFingerprint(items.map((i) => i.id));
      const deterministicSeedKey = `${localDate}|${occasion}|${wardrobeFingerprint}|v2|${explorationSeedOffset}`;

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
            context
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
    context?: any
  ): RecommendationExplanation {
    const evidenceSources: ExplanationEvidenceSource[] = [];
    const reasons: string[] = [];

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
    if (role === 'best_match') headline = 'Best Match · Highest Styling Affinity';
    else if (role === 'alternative') headline = 'Alternative · Varied Silhouette';
    else if (role === 'explore') headline = 'Explore · Safe Wardrobe Discovery';

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
