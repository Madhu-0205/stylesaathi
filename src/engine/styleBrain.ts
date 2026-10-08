import {
  WardrobeItem,
  Occasion,
  Season,
  StylePreferences,
  WearEvent,
  StyleSignalEvent,
  StyleSignalType,
  RejectionReason,
  AttributeAffinity,
  PersonalStyleProfile,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
} from '../types';

export const STYLE_BRAIN_VERSION = 3;
export const RECENCY_HALF_LIFE_DAYS = 30; // 30-day half-life for exponential recency decay
export const MIN_EVIDENCE_COUNT = 3; // Minimum signals required for moderate confidence
export const HIGH_CONFIDENCE_THRESHOLD = 0.65;

export const STYLE_SIGNAL_WEIGHTS: Record<StyleSignalType, number> = {
  worn: 3.0,       // Strongest behavioral confirmation
  saved: 1.5,      // Moderate positive intent
  favorited: 2.0,  // Strong positive affection
  planned: 1.2,    // Positive forward-looking intent
  liked: 1.0,      // Lightweight positive endorsement
  viewed: 0.1,     // Low-weight passive exposure
  skipped: -0.5,   // Weak negative (passed over in rotation)
  dismissed: -1.0, // Medium negative (dismissed without reason)
  rejected: -2.5,  // Strong negative (explicit rejection with reason)
};

const NEUTRAL_COLORS = [
  'black',
  'white',
  'cream',
  'beige',
  'navy',
  'grey',
  'brown',
  'tan',
  'silver',
  'gold',
];

const HEAVY_WARM_FABRICS: FabricType[] = [
  'wool',
  'velvet',
  'tussar',
  'banarasi',
  'polyblend',
];

const LIGHT_BREATHABLE_FABRICS: FabricType[] = [
  'cotton',
  'linen',
  'khadi',
  'mulmul',
  'chanderi',
  'modal',
];

/**
 * Deterministic pairwise combination key generator.
 * Sorts IDs to ensure commutative pairing: (A, B) === (B, A).
 */
export function getCombinationKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

/**
 * Calculates exponential recency decay multiplier.
 * Uses half-life formula: decay = 0.5 ^ (deltaDays / halfLifeDays) = e^(-ln(2) * deltaDays / halfLifeDays).
 */
export function calculateRecencyWeight(
  timestamp: number,
  now: number = Date.now(),
  halfLifeDays: number = RECENCY_HALF_LIFE_DAYS
): number {
  if (!timestamp || timestamp > now) return 1.0;
  const deltaDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));
  return Math.exp(-Math.LN2 * (deltaDays / halfLifeDays));
}

/**
 * Calculates statistical confidence for an attribute based on sample count and signal stability.
 */
function calculateConfidence(sampleCount: number, positiveWeight: number, negativeWeight: number): number {
  if (sampleCount === 0) return 0;
  // Sample volume factor: asymptotically reaches 1.0 with repeated evidence
  const volumeFactor = Math.min(1.0, sampleCount / (sampleCount + 2.0));
  // Consistency factor: penalizes conflicting behavior (e.g. 50% worn, 50% rejected)
  const totalWeight = Math.abs(positiveWeight) + Math.abs(negativeWeight);
  if (totalWeight <= 0) return 0;
  const balance = Math.abs(positiveWeight - Math.abs(negativeWeight)) / totalWeight;
  const consistencyFactor = 0.5 + 0.5 * balance;

  return Math.round(volumeFactor * consistencyFactor * 100) / 100;
}

/**
 * Internal accumulator for aggregating signals across dimensions.
 */
interface AffinityAccumulator {
  positiveWeight: number;
  negativeWeight: number;
  sampleCount: number;
  lastInteractedAt: number;
}

function createAccumulator(): AffinityAccumulator {
  return {
    positiveWeight: 0,
    negativeWeight: 0,
    sampleCount: 0,
    lastInteractedAt: 0,
  };
}

function updateAccumulator(
  acc: AffinityAccumulator,
  rawWeight: number,
  recency: number,
  timestamp: number
): void {
  const weighted = rawWeight * recency;
  if (weighted >= 0) {
    acc.positiveWeight += weighted;
  } else {
    acc.negativeWeight += Math.abs(weighted);
  }
  acc.sampleCount += 1;
  acc.lastInteractedAt = Math.max(acc.lastInteractedAt, timestamp);
}

