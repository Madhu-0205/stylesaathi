import {
  WardrobeItem,
  Occasion,
  Season,
  Category,
  StylePreferences,
  WearEvent,
  StyleSignalEvent,
  StyleSignalType,
  RejectionReason,
  PreferenceStatus,
  PreferenceEvidenceProvenance,
  AttributeAffinity,
  PersonalStyleProfile,
  ContextualPreferenceSlice,
  ContextualPreferences,
  FabricType,
  PatternType,
  SilhouetteFit,
  CulturalContext,
} from '../types';

export const STYLE_BRAIN_VERSION = 4;
export const RECENCY_HALF_LIFE_DAYS = 30; // 30-day half-life for exponential recency decay
export const MIN_EVIDENCE_COUNT = 3; // Minimum signals required for moderate confidence
export const HIGH_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Differentiated Evidence Signal Weights:
 *
 * 1. Physical / Ground-Truth Adoption:
 *    - worn (3.0): Highest behavioral proof of physical satisfaction.
 * 2. Active User Affection & Forward Intent:
 *    - favorited (2.0): Persistent positive affection.
 *    - saved (1.5): Curated to Lookbook. Note: Saved is interest, NOT proof of physical satisfaction.
 *    - planned (1.2): Scheduled on Calendar for upcoming wear.
 * 3. Active Lightweight Interactions:
 *    - liked (1.0): Lightweight positive endorsement.
 *    - selected (0.8): Active garment selection as anchor or focus piece.
 *    - inspected (0.3): Clicked to view garment detail modal (dwell signal).
 * 4. Passive Exposures:
 *    - viewed / displayed (0.1): Passive carousel or list impression (near-zero evidentiary weight).
 * 5. Negative / Rejection Signals:
 *    - skipped (-0.5): Weak negative (passed over in rotation without interaction).
 *    - dismissed (-1.0): Medium negative (dismissed card without explicit reason).
 *    - rejected (-2.5): Strong negative (explicit rejection with structured diagnostic reason).
 */
export const STYLE_SIGNAL_WEIGHTS: Record<StyleSignalType, number> = {
  worn: 3.0,
  favorited: 2.0,
  saved: 1.5,
  planned: 1.2,
  liked: 1.0,
  selected: 0.8,
  inspected: 0.3,
  viewed: 0.1,
  displayed: 0.1,
  skipped: -0.5,
  dismissed: -1.0,
  rejected: -2.5,
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
 * Calculates statistical confidence for an attribute based on sample volume and signal consistency.
 * Continuous, deterministic formulation in [0.0, 1.0].
 */
function calculateConfidence(
  sampleCount: number,
  positiveWeight: number,
  negativeWeight: number
): number {
  if (sampleCount === 0) return 0;
  // Volume factor: asymptotically approaches 1.0 with repeated evidence
  const volumeFactor = Math.min(1.0, sampleCount / (sampleCount + 2.0));
  // Consistency factor: penalizes contradictory signals (e.g. 50% worn, 50% rejected)
  const totalWeight = Math.abs(positiveWeight) + Math.abs(negativeWeight);
  if (totalWeight <= 0) return 0;
  const balance = Math.abs(positiveWeight - Math.abs(negativeWeight)) / totalWeight;
  const consistencyFactor = 0.5 + 0.5 * balance;

  return Math.round(volumeFactor * consistencyFactor * 100) / 100;
}

/**
 * Internal Bayesian Accumulator tracking priors and observed evidence pseudo-counts.
 */
interface BayesianAccumulator {
  priorAlpha: number;
  priorBeta: number;
  effectivePositive: number;
  effectiveNegative: number;
  sampleCount: number;
  lastInteractedAt: number;
  signalCounts: Partial<Record<StyleSignalType, number>>;
  isExplicit: boolean;
  isObserved: boolean;
  isInferred: boolean;
  contextualPositive: Map<Occasion, number>;
  contextualNegative: Map<Occasion, number>;
  contextualCounts: Map<Occasion, number>;
}

function createAccumulator(priorAlpha = 1.0, priorBeta = 1.0, isExplicit = false): BayesianAccumulator {
  return {
    priorAlpha,
    priorBeta,
    effectivePositive: 0,
    effectiveNegative: 0,
    sampleCount: 0,
    lastInteractedAt: 0,
    signalCounts: {},
    isExplicit,
    isObserved: false,
    isInferred: false,
    contextualPositive: new Map(),
    contextualNegative: new Map(),
    contextualCounts: new Map(),
  };
}

function updateAccumulator(
  acc: BayesianAccumulator,
  signalType: StyleSignalType,
  rawWeight: number,
  recency: number,
  correlationFactor: number = 1.0, // 1 / sqrt(ensembleSize)
  timestamp: number = Date.now(),
  occasion?: Occasion,
  isObservedEvent: boolean = false,
  isInferredEvent: boolean = false
): void {
  const weighted = rawWeight * recency * correlationFactor;
  if (weighted >= 0) {
    acc.effectivePositive += weighted;
  } else {
    acc.effectiveNegative += Math.abs(weighted);
  }
  acc.sampleCount += 1;
  acc.lastInteractedAt = Math.max(acc.lastInteractedAt, timestamp);
  acc.signalCounts[signalType] = (acc.signalCounts[signalType] || 0) + 1;
  if (isObservedEvent) acc.isObserved = true;
  if (isInferredEvent) acc.isInferred = true;

  if (occasion) {
    const curPos = acc.contextualPositive.get(occasion) || 0;
    const curNeg = acc.contextualNegative.get(occasion) || 0;
    const curCount = acc.contextualCounts.get(occasion) || 0;
    if (weighted >= 0) {
      acc.contextualPositive.set(occasion, curPos + weighted);
    } else {
      acc.contextualNegative.set(occasion, curNeg + Math.abs(weighted));
    }
    acc.contextualCounts.set(occasion, curCount + 1);
  }
}

/**
 * Finalizes Bayesian estimation for an attribute accumulator.
 *
 * Mathematical formulation:
 * - Prior: Beta(alpha_0, beta_0)
 * - Posterior: Beta(alpha, beta) where alpha = alpha_0 + sum(pos_w), beta = beta_0 + sum(neg_w)
 * - Expected value: E[theta] = alpha / (alpha + beta)
 * - Normalized score: mu = (alpha - beta) / (alpha + beta) in [-1.0, +1.0]
 * - Posterior variance: Var(theta) = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
 * - Bayesian 95% Credible Interval: [L, U] via normal approximation to Beta
 * - Preference Status: explicit | observed | inferred | unknown | contradictory
 */
function finalizeAffinity(acc: BayesianAccumulator): AttributeAffinity {
  const totalEvidence = acc.effectivePositive + acc.effectiveNegative;

  // Unobserved with flat prior: remains neutral unknown with 0 score and 0 confidence
  if (acc.sampleCount === 0 && !acc.isExplicit) {
    const alpha = acc.priorAlpha;
    const beta = acc.priorBeta;
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    return {
      score: 0,
      confidence: 0,
      sampleCount: 0,
      lastInteractedAt: 0,
      status: 'unknown',
      alpha,
      beta,
      variance: Math.round(variance * 10000) / 10000,
      uncertainty: 1.0,
      provenance: {
        status: 'unknown',
        observationCount: 0,
        alpha,
        beta,
        variance: Math.round(variance * 10000) / 10000,
        uncertainty: 1.0,
        credibleInterval: [-0.95, 0.95],
        signalCounts: {},
        lastInteractedAt: 0,
        isExplicitOverride: false,
      },
    };
  }

  const alpha = acc.priorAlpha + acc.effectivePositive;
  const beta = acc.priorBeta + acc.effectiveNegative;
  const meanTheta = alpha / (alpha + beta);

  // When explicit, the informative prior anchors the score against noise and weak evidence.
  // When unobserved and non-explicit, score is 0.
  // When observed, empirical evidence drives score directly.
  let score = 0;
  if (acc.isExplicit) {
    score = Math.round(((alpha - beta) / (alpha + beta)) * 100) / 100;
  } else if (totalEvidence > 0) {
    score = Math.round(((acc.effectivePositive - acc.effectiveNegative) / totalEvidence) * 100) / 100;
  }

  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const stdDev = Math.sqrt(variance);

  // 95% Bayesian credible interval in [-1.0, +1.0] score space
  const lowerTheta = Math.max(0, meanTheta - 1.96 * stdDev);
  const upperTheta = Math.min(1, meanTheta + 1.96 * stdDev);
  const lowerScore = Math.round((2 * lowerTheta - 1) * 100) / 100;
  const upperScore = Math.round((2 * upperTheta - 1) * 100) / 100;

  // Statistical confidence & uncertainty
  const confidence = calculateConfidence(acc.sampleCount, acc.effectivePositive, acc.effectiveNegative);
  const uncertainty = Math.round(Math.max(0, Math.min(1.0, 1.0 - confidence)) * 100) / 100;

  // Status classification
  let status: PreferenceStatus = 'unknown';
  const balance = totalEvidence > 0 ? Math.abs(acc.effectivePositive - acc.effectiveNegative) / totalEvidence : 1.0;

  if (acc.isExplicit) {
    // If user explicitly stated preference, but accumulated heavy contrary feedback
    if (acc.effectiveNegative > 3.5 && acc.effectiveNegative > acc.effectivePositive) {
      status = 'contradictory';
    } else {
      status = 'explicit';
    }
  } else if (acc.sampleCount === 0 || totalEvidence < 0.1) {
    status = 'unknown';
  } else if (acc.effectivePositive >= 1.5 && acc.effectiveNegative >= 1.5 && balance < 0.35) {
    status = 'contradictory';
  } else if (acc.isObserved) {
    status = 'observed';
  } else {
    status = 'inferred';
  }

  // Contextual score slices
  const contextualScores: Partial<Record<Occasion, number>> = {};
  acc.contextualCounts.forEach((_, occ) => {
    const pos = acc.contextualPositive.get(occ) || 0;
    const neg = acc.contextualNegative.get(occ) || 0;
    const ctxAlpha = acc.priorAlpha + pos;
    const ctxBeta = acc.priorBeta + neg;
    const ctxScore = (ctxAlpha - ctxBeta) / (ctxAlpha + ctxBeta);
    contextualScores[occ] = Math.round(ctxScore * 100) / 100;
  });

  const provenance: PreferenceEvidenceProvenance = {
    status,
    observationCount: acc.sampleCount,
    alpha: Math.round(alpha * 100) / 100,
    beta: Math.round(beta * 100) / 100,
    variance: Math.round(variance * 10000) / 10000,
    uncertainty,
    credibleInterval: [lowerScore, upperScore],
    signalCounts: { ...acc.signalCounts },
    lastInteractedAt: acc.lastInteractedAt,
    isExplicitOverride: acc.isExplicit,
  };

  return {
    score,
    confidence,
    sampleCount: acc.sampleCount,
    lastInteractedAt: acc.lastInteractedAt,
    status,
    alpha: Math.round(alpha * 100) / 100,
    beta: Math.round(beta * 100) / 100,
    variance: Math.round(variance * 10000) / 10000,
    uncertainty,
    provenance,
    contextualScores: Object.keys(contextualScores).length > 0 ? contextualScores : undefined,
  };
}

/**
 * Derives a structured, explainable, Bayesian-calibrated PersonalStyleProfile from:
 * 1. Raw style signal events (wears, saves, favorites, skips, dismissals, rejections)
 * 2. Historical wear events (ground-truth physical confirmation)
 * 3. Wardrobe items (attributes and favorite flags)
 * 4. Declared style preferences (anchoring authoritative explicit priors)
 */
export function derivePersonalStyleProfile(
  signals: StyleSignalEvent[] = [],
  wearEvents: WearEvent[] = [],
  items: WardrobeItem[] = [],
  declaredPrefs?: StylePreferences,
  now: number = Date.now()
): PersonalStyleProfile {
  const itemsMap = new Map<string, WardrobeItem>();
  for (const item of items) {
    itemsMap.set(item.id, item);
  }

  // Accumulator registries across all 10 core dimensions
  const colorAcc = new Map<string, BayesianAccumulator>();
  const fabricAcc = new Map<FabricType, BayesianAccumulator>();
  const patternAcc = new Map<PatternType, BayesianAccumulator>();
  const fitAcc = new Map<SilhouetteFit, BayesianAccumulator>();
  const culturalAcc = new Map<CulturalContext, BayesianAccumulator>();
  const occasionAcc = new Map<Occasion, BayesianAccumulator>();
  const itemAcc = new Map<string, BayesianAccumulator>();
  const comboAcc = new Map<string, BayesianAccumulator>();

  // Additional dimensions required by StyleSaathi 3.0
  const categoryAcc = new Map<Category, BayesianAccumulator>();
  const formalityAcc = new Map<string, BayesianAccumulator>();
  const styleFamilyAcc = new Map<string, BayesianAccumulator>();
  const comfortAcc = new Map<string, BayesianAccumulator>();

  const getOrInit = <K>(
    map: Map<K, BayesianAccumulator>,
    key: K,
    priorAlpha = 1.0,
    priorBeta = 1.0,
    isExplicit = false
  ): BayesianAccumulator => {
    let acc = map.get(key);
    if (!acc) {
      acc = createAccumulator(priorAlpha, priorBeta, isExplicit);
      map.set(key, acc);
    }
    return acc;
  };

  const setExplicitPrior = <K>(
    map: Map<K, BayesianAccumulator>,
    key: K,
    alpha: number,
    beta: number
  ): BayesianAccumulator => {
    let acc = map.get(key);
    if (!acc) {
      acc = createAccumulator(alpha, beta, true);
      map.set(key, acc);
    } else {
      acc.priorAlpha = alpha;
      acc.priorBeta = beta;
      acc.isExplicit = true;
    }
    return acc;
  };

  // --------------------------------------------------------------------------
  // STEP 1: INITIALIZE EXPLICIT USER PREFERENCE PRIORS & WARDROBE DIMENSIONS
  // Rule 10: Inferred evidence cannot easily displace explicit declarations.
  // --------------------------------------------------------------------------
  for (const item of items) {
    if (item.category) {
      getOrInit(categoryAcc, item.category);
    }
    for (const c of item.colors) {
      getOrInit(colorAcc, c.toLowerCase());
    }
    if (item.fabric && item.fabric !== 'unknown') {
      getOrInit(fabricAcc, item.fabric);
    }
    if (item.pattern && item.pattern !== 'unknown') {
      getOrInit(patternAcc, item.pattern);
    }
    if (item.fit) {
      getOrInit(fitAcc, item.fit);
    }
  }

  if (declaredPrefs) {
    // Explicit Preferred Colors (Informative Beta prior: alpha=4.0, beta=1.0)
    for (const c of declaredPrefs.preferredColors || []) {
      setExplicitPrior(colorAcc, c.toLowerCase(), 4.0, 1.0);
    }

    // Explicit Fabric Sensitivities / Allergies (Strong negative prior: alpha=0.5, beta=6.0)
    for (const f of declaredPrefs.fabricSensitivities || []) {
      setExplicitPrior(fabricAcc, f, 0.5, 6.0);
    }

    // Explicit Preferred Fits
    for (const fit of declaredPrefs.preferredFits || []) {
      setExplicitPrior(fitAcc, fit, 4.0, 1.0);
    }

    // Explicit Preferred Aesthetics / Style Families
    for (const aes of declaredPrefs.preferredAesthetics || []) {
      setExplicitPrior(styleFamilyAcc, aes.toLowerCase(), 4.0, 1.0);
    }

    // Explicit Disliked Styles
    for (const dis of declaredPrefs.dislikedStyles || []) {
      setExplicitPrior(styleFamilyAcc, dis.toLowerCase(), 1.0, 4.0);
    }

    // Explicit Preferred Contexts / Occasions
    for (const ctx of declaredPrefs.preferredContexts || []) {
      const occKey = ctx.toLowerCase() as Occasion;
      setExplicitPrior(occasionAcc, occKey, 3.5, 1.0);
    }
  }

  let formalityDelta = 0;
  let formalitySamples = 0;
  let neutralCount = 0;
  let colorCount = 0;

  // --------------------------------------------------------------------------
  // STEP 2: PROCESS HISTORICAL WEAR EVENTS (GROUND TRUTH ADOPTION)
  // Worn events provide direct physical confirmation (weight = 3.0, observed).
  // --------------------------------------------------------------------------
  for (const wear of wearEvents) {
    const item = itemsMap.get(wear.wardrobeItemId);
    if (!item) continue;
    const recency = calculateRecencyWeight(wear.wornAt, now);
    const weight = STYLE_SIGNAL_WEIGHTS.worn;
    const timestamp = wear.wornAt;

    // Item affinity (direct observed)
    updateAccumulator(getOrInit(itemAcc, item.id), 'worn', weight, recency, 1.0, timestamp, undefined, true);

    // Garment Category
    if (item.category) {
      updateAccumulator(getOrInit(categoryAcc, item.category), 'worn', weight * 0.7, recency, 1.0, timestamp, undefined, true);
    }

    // Color
    for (const c of item.colors) {
      updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), 'worn', weight, recency, 1.0, timestamp, undefined, true);
      if (NEUTRAL_COLORS.includes(c.toLowerCase())) neutralCount++;
      colorCount++;
    }

    // Fabric
    if (item.fabric && item.fabric !== 'unknown') {
      updateAccumulator(getOrInit(fabricAcc, item.fabric), 'worn', weight, recency, 1.0, timestamp, undefined, true);
      if (LIGHT_BREATHABLE_FABRICS.includes(item.fabric)) {
        updateAccumulator(getOrInit(comfortAcc, 'breathable'), 'worn', weight * 0.6, recency, 1.0, timestamp, undefined, true);
      } else if (HEAVY_WARM_FABRICS.includes(item.fabric)) {
        updateAccumulator(getOrInit(comfortAcc, 'warm'), 'worn', weight * 0.6, recency, 1.0, timestamp, undefined, true);
      }
    }

    // Pattern
    if (item.pattern && item.pattern !== 'unknown') {
      updateAccumulator(getOrInit(patternAcc, item.pattern), 'worn', weight, recency, 1.0, timestamp, undefined, true);
    }

    // Fit
    if (item.fit) {
      updateAccumulator(getOrInit(fitAcc, item.fit), 'worn', weight, recency, 1.0, timestamp, undefined, true);
    }

    // Cultural context
    if (item.category === 'Ethnic') {
      updateAccumulator(getOrInit(culturalAcc, 'traditional'), 'worn', weight * 0.8, recency, 1.0, timestamp, undefined, true);
      updateAccumulator(getOrInit(styleFamilyAcc, 'traditional'), 'worn', weight * 0.8, recency, 1.0, timestamp, undefined, true);
    }

    // Formality
    const fTier = item.formality <= 2 ? 'casual' : item.formality <= 3.5 ? 'smart_casual' : item.formality <= 4.5 ? 'formal' : 'ceremonial';
    updateAccumulator(getOrInit(formalityAcc, fTier), 'worn', weight * 0.5, recency, 1.0, timestamp, undefined, true);

    formalityDelta += (item.formality - 3.0) * recency;
    formalitySamples++;
  }

  // --------------------------------------------------------------------------
  // STEP 3: PROCESS WARDROBE ITEM FAVORITE STATUS (ACTIVE AFFECTION BASELINE)
  // --------------------------------------------------------------------------
  for (const item of items) {
    if (item.favorite) {
      const recency = 1.0;
      const weight = STYLE_SIGNAL_WEIGHTS.favorited * 0.7;
      const timestamp = item.lastWorn || now;
      updateAccumulator(getOrInit(itemAcc, item.id), 'favorited', weight, recency, 1.0, timestamp, undefined, true);
      for (const c of item.colors) {
        updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), 'favorited', weight * 0.5, recency, 1.0, now, undefined, true);
      }
      if (item.fabric && item.fabric !== 'unknown') {
        updateAccumulator(getOrInit(fabricAcc, item.fabric), 'favorited', weight * 0.5, recency, 1.0, now, undefined, true);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 4: PROCESS BEHAVIORAL STYLE SIGNALS
  // Differentiates worn, favorited, saved, planned, liked, selected, inspected,
  // displayed, skipped, dismissed, and rejected with ensemble bundle discounting.
  // --------------------------------------------------------------------------
  for (const signal of signals) {
    const baseWeight = STYLE_SIGNAL_WEIGHTS[signal.signalType] ?? 0;
    const recency = calculateRecencyWeight(signal.createdAt, now);
    const timestamp = signal.createdAt;
    const pieces = signal.itemIds.map((id) => itemsMap.get(id)).filter((p): p is WardrobeItem => Boolean(p));

    const isDirectPhysical =
      signal.signalType === 'worn' ||
      signal.signalType === 'favorited' ||
      signal.signalType === 'rejected';
    const isPassiveExposure = signal.signalType === 'viewed' || signal.signalType === 'displayed';

    // Anti-correlation discounting: when an ensemble of M pieces is evaluated,
    // attributes co-occur. Normalize by 1 / sqrt(M) to avoid pseudo-replication.
    const ensembleSize = Math.max(pieces.length, signal.itemIds.length);
    const ensembleFactor = ensembleSize > 0 ? 1 / Math.sqrt(ensembleSize) : 1.0;

    // A. Item-level and Pairwise combination affinity
    for (const p of pieces) {
      updateAccumulator(
        getOrInit(itemAcc, p.id),
        signal.signalType,
        baseWeight,
        recency,
        1.0,
        timestamp,
        signal.occasion,
        isDirectPhysical,
        isPassiveExposure
      );
    }

    if (pieces.length >= 2) {
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const comboKey = getCombinationKey(pieces[i].id, pieces[j].id);
          const comboWeight =
            signal.signalType === 'rejected' && signal.rejectionReason === 'dislike_combination'
              ? -3.5
              : baseWeight;
          updateAccumulator(
            getOrInit(comboAcc, comboKey),
            signal.signalType,
            comboWeight,
            recency,
            1.0,
            timestamp,
            signal.occasion,
            isDirectPhysical,
            isPassiveExposure
          );
        }
      }
    }

    // B. Occasion affinity
    if (signal.occasion) {
      updateAccumulator(
        getOrInit(occasionAcc, signal.occasion),
        signal.signalType,
        baseWeight,
        recency,
        1.0,
        timestamp,
        signal.occasion,
        isDirectPhysical,
        isPassiveExposure
      );
    }

    // C. Granular attribute updates with contextual rejection routing
    for (const p of pieces) {
      let colorWeight = baseWeight;
      let fabricWeight = baseWeight;
      let patternWeight = baseWeight;
      let fitWeight = baseWeight;
      let comfortWeight = baseWeight;

      // Diagnostic routing for structured rejections
      if (signal.signalType === 'rejected' && signal.rejectionReason) {
        switch (signal.rejectionReason) {
          case 'wrong_color':
            for (const c of p.colors) {
              const cWeight = NEUTRAL_COLORS.includes(c.toLowerCase()) ? -0.8 : -2.5;
              updateAccumulator(
                getOrInit(colorAcc, c.toLowerCase()),
                'rejected',
                cWeight,
                recency,
                ensembleFactor,
                timestamp,
                signal.occasion,
                true
              );
            }
            continue; // colors handled directly
          case 'wrong_pattern':
            patternWeight = -2.5;
            break;
          case 'wrong_fit':
            fitWeight = -2.5;
            break;
          case 'too_hot':
            if (p.fabric && HEAVY_WARM_FABRICS.includes(p.fabric)) {
              fabricWeight = -2.5;
            } else if (p.fabric && LIGHT_BREATHABLE_FABRICS.includes(p.fabric)) {
              fabricWeight = 0.5;
            }
            updateAccumulator(getOrInit(comfortAcc, 'breathable'), 'rejected', 0.5, recency, 1.0, timestamp, signal.occasion);
            updateAccumulator(getOrInit(comfortAcc, 'warm'), 'rejected', -2.5, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'too_cold':
            if (p.fabric && LIGHT_BREATHABLE_FABRICS.includes(p.fabric)) {
              fabricWeight = -2.0;
            } else if (p.fabric && HEAVY_WARM_FABRICS.includes(p.fabric)) {
              fabricWeight = 0.8;
            }
            updateAccumulator(getOrInit(comfortAcc, 'warm'), 'rejected', 0.8, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'too_formal':
            formalityDelta -= 1.5 * recency;
            formalitySamples++;
            updateAccumulator(getOrInit(formalityAcc, 'formal'), 'rejected', -2.0, recency, 1.0, timestamp, signal.occasion);
            updateAccumulator(getOrInit(formalityAcc, 'casual'), 'rejected', 1.0, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'too_casual':
            formalityDelta += 1.5 * recency;
            formalitySamples++;
            updateAccumulator(getOrInit(formalityAcc, 'casual'), 'rejected', -2.0, recency, 1.0, timestamp, signal.occasion);
            updateAccumulator(getOrInit(formalityAcc, 'formal'), 'rejected', 1.0, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'uncomfortable':
            fitWeight = -2.0;
            fabricWeight = -1.5;
            comfortWeight = -2.0;
            updateAccumulator(getOrInit(comfortAcc, 'relaxed_ease'), 'rejected', -1.5, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'not_my_style':
            colorWeight = -1.2;
            patternWeight = -1.2;
            fitWeight = -1.2;
            updateAccumulator(getOrInit(styleFamilyAcc, 'personal_alignment'), 'rejected', -2.0, recency, 1.0, timestamp, signal.occasion);
            break;
          case 'too_bold':
            for (const c of p.colors) {
              if (!NEUTRAL_COLORS.includes(c.toLowerCase())) {
                updateAccumulator(getOrInit(colorAcc, c.toLowerCase()), 'rejected', -2.0, recency, ensembleFactor, timestamp, signal.occasion);
              }
            }
            if (p.pattern && p.pattern !== 'solid') {
              updateAccumulator(getOrInit(patternAcc, p.pattern), 'rejected', -2.0, recency, ensembleFactor, timestamp, signal.occasion);
            }
            updateAccumulator(getOrInit(styleFamilyAcc, 'statement'), 'rejected', -2.0, recency, 1.0, timestamp, signal.occasion);
            continue;
          case 'too_plain':
            if (p.pattern === 'solid') {
              updateAccumulator(getOrInit(patternAcc, 'solid'), 'rejected', -1.8, recency, ensembleFactor, timestamp, signal.occasion);
            }
            updateAccumulator(getOrInit(styleFamilyAcc, 'minimal'), 'rejected', -1.5, recency, 1.0, timestamp, signal.occasion);
            break;
        }
      }

      // Apply Category Affinity
      if (p.category) {
        updateAccumulator(
          getOrInit(categoryAcc, p.category),
          signal.signalType,
          baseWeight * 0.7,
          recency,
          ensembleFactor,
          timestamp,
          signal.occasion,
          isDirectPhysical,
          isPassiveExposure
        );
      }

      // Apply Color Weights
      for (const c of p.colors) {
        updateAccumulator(
          getOrInit(colorAcc, c.toLowerCase()),
          signal.signalType,
          colorWeight,
          recency,
          ensembleFactor,
          timestamp,
          signal.occasion,
          isDirectPhysical,
          isPassiveExposure
        );
        if (NEUTRAL_COLORS.includes(c.toLowerCase())) neutralCount++;
        colorCount++;
      }

      // Apply Fabric Weights
      if (p.fabric && p.fabric !== 'unknown') {
        updateAccumulator(
          getOrInit(fabricAcc, p.fabric),
          signal.signalType,
          fabricWeight,
          recency,
          ensembleFactor,
          timestamp,
          signal.occasion,
          isDirectPhysical,
          isPassiveExposure
        );
      }

      // Apply Pattern Weights
      if (p.pattern && p.pattern !== 'unknown') {
        updateAccumulator(
          getOrInit(patternAcc, p.pattern),
          signal.signalType,
          patternWeight,
          recency,
          ensembleFactor,
          timestamp,
          signal.occasion,
          isDirectPhysical,
          isPassiveExposure
        );
      }

      // Apply Fit Weights
      if (p.fit) {
        updateAccumulator(
          getOrInit(fitAcc, p.fit),
          signal.signalType,
          fitWeight,
          recency,
          ensembleFactor,
          timestamp,
          signal.occasion,
          isDirectPhysical,
          isPassiveExposure
        );
      }

      // Apply Cultural & Style Family Context
      if (p.category === 'Ethnic') {
        updateAccumulator(getOrInit(culturalAcc, 'traditional'), signal.signalType, baseWeight * 0.8, recency, ensembleFactor, timestamp, signal.occasion);
        updateAccumulator(getOrInit(styleFamilyAcc, 'traditional'), signal.signalType, baseWeight * 0.8, recency, ensembleFactor, timestamp, signal.occasion);
      } else {
        updateAccumulator(getOrInit(culturalAcc, 'contemporary'), signal.signalType, baseWeight * 0.8, recency, ensembleFactor, timestamp, signal.occasion);
        updateAccumulator(getOrInit(styleFamilyAcc, 'contemporary'), signal.signalType, baseWeight * 0.8, recency, ensembleFactor, timestamp, signal.occasion);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: FINALIZE ALL DIMENSIONAL AFFINITY REGISTRIES
  // --------------------------------------------------------------------------
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

  // Additional 3.0 Dimensions
  const categoryAffinities: Record<Category, AttributeAffinity> = {} as any;
  categoryAcc.forEach((acc, k) => {
    categoryAffinities[k] = finalizeAffinity(acc);
  });

  const formalityAffinities: Record<string, AttributeAffinity> = {};
  formalityAcc.forEach((acc, k) => {
    formalityAffinities[k] = finalizeAffinity(acc);
  });

  const styleFamilyAffinities: Record<string, AttributeAffinity> = {};
  styleFamilyAcc.forEach((acc, k) => {
    styleFamilyAffinities[k] = finalizeAffinity(acc);
  });

  const comfortAffinities: Record<string, AttributeAffinity> = {};
  comfortAcc.forEach((acc, k) => {
    comfortAffinities[k] = finalizeAffinity(acc);
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

  // Novelty tolerance derived from styling mode
  let noveltyTolerance = 0.5;
  if (declaredPrefs?.stylingMode === 'simple') noveltyTolerance = 0.2;
  else if (declaredPrefs?.stylingMode === 'variety') noveltyTolerance = 0.6;
  else if (declaredPrefs?.stylingMode === 'experiment') noveltyTolerance = 0.9;

  // --------------------------------------------------------------------------
  // STEP 6: BUILD CONTEXT-DEPENDENT PREFERENCE SLICES (BY OCCASION)
  // --------------------------------------------------------------------------
  const byOccasion: Partial<Record<Occasion, ContextualPreferenceSlice>> = {};
  const allOccasions: Occasion[] = [
    'college', 'school', 'everyday', 'office', 'interview', 'casual outing',
    'date', 'party', 'wedding guest', 'festive', 'puja', 'family function',
    'family gathering', 'travel', 'celebration', 'Diwali', 'Eid', 'Holi', 'engagement',
  ];

  for (const occ of allOccasions) {
    const occColorScores: Record<string, number> = {};
    const occFabricScores: Partial<Record<FabricType, number>> = {};
    const occPrefColors: string[] = [];
    const occAvoidColors: string[] = [];
    const occPrefFabrics: FabricType[] = [];

    // Extract contextual scores from color affinities
    for (const [c, aff] of Object.entries(colorAffinities)) {
      if (aff.contextualScores && aff.contextualScores[occ] != null) {
        const sc = aff.contextualScores[occ]!;
        occColorScores[c] = sc;
        if (sc > 0.3) occPrefColors.push(c);
        if (sc < -0.3) occAvoidColors.push(c);
      }
    }

    // Extract contextual scores from fabric affinities
    for (const [f, aff] of Object.entries(fabricAffinities) as [FabricType, AttributeAffinity][]) {
      if (aff.contextualScores && aff.contextualScores[occ] != null) {
        const sc = aff.contextualScores[occ]!;
        occFabricScores[f] = sc;
        if (sc > 0.3) occPrefFabrics.push(f);
      }
    }

    if (Object.keys(occColorScores).length > 0 || Object.keys(occFabricScores).length > 0) {
      byOccasion[occ] = {
        occasion: occ,
        preferredColors: occPrefColors,
        avoidedColors: occAvoidColors,
        preferredFabrics: occPrefFabrics,
        colorScores: occColorScores,
        fabricScores: occFabricScores,
      };
    }
  }

  const contextualPreferences: ContextualPreferences = {
    byOccasion,
  };

  return {
    version: STYLE_BRAIN_VERSION,
    userId: signals[0]?.userId || wearEvents[0]?.userId || 'local',
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

    // Backward-compatible StyleSaathi 3.0 Bayesian Extensions
    categoryAffinities,
    formalityAffinities,
    styleFamilyAffinities,
    comfortAffinities,
    contextualPreferences,

    // Inherited explicit attributes
    ageBand: declaredPrefs?.ageBand,
    presentationPreference: declaredPrefs?.presentationPreference,
    fabricSensitivities: declaredPrefs?.fabricSensitivities,
    regionalInterests: declaredPrefs?.regionalInterests,
    budgetTier: declaredPrefs?.budgetTier,
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
    if (profile.avoidedColors?.includes(c)) {
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
    if (p.fabric && profile.fabricAffinities?.[p.fabric]) {
      fabricScoreSum += profile.fabricAffinities[p.fabric].score;
      fabricMatches++;
    }
    if (p.fabric && profile.avoidedFabrics?.includes(p.fabric)) {
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
    if (p.pattern && profile.patternAffinities?.[p.pattern]) {
      patternScoreSum += profile.patternAffinities[p.pattern].score;
      patternMatches++;
    }
    if (p.pattern && profile.avoidedPatterns?.includes(p.pattern)) {
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
    if (p.fit && profile.fitAffinities?.[p.fit]) {
      fitScoreSum += profile.fitAffinities[p.fit].score;
      fitMatches++;
    }
  }
  if (fitMatches > 0) {
    delta += (fitScoreSum / fitMatches) * 0.7 * confidenceScalar;
  }

  // 5. Item-Level Affinity
  for (const p of pieces) {
    const aff = profile.itemAffinities?.[p.id];
    if (aff && aff.confidence >= 0.4) {
      delta += aff.score * 0.6 * confidenceScalar;
    }
  }

  // 6. Pairwise Combination Affinity & Avoidance
  if (pieces.length >= 2) {
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const key = getCombinationKey(pieces[i].id, pieces[j].id);
        const comboAff = profile.combinationAffinities?.[key];
        if (comboAff) {
          delta += comboAff.score * 1.0 * confidenceScalar;
        }
        if (profile.avoidedCombinations?.includes(key)) {
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

  // 8. Explicit User Preference Override (Rule 10: Inviolability of User Declarations)
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
    // Explicit preferred colors boost
    if (declaredPrefs.preferredColors && declaredPrefs.preferredColors.length > 0) {
      const preferred = declaredPrefs.preferredColors.map((c) => c.toLowerCase());
      if (pieceColors.some((c) => preferred.includes(c))) {
        delta += 0.5;
      }
    }
    // Explicit disliked styles penalty
    if (declaredPrefs.dislikedStyles && declaredPrefs.dislikedStyles.length > 0) {
      const disliked = declaredPrefs.dislikedStyles.map((s) => s.toLowerCase());
      const subs = pieces.map((p) => p.subcategory?.toLowerCase() || '');
      if (subs.some((s) => disliked.includes(s))) {
        delta -= 1.5;
      }
    }
  }

  // Clamp personal style score delta within [-3.0, 3.0]
  return Math.max(-3.0, Math.min(3.0, Math.round(delta * 100) / 100));
}

/**
 * Returns explainable, evidence-based personalization reasons.
 * Strict rule: Never fabricates evidence. Only generates reasons when confidence >= 0.45.
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
    const formattedFit = matchingTopFit.fit.replace(/_/g, ' ');
    reasons.push(`Cut in a ${formattedFit} silhouette you frequently choose`);
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

/**
 * User Correction Mechanism (Rule 10):
 * Allows explicit user overriding of any learned attribute affinity.
 * Resets conflicting negative or inferred evidence, establishes an authoritative
 * explicit prior, and returns an updated, validated PersonalStyleProfile.
 */
export function correctPreference(
  profile: PersonalStyleProfile,
  dimension: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion',
  key: string,
  targetAffinity: number, // -1.0 (strongly avoid) to +1.0 (strongly prefer)
  _reason?: string
): PersonalStyleProfile {
  const boundedScore = Math.max(-1.0, Math.min(1.0, Math.round(targetAffinity * 100) / 100));
  const now = Date.now();

  // Map target score to Beta parameters
  // targetScore = (alpha - beta) / (alpha + beta)
  // Let effective sample size = 5.0 for explicit corrections
  const effectiveN = 5.0;
  const meanTheta = (boundedScore + 1) / 2;
  const alpha = Math.max(0.5, Math.round(meanTheta * effectiveN * 10) / 10);
  const beta = Math.max(0.5, Math.round((1 - meanTheta) * effectiveN * 10) / 10);
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));

  const correctedAffinity: AttributeAffinity = {
    score: boundedScore,
    confidence: 0.85,
    sampleCount: 1,
    lastInteractedAt: now,
    status: 'explicit',
    alpha,
    beta,
    variance: Math.round(variance * 10000) / 10000,
    uncertainty: 0.15,
    provenance: {
      status: 'explicit',
      observationCount: 1,
      alpha,
      beta,
      variance: Math.round(variance * 10000) / 10000,
      uncertainty: 0.15,
      credibleInterval: [
        Math.max(-1, boundedScore - 0.25),
        Math.min(1, boundedScore + 0.25),
      ],
      signalCounts: { worn: 1 },
      lastInteractedAt: now,
      isExplicitOverride: true,
    },
  };

  const updatedProfile: PersonalStyleProfile = {
    ...profile,
    updatedAt: now,
  };

  switch (dimension) {
    case 'color': {
      const lowerKey = key.toLowerCase();
      updatedProfile.colorAffinities = {
        ...profile.colorAffinities,
        [lowerKey]: correctedAffinity,
      };
      if (boundedScore < -0.3) {
        if (!updatedProfile.avoidedColors.includes(lowerKey)) {
          updatedProfile.avoidedColors = [...updatedProfile.avoidedColors, lowerKey];
        }
        updatedProfile.topColors = updatedProfile.topColors.filter((c) => c !== lowerKey);
      } else if (boundedScore > 0.3) {
        updatedProfile.avoidedColors = updatedProfile.avoidedColors.filter((c) => c !== lowerKey);
        if (!updatedProfile.topColors.includes(lowerKey)) {
          updatedProfile.topColors = [lowerKey, ...updatedProfile.topColors].slice(0, 4);
        }
      }
      break;
    }
    case 'fabric': {
      const fabKey = key as FabricType;
      updatedProfile.fabricAffinities = {
        ...profile.fabricAffinities,
        [fabKey]: correctedAffinity,
      };
      if (boundedScore < -0.3) {
        if (!updatedProfile.avoidedFabrics.includes(fabKey)) {
          updatedProfile.avoidedFabrics = [...updatedProfile.avoidedFabrics, fabKey];
        }
        updatedProfile.topFabrics = updatedProfile.topFabrics.filter((f) => f !== fabKey);
      } else if (boundedScore > 0.3) {
        updatedProfile.avoidedFabrics = updatedProfile.avoidedFabrics.filter((f) => f !== fabKey);
        if (!updatedProfile.topFabrics.includes(fabKey)) {
          updatedProfile.topFabrics = [fabKey, ...updatedProfile.topFabrics].slice(0, 3);
        }
      }
      break;
    }
    case 'pattern': {
      const patKey = key as PatternType;
      updatedProfile.patternAffinities = {
        ...profile.patternAffinities,
        [patKey]: correctedAffinity,
      };
      if (boundedScore < -0.3 && !updatedProfile.avoidedPatterns.includes(patKey)) {
        updatedProfile.avoidedPatterns = [...updatedProfile.avoidedPatterns, patKey];
      } else if (boundedScore > 0.3) {
        updatedProfile.avoidedPatterns = updatedProfile.avoidedPatterns.filter((p) => p !== patKey);
      }
      break;
    }
    case 'fit': {
      const fitKey = key as SilhouetteFit;
      updatedProfile.fitAffinities = {
        ...profile.fitAffinities,
        [fitKey]: correctedAffinity,
      };
      if (boundedScore > 0.3 && !updatedProfile.topFits.includes(fitKey)) {
        updatedProfile.topFits = [fitKey, ...updatedProfile.topFits].slice(0, 3);
      }
      break;
    }
    case 'category': {
      const catKey = key as Category;
      updatedProfile.categoryAffinities = {
        ...profile.categoryAffinities,
        [catKey]: correctedAffinity,
      } as any;
      break;
    }
    case 'styleFamily': {
      const famKey = key.toLowerCase();
      updatedProfile.styleFamilyAffinities = {
        ...profile.styleFamilyAffinities,
        [famKey]: correctedAffinity,
      };
      break;
    }
    case 'occasion': {
      const occKey = key as Occasion;
      updatedProfile.occasionAffinities = {
        ...profile.occasionAffinities,
        [occKey]: correctedAffinity,
      };
      break;
    }
  }

  return updatedProfile;
}

/**
 * Migration & Backward-Compatibility Helper (Rule 2):
 * Safely migrates any stored legacy profile (v1, v2, v3, or raw partial JSON)
 * into a fully formed Version 4 PersonalStyleProfile with all Bayesian extensions.
 */
export function migrateStyleProfile(raw: any): PersonalStyleProfile {
  if (!raw || typeof raw !== 'object') {
    return derivePersonalStyleProfile([]);
  }

  const version = typeof raw.version === 'number' ? raw.version : 1;
  const now = Date.now();

  const colorAffinities: Record<string, AttributeAffinity> = {};
  for (const [k, v] of Object.entries(raw.colorAffinities || {})) {
    const item = v as any;
    colorAffinities[k] = {
      score: typeof item?.score === 'number' ? item.score : 0,
      confidence: typeof item?.confidence === 'number' ? item.confidence : 0,
      sampleCount: typeof item?.sampleCount === 'number' ? item.sampleCount : 0,
      lastInteractedAt: typeof item?.lastInteractedAt === 'number' ? item.lastInteractedAt : now,
      status: item?.status || (item?.sampleCount > 0 ? 'observed' : 'unknown'),
      alpha: item?.alpha ?? 1.0,
      beta: item?.beta ?? 1.0,
      variance: item?.variance ?? 0.0833,
      uncertainty: item?.uncertainty ?? (item?.confidence != null ? 1.0 - item.confidence : 1.0),
      provenance: item?.provenance,
      contextualScores: item?.contextualScores,
    };
  }

  const fabricAffinities: Record<FabricType, AttributeAffinity> = {} as any;
  for (const [k, v] of Object.entries(raw.fabricAffinities || {})) {
    const item = v as any;
    fabricAffinities[k as FabricType] = {
      score: typeof item?.score === 'number' ? item.score : 0,
      confidence: typeof item?.confidence === 'number' ? item.confidence : 0,
      sampleCount: typeof item?.sampleCount === 'number' ? item.sampleCount : 0,
      lastInteractedAt: typeof item?.lastInteractedAt === 'number' ? item.lastInteractedAt : now,
      status: item?.status || (item?.sampleCount > 0 ? 'observed' : 'unknown'),
      alpha: item?.alpha ?? 1.0,
      beta: item?.beta ?? 1.0,
      variance: item?.variance ?? 0.0833,
      uncertainty: item?.uncertainty ?? (item?.confidence != null ? 1.0 - item.confidence : 1.0),
      provenance: item?.provenance,
      contextualScores: item?.contextualScores,
    };
  }

  const patternAffinities: Record<PatternType, AttributeAffinity> = {} as any;
  for (const [k, v] of Object.entries(raw.patternAffinities || {})) {
    const item = v as any;
    patternAffinities[k as PatternType] = {
      score: typeof item?.score === 'number' ? item.score : 0,
      confidence: typeof item?.confidence === 'number' ? item.confidence : 0,
      sampleCount: typeof item?.sampleCount === 'number' ? item.sampleCount : 0,
      lastInteractedAt: typeof item?.lastInteractedAt === 'number' ? item.lastInteractedAt : now,
      status: item?.status || (item?.sampleCount > 0 ? 'observed' : 'unknown'),
      alpha: item?.alpha ?? 1.0,
      beta: item?.beta ?? 1.0,
      variance: item?.variance ?? 0.0833,
      uncertainty: item?.uncertainty ?? 1.0,
    };
  }

  const fitAffinities: Record<SilhouetteFit, AttributeAffinity> = {} as any;
  for (const [k, v] of Object.entries(raw.fitAffinities || {})) {
    const item = v as any;
    fitAffinities[k as SilhouetteFit] = {
      score: typeof item?.score === 'number' ? item.score : 0,
      confidence: typeof item?.confidence === 'number' ? item.confidence : 0,
      sampleCount: typeof item?.sampleCount === 'number' ? item.sampleCount : 0,
      lastInteractedAt: typeof item?.lastInteractedAt === 'number' ? item.lastInteractedAt : now,
      status: item?.status || (item?.sampleCount > 0 ? 'observed' : 'unknown'),
      alpha: item?.alpha ?? 1.0,
      beta: item?.beta ?? 1.0,
      variance: item?.variance ?? 0.0833,
      uncertainty: item?.uncertainty ?? 1.0,
    };
  }

  return {
    version: Math.max(version, STYLE_BRAIN_VERSION),
    userId: raw.userId || 'local',
    updatedAt: raw.updatedAt || now,
    overallConfidence: typeof raw.overallConfidence === 'number' ? raw.overallConfidence : 0,
    totalSignalsCount: typeof raw.totalSignalsCount === 'number' ? raw.totalSignalsCount : 0,
    colorAffinities,
    fabricAffinities,
    patternAffinities,
    fitAffinities,
    culturalAffinities: raw.culturalAffinities || {},
    occasionAffinities: raw.occasionAffinities || {},
    itemAffinities: raw.itemAffinities || {},
    combinationAffinities: raw.combinationAffinities || {},
    avoidedColors: Array.isArray(raw.avoidedColors) ? raw.avoidedColors : [],
    avoidedFabrics: Array.isArray(raw.avoidedFabrics) ? raw.avoidedFabrics : [],
    avoidedPatterns: Array.isArray(raw.avoidedPatterns) ? raw.avoidedPatterns : [],
    avoidedCombinations: Array.isArray(raw.avoidedCombinations) ? raw.avoidedCombinations : [],
    neutralPreferenceRatio: typeof raw.neutralPreferenceRatio === 'number' ? raw.neutralPreferenceRatio : 0.5,
    formalityBias: typeof raw.formalityBias === 'number' ? raw.formalityBias : 0,
    noveltyTolerance: typeof raw.noveltyTolerance === 'number' ? raw.noveltyTolerance : 0.5,
    topColors: Array.isArray(raw.topColors) ? raw.topColors : [],
    topFabrics: Array.isArray(raw.topFabrics) ? raw.topFabrics : [],
    topFits: Array.isArray(raw.topFits) ? raw.topFits : [],
    recentExplorations: Array.isArray(raw.recentExplorations) ? raw.recentExplorations : [],

    // Extended 3.0 Dimensions
    categoryAffinities: raw.categoryAffinities || {},
    formalityAffinities: raw.formalityAffinities || {},
    styleFamilyAffinities: raw.styleFamilyAffinities || {},
    comfortAffinities: raw.comfortAffinities || {},
    contextualPreferences: raw.contextualPreferences || { byOccasion: {} },

    ageBand: raw.ageBand,
    presentationPreference: raw.presentationPreference,
    fabricSensitivities: raw.fabricSensitivities,
    regionalInterests: raw.regionalInterests,
    budgetTier: raw.budgetTier,
  };
}