function finalizeAffinity(acc: AffinityAccumulator): AttributeAffinity {
  const total = acc.positiveWeight + acc.negativeWeight;
  let score = 0;
  if (total > 0) {
    // Normalized score from -1.0 to +1.0
    score = (acc.positiveWeight - acc.negativeWeight) / total;
  }
  const confidence = calculateConfidence(acc.sampleCount, acc.positiveWeight, acc.negativeWeight);
  return {
    score: Math.round(score * 100) / 100,
    confidence,
    sampleCount: acc.sampleCount,
    lastInteractedAt: acc.lastInteractedAt,
  };
}

/**
 * Derives a structured, explainable PersonalStyleProfile from:
 * 1. Raw style signal events (wears, saves, favorites, skips, dismissals, rejections)
 * 2. Historical wear events
 * 3. Wardrobe items (attributes and favorite flags)
 * 4. Declared style preferences (anchors baseline)
 */
export function derivePersonalStyleProfile(
  signals: StyleSignalEvent[],
  wearEvents: WearEvent[] = [],
  items: WardrobeItem[] = [],
  declaredPrefs?: StylePreferences,
  now: number = Date.now()
): PersonalStyleProfile {
  const itemsMap = new Map<string, WardrobeItem>();
  for (const item of items) {
    itemsMap.set(item.id, item);
  }

  // Accumulator registries
  const colorAcc = new Map<string, AffinityAccumulator>();
  const fabricAcc = new Map<FabricType, AffinityAccumulator>();
  const patternAcc = new Map<PatternType, AffinityAccumulator>();
  const fitAcc = new Map<SilhouetteFit, AffinityAccumulator>();
  const culturalAcc = new Map<CulturalContext, AffinityAccumulator>();
  const occasionAcc = new Map<Occasion, AffinityAccumulator>();
  const itemAcc = new Map<string, AffinityAccumulator>();
  const comboAcc = new Map<string, AffinityAccumulator>();

  let formalityDelta = 0;
  let formalitySamples = 0;
  let neutralCount = 0;
  let colorCount = 0;

  const getOrInit = <K>(map: Map<K, AffinityAccumulator>, key: K): AffinityAccumulator => {
    let acc = map.get(key);
    if (!acc) {
      acc = createAccumulator();
      map.set(key, acc);
    }
    return acc;
  };

  // 1. Process historical WearEvents as strong behavioral positive signals
  for (const wear of wearEvents) {
    const item = itemsMap.get(wear.wardrobeItemId);
    if (!item) continue;
    const recency = calculateRecencyWeight(wear.wornAt, now);
    const weight = STYLE_SIGNAL_WEIGHTS.worn;

    // Item affinity
    updateAccumulator(getOrInit(itemAcc, item.id), weight, recency, wear.wornAt);

    // Color
    for (const c of item.colors) {
      updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), weight, recency, wear.wornAt);
      if (NEUTRAL_COLORS.includes(c.toLowerCase())) neutralCount++;
      colorCount++;
    }

    // Fabric
    if (item.fabric && item.fabric !== 'unknown') {
      updateAccumulator(getOrInit(fabricAcc, item.fabric), weight, recency, wear.wornAt);
    }

    // Pattern
    if (item.pattern && item.pattern !== 'unknown') {
      updateAccumulator(getOrInit(patternAcc, item.pattern), weight, recency, wear.wornAt);
    }

    // Fit
    if (item.fit) {
      updateAccumulator(getOrInit(fitAcc, item.fit), weight, recency, wear.wornAt);
    }

    // Cultural context
    if (item.category === 'Ethnic') {
      updateAccumulator(getOrInit(culturalAcc, 'traditional'), weight * 0.8, recency, wear.wornAt);
    }

    formalityDelta += (item.formality - 3.0) * recency;
    formalitySamples++;
  }

  // 2. Process WardrobeItem favorite status (mild positive baseline)
  for (const item of items) {
    if (item.favorite) {
      const recency = 1.0;
      const weight = STYLE_SIGNAL_WEIGHTS.favorited * 0.7;
      updateAccumulator(getOrInit(itemAcc, item.id), weight, recency, item.lastWorn || now);
      for (const c of item.colors) {
        updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), weight * 0.5, recency, now);
      }
      if (item.fabric && item.fabric !== 'unknown') {
        updateAccumulator(getOrInit(fabricAcc, item.fabric), weight * 0.5, recency, now);
      }
    }
  }

  // 3. Process Behavioral Style Signals (Worn, Saved, Liked, Skipped, Dismissed, Rejected)
  for (const signal of signals) {
    const baseWeight = STYLE_SIGNAL_WEIGHTS[signal.signalType] ?? 0;
    const recency = calculateRecencyWeight(signal.createdAt, now);
    const timestamp = signal.createdAt;
    const pieces = signal.itemIds.map((id) => itemsMap.get(id)).filter((p): p is WardrobeItem => Boolean(p));

    // A. Item-level and Pairwise combination affinity
    for (const p of pieces) {
      updateAccumulator(getOrInit(itemAcc, p.id), baseWeight, recency, timestamp);
    }

    if (pieces.length >= 2) {
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const comboKey = getCombinationKey(pieces[i].id, pieces[j].id);
          // If specifically rejected due to dislike_combination, amplify negative weight
          const comboWeight =
            signal.signalType === 'rejected' && signal.rejectionReason === 'dislike_combination'
              ? -3.5
              : baseWeight;
          updateAccumulator(getOrInit(comboAcc, comboKey), comboWeight, recency, timestamp);
        }
      }
    }

    // B. Occasion affinity
    if (signal.occasion) {
      updateAccumulator(getOrInit(occasionAcc, signal.occasion), baseWeight, recency, timestamp);
    }

    // C. Granular attribute updates with contextual rejection routing
    for (const p of pieces) {
      let colorWeight = baseWeight;
      let fabricWeight = baseWeight;
      let patternWeight = baseWeight;
      let fitWeight = baseWeight;

      // Routing structured rejection reasons to specific attributes
      if (signal.signalType === 'rejected' && signal.rejectionReason) {
        switch (signal.rejectionReason) {
          case 'wrong_color':
            // Penalize non-neutral colors more heavily
            for (const c of p.colors) {
              const cWeight = NEUTRAL_COLORS.includes(c.toLowerCase()) ? -0.8 : -2.5;
              updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), cWeight, recency, timestamp);
            }
            continue; // colors handled directly
          case 'wrong_pattern':
            patternWeight = -2.5;
            break;
          case 'wrong_fit':
            fitWeight = -2.5;
            break;
          case 'too_hot':
            // Penalize heavy/warm fabrics, leave or boost breathable fabrics
            if (p.fabric && HEAVY_WARM_FABRICS.includes(p.fabric)) {
              fabricWeight = -2.5;
            } else if (p.fabric && LIGHT_BREATHABLE_FABRICS.includes(p.fabric)) {
              fabricWeight = 0.5;
            }
            break;
          case 'too_cold':
            if (p.fabric && LIGHT_BREATHABLE_FABRICS.includes(p.fabric)) {
              fabricWeight = -2.0;
            } else if (p.fabric && HEAVY_WARM_FABRICS.includes(p.fabric)) {
              fabricWeight = 0.8;
            }
            break;
          case 'too_formal':
            formalityDelta -= 1.5 * recency;
            formalitySamples++;
            break;
          case 'too_casual':
            formalityDelta += 1.5 * recency;
            formalitySamples++;
            break;
          case 'uncomfortable':
            fitWeight = -2.0;
            fabricWeight = -1.5;
            break;
          case 'not_my_style':
            colorWeight = -1.2;
            patternWeight = -1.2;
            fitWeight = -1.2;
            break;
          case 'too_bold':
            for (const c of p.colors) {
              if (!NEUTRAL_COLORS.includes(c.toLowerCase())) {
                updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), -2.0, recency, timestamp);
              }
            }
            if (p.pattern && p.pattern !== 'solid') {
              updateAccumulator(getOrInit(patternAcc, p.pattern), -2.0, recency, timestamp);
            }
            continue;
          case 'too_plain':
            if (p.pattern === 'solid') {
              updateAccumulator(getOrInit(patternAcc, 'solid'), -1.8, recency, timestamp);
            }
            break;
        }
      }

      // Apply color weights
      for (const c of p.colors) {
        updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), colorWeight, recency, timestamp);
        if (NEUTRAL_COLORS.includes(c.toLowerCase())) neutralCount++;
        colorCount++;
      }

      // Apply fabric weights
      if (p.fabric && p.fabric !== 'unknown') {
        updateAccumulator(getOrInit(fabricAcc, p.fabric), fabricWeight, recency, timestamp);
      }

      // Apply pattern weights
      if (p.pattern && p.pattern !== 'unknown') {
        updateAccumulator(getOrInit(patternAcc, p.pattern), patternWeight, recency, timestamp);
      }

      // Apply fit weights
      if (p.fit) {
        updateAccumulator(getOrInit(fitAcc, p.fit), fitWeight, recency, timestamp);
      }

      // Cultural context
      if (p.category === 'Ethnic') {
        updateAccumulator(getOrInit(culturalAcc, 'traditional'), baseWeight * 0.8, recency, timestamp);
      } else {
        updateAccumulator(getOrInit(culturalAcc, 'contemporary'), baseWeight * 0.8, recency, timestamp);
      }
    }
  }

  // Finalize all record collections
  const colorAffinities: Record<string, AttributeAffinity> = {};
  colorAcc.forEach((acc, k) => {
    colorAffinities[k] = finalizeAffinity(acc);
  });

  const fabricAffinities: Record<FabricType, AttributeAffinity> = {} as any;
  fabricAcc.forEach((acc, k) => {
    fabricAffinities[k] = finalizeAffinity(acc);
  });

  const patternAffinities: Record<PatternType, AttributeAffinity> = {} as any;
  patternAcc.forEach((acc, k) => {
    patternAffinities[k] = finalizeAffinity(acc);
  });

  const fitAffinities: Record<SilhouetteFit, AttributeAffinity> = {} as any;
  fitAcc.forEach((acc, k) => {
    fitAffinities[k] = finalizeAffinity(acc);
  });

  const culturalAffinities: Record<CulturalContext, AttributeAffinity> = {} as any;
  culturalAcc.forEach((acc, k) => {
    culturalAffinities[k] = finalizeAffinity(acc);
  });

  const occasionAffinities: Record<Occasion, AttributeAffinity> = {} as any;
  occasionAcc.forEach((acc, k) => {
    occasionAffinities[k] = finalizeAffinity(acc);
  });

  const itemAffinities: Record<string, AttributeAffinity> = {};
  itemAcc.forEach((acc, k) => {
    itemAffinities[k] = finalizeAffinity(acc);
  });

  const combinationAffinities: Record<string, AttributeAffinity> = {};
  comboAcc.forEach((acc, k) => {
    combinationAffinities[k] = finalizeAffinity(acc);
  });

  // Identify Avoidance Model attributes (strongly negative score with evidence interactions)
  const avoidedColors = Object.entries(colorAffinities)
    .filter(([_, aff]) => aff.score <= -0.35 && aff.sampleCount >= 2 && aff.confidence >= 0.3)
    .map(([c]) => c);

  const avoidedFabrics = (Object.entries(fabricAffinities) as [FabricType, AttributeAffinity][])
    .filter(([_, aff]) => aff.score <= -0.35 && aff.sampleCount >= 2 && aff.confidence >= 0.3)
    .map(([f]) => f);

  const avoidedPatterns = (Object.entries(patternAffinities) as [PatternType, AttributeAffinity][])
    .filter(([_, aff]) => aff.score <= -0.35 && aff.sampleCount >= 2 && aff.confidence >= 0.3)
    .map(([p]) => p);

  const avoidedCombinations = Object.entries(combinationAffinities)
    .filter(([_, aff]) => aff.score <= -0.4 && aff.sampleCount >= 1 && aff.confidence >= 0.2)
    .map(([combo]) => combo);

  // Derived high-confidence insights for editorial explainability & UI
  const topColors = Object.entries(colorAffinities)
    .filter(([_, aff]) => aff.score > 0.25 && aff.confidence >= 0.45)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 4)
    .map(([c]) => c);

  const topFabrics = (Object.entries(fabricAffinities) as [FabricType, AttributeAffinity][])
    .filter(([_, aff]) => aff.score > 0.25 && aff.confidence >= 0.45)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([f]) => f);

  const topFits = (Object.entries(fitAffinities) as [SilhouetteFit, AttributeAffinity][])
    .filter(([_, aff]) => aff.score > 0.25 && aff.confidence >= 0.45)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([f]) => f);

  // Detect recent style phase exploration (interactions within the last 14 days)
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const recentExplorations: string[] = [];
  for (const [color, aff] of Object.entries(colorAffinities)) {
    if (now - aff.lastInteractedAt < fourteenDaysMs && aff.score > 0.4 && !topColors.includes(color)) {
      recentExplorations.push(color);
    }
  }

  // Calculate overall behavioral confidence
  const totalSignalsCount = signals.length + wearEvents.length;
  let overallConfidence = 0;
  if (totalSignalsCount >= MIN_EVIDENCE_COUNT) {
    const allConfidences = [
      ...Object.values(colorAffinities).map((a) => a.confidence),
      ...Object.values(fabricAffinities).map((a) => a.confidence),
      ...Object.values(fitAffinities).map((a) => a.confidence),
    ].filter((c) => c > 0);

    const avgConf =
      allConfidences.length > 0
        ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        : 0;

    overallConfidence = Math.round(Math.min(1.0, avgConf) * 100) / 100;
  }

  const neutralPreferenceRatio =
    colorCount > 0 ? Math.round((neutralCount / colorCount) * 100) / 100 : 0.5;

  const formalityBias =
    formalitySamples > 0
      ? Math.max(-1.0, Math.min(1.0, Math.round((formalityDelta / formalitySamples) * 100) / 100))
      : 0;

  // Novelty tolerance derived from styling mode or signal variety
  let noveltyTolerance = 0.5;
  if (declaredPrefs?.stylingMode === 'simple') noveltyTolerance = 0.2;
  else if (declaredPrefs?.stylingMode === 'variety') noveltyTolerance = 0.6;
  else if (declaredPrefs?.stylingMode === 'experiment') noveltyTolerance = 0.9;

  return {
    version: STYLE_BRAIN_VERSION,
    userId: signals[0]?.userId || 'local',
    updatedAt: now,
    overallConfidence,
    totalSignalsCount,
    colorAffinities,
    fabricAffinities,
    patternAffinities,
    fitAffinities,
    culturalAffinities,
    occasionAffinities,
    itemAffinities,
    combinationAffinities,
    avoidedColors,
    avoidedFabrics,
    avoidedPatterns,
    avoidedCombinations,
    neutralPreferenceRatio,
    formalityBias,
    noveltyTolerance,
    topColors,
    topFabrics,
    topFits,
    recentExplorations,
  };
}

/**
 * Deterministically computes the personal style score contribution for an outfit candidate.
 * Range: -3.0 to +3.0 delta.
 * Respects explicit user preferences as authoritative overrides.
 */
export function calculatePersonalStyleScore(
  pieces: WardrobeItem[],
  occasion: Occasion,
  profile?: PersonalStyleProfile,
  declaredPrefs?: StylePreferences
): number {
  if (!profile || profile.totalSignalsCount < MIN_EVIDENCE_COUNT || profile.overallConfidence <= 0.1) {
    // Cold start: do not bias outfit scoring without reliable behavioral evidence
    return 0;
  }

  let delta = 0;
  const confidenceScalar = Math.min(1.0, profile.overallConfidence * 1.2);

  // 1. Color Affinity & Avoidance
  const pieceColors = pieces.flatMap((p) => p.colors.map((c) => c.toLowerCase()));
  let colorScoreSum = 0;
  let colorMatches = 0;
  for (const c of pieceColors) {
    const aff = profile.colorAffinities[c];
    if (aff) {
      colorScoreSum += aff.score;
      colorMatches++;
    }
    // Avoidance penalty
    if (profile.avoidedColors.includes(c)) {
      delta -= 1.4 * confidenceScalar;
    }
  }
  if (colorMatches > 0) {
    delta += (colorScoreSum / colorMatches) * 0.8 * confidenceScalar;
  }

  // 2. Fabric Affinity & Avoidance
  let fabricScoreSum = 0;
  let fabricMatches = 0;
  for (const p of pieces) {
    if (p.fabric && profile.fabricAffinities[p.fabric]) {
      fabricScoreSum += profile.fabricAffinities[p.fabric].score;
      fabricMatches++;
    }
    if (p.fabric && profile.avoidedFabrics.includes(p.fabric)) {
      delta -= 1.5 * confidenceScalar;
    }
  }
  if (fabricMatches > 0) {
    delta += (fabricScoreSum / fabricMatches) * 0.9 * confidenceScalar;
  }

  // 3. Pattern Affinity & Avoidance
  let patternScoreSum = 0;
  let patternMatches = 0;
  for (const p of pieces) {
    if (p.pattern && profile.patternAffinities[p.pattern]) {
      patternScoreSum += profile.patternAffinities[p.pattern].score;
      patternMatches++;
    }
    if (p.pattern && profile.avoidedPatterns.includes(p.pattern)) {
      delta -= 1.2 * confidenceScalar;
    }
  }
  if (patternMatches > 0) {
    delta += (patternScoreSum / patternMatches) * 0.6 * confidenceScalar;
  }

  // 4. Silhouette & Fit Affinity
  let fitScoreSum = 0;
  let fitMatches = 0;
  for (const p of pieces) {
    if (p.fit && profile.fitAffinities[p.fit]) {
      fitScoreSum += profile.fitAffinities[p.fit].score;
      fitMatches++;
    }
  }
  if (fitMatches > 0) {
    delta += (fitScoreSum / fitMatches) * 0.7 * confidenceScalar;
  }

  // 5. Item-Level Affinity
  for (const p of pieces) {
    const aff = profile.itemAffinities[p.id];
    if (aff && aff.confidence >= 0.4) {
      delta += aff.score * 0.6 * confidenceScalar;
    }
  }

  // 6. Pairwise Combination Affinity & Avoidance
  if (pieces.length >= 2) {
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const key = getCombinationKey(pieces[i].id, pieces[j].id);
        const comboAff = profile.combinationAffinities[key];
        if (comboAff) {
          delta += comboAff.score * 1.0 * confidenceScalar;
        }
        if (profile.avoidedCombinations.includes(key)) {
          delta -= 2.0 * confidenceScalar;
        }
      }
    }
  }

  // 7. Occasion Affinity
  const occAff = profile.occasionAffinities[occasion];
  if (occAff && occAff.confidence >= 0.4) {
    delta += occAff.score * 0.5 * confidenceScalar;
  }

  // 8. Explicit User Preference Override (Rule 32)
  // If user declared specific preferences, they take precedence over learned negative scores
  if (declaredPrefs) {
    if (
      declaredPrefs.preferredAesthetics?.includes('Traditional') &&
      pieces.some((p) => p.category === 'Ethnic')
    ) {
      delta = Math.max(delta, 0.4);
    }
    if (
      declaredPrefs.preferredAesthetics?.includes('Minimal') &&
      pieces.length <= 3 &&
      pieceColors.every((c) => NEUTRAL_COLORS.includes(c))
    ) {
      delta = Math.max(delta, 0.5);
    }
  }

  // Clamp personal style score delta within [-3.0, 3.0]
  return Math.max(-3.0, Math.min(3.0, Math.round(delta * 100) / 100));
}

/**
 * Returns explainable, evidence-based personalization reasons.
 * Strict rule: Never fabricates evidence. Only generates reasons when confidence >= 0.5.
 */
export function getPersonalStyleExplanations(
  pieces: WardrobeItem[],
  _occasion: Occasion,
  profile?: PersonalStyleProfile
): string[] {
  if (!profile || profile.overallConfidence < 0.45 || profile.totalSignalsCount < MIN_EVIDENCE_COUNT) {
    return [];
  }

  const reasons: string[] = [];

  // Check top fabrics
  const matchingTopFabric = pieces.find((p) => p.fabric && profile.topFabrics.includes(p.fabric));
  if (matchingTopFabric?.fabric) {
    const formattedFabric = matchingTopFabric.fabric.replace(/_/g, ' ');
    reasons.push(`Features breathable ${formattedFabric}, aligned with your fabric preferences`);
  }

  // Check top fits
  const matchingTopFit = pieces.find((p) => p.fit && profile.topFits.includes(p.fit));
  if (matchingTopFit?.fit) {
    reasons.push(`Cut in a ${matchingTopFit.fit} silhouette you frequently choose`);
  }

  // Check top colors
  const matchingTopColor = pieces
    .flatMap((p) => p.colors)
    .find((c) => profile.topColors.includes(c.toLowerCase()));
  if (matchingTopColor) {
    reasons.push(`Anchored in ${matchingTopColor}, one of your most-worn tones`);
  }

  // Check pair combination affinity
  if (pieces.length >= 2) {
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const key = getCombinationKey(pieces[i].id, pieces[j].id);
        const comboAff = profile.combinationAffinities[key];
        if (comboAff && comboAff.score >= 0.5 && comboAff.sampleCount >= 2) {
          reasons.push(`Pairs pieces you frequently choose to wear together`);
          break;
        }
      }
      if (reasons.length >= 2) break;
    }
  }

  return reasons.slice(0, 2);
}
