import {
  StyleSignalEvent,
  StyleSignalType,
  RejectionReason,
  Occasion,
  WardrobeItem,
  PersonalStyleProfile,
  AttributeAffinity,
  PreferenceStatus,
  PreferenceEvidenceProvenance,
  FabricType,
  PatternType,
  SilhouetteFit,
  SilhouetteType,
  Category,
} from '../../types';

// ============================================================================
// 1. FEEDBACK TAXONOMY & CATEGORIES (STEP 2)
// ============================================================================

export type FeedbackCategory =
  | 'whole_outfit'        // A. Whole-outfit satisfaction, like, save, or rejection
  | 'individual_garment'   // B. Explicit garment like, wear, or favorite
  | 'pairwise'            // C. Combination-specific approval or rejection
  | 'contextual'          // D. Thermal, occasion, formality, or comfort mismatch
  | 'explicit_correction' // E. User-declared preference overrides
  | 'passive_interaction';// F. Dwell, inspection, carousel view, or skip

export interface AttributedEvidenceItem {
  category: FeedbackCategory;
  signalId: string;
  signalType: StyleSignalType;
  targetType: 'garment' | 'pair' | 'outfit' | 'context' | 'attribute';
  targetKey: string;
  weight: number;
  correlationDampening: number;
  recencyWeight: number;
  occasion?: Occasion;
  rejectionReason?: RejectionReason;
  isExplicit: boolean;
  isObserved: boolean;
  isIntentOnly: boolean;
  notes: string;
}

export interface PreferenceCorrectionRequest {
  dimension:
    | 'color'
    | 'fabric'
    | 'fit'
    | 'silhouette'
    | 'pattern'
    | 'category'
    | 'formality'
    | 'styleFamily'
    | 'comfort';
  key: string;
  polarity: 'prefer' | 'avoid' | 'neutral';
  occasion?: Occasion;
  userNote?: string;
}

export interface LearnedPreferenceExplanation {
  dimension: string;
  key: string;
  score: number; // -1.0 to +1.0 normalized score
  label: string;
  humanDescription: string;
  evidenceBasis: string;
  status: PreferenceStatus;
  confidenceDescription: 'High confidence' | 'Moderate confidence' | 'Early signal / Uncertain';
  isExplicit: boolean;
  uncertaintyScore: number;
  correctionPrompt: string;
}

// ============================================================================
// 2. SIGNAL CLASSIFICATION & DEDUPLICATION (STEP 2 & 3)
// ============================================================================

/**
 * Classifies a raw style signal into one of the 6 canonical feedback categories.
 */
export function classifyFeedbackSignal(signal: StyleSignalEvent): FeedbackCategory {
  // 1. Explicit Combination / Pairwise Rejection
  if (signal.signalType === 'rejected' && signal.rejectionReason === 'dislike_combination') {
    return 'pairwise';
  }

  // 2. Contextual Rejections
  if (
    signal.signalType === 'rejected' &&
    signal.rejectionReason &&
    [
      'too_hot',
      'too_cold',
      'too_formal',
      'too_casual',
      'uncomfortable',
      'not_my_style',
      'too_bold',
      'too_plain',
    ].includes(signal.rejectionReason)
  ) {
    return 'contextual';
  }

  // 3. Passive Interactions (Inspection, Viewing, Display, or Skipping)
  if (
    signal.signalType === 'inspected' ||
    signal.signalType === 'viewed' ||
    signal.signalType === 'displayed' ||
    signal.signalType === 'skipped'
  ) {
    return 'passive_interaction';
  }

  // 4. Individual Garment Actions (Single-item wear, favorite, or like)
  if (
    signal.itemIds.length === 1 &&
    (signal.signalType === 'worn' || signal.signalType === 'favorited' || signal.signalType === 'liked')
  ) {
    return 'individual_garment';
  }

  // 5. Whole-outfit Feedback (Saves, Plans, Outfits, Untargeted Rejections)
  return 'whole_outfit';
}

/**
 * Deduplicates rapid double-taps (< 2000ms window on same action) and clusters
 * session events within a 30-minute sliding window to compute correlation dampening.
 */
export function deduplicateAndDampenSignals(
  signals: StyleSignalEvent[],
  doubleTapThresholdMs = 2000,
  sessionWindowMs = 30 * 60 * 1000
): { signal: StyleSignalEvent; sessionDampening: number }[] {
  // Sort chronologically
  const sorted = [...signals].sort((a, b) => a.createdAt - b.createdAt);
  const result: { signal: StyleSignalEvent; sessionDampening: number }[] = [];
  const seenEventIds = new Set<string>();
  const recentActionMap = new Map<string, number>();
  const sessionItemCounts = new Map<string, number>();

  let currentSessionStart = 0;

  for (const s of sorted) {
    // 1. Hard ID Deduplication
    if (seenEventIds.has(s.id)) continue;
    seenEventIds.add(s.id);

    // 2. Rapid Double-Tap Suppression on Same Target & Action
    const actionKey = `${s.signalType}:${s.itemIds.sort().join('+')}:${s.rejectionReason || ''}`;
    const lastActionTime = recentActionMap.get(actionKey);
    if (lastActionTime && Math.abs(s.createdAt - lastActionTime) < doubleTapThresholdMs) {
      continue; // Drop rapid duplicate trigger
    }
    recentActionMap.set(actionKey, s.createdAt);

    // 3. Sliding Session Window Clustering
    if (!currentSessionStart || s.createdAt - currentSessionStart > sessionWindowMs) {
      currentSessionStart = s.createdAt;
      sessionItemCounts.clear();
    }

    // 4. Sublinear Session Correlation Dampening: 1 / sqrt(N_session)
    let maxItemSessionCount = 1;
    for (const itemId of s.itemIds) {
      const cnt = (sessionItemCounts.get(itemId) || 0) + 1;
      sessionItemCounts.set(itemId, cnt);
      if (cnt > maxItemSessionCount) maxItemSessionCount = cnt;
    }
    const sessionDampening = 1 / Math.sqrt(maxItemSessionCount);

    result.push({ signal: s, sessionDampening });
  }

  return result;
}

// ============================================================================
// 3. EVIDENCE ATTRIBUTION BOUNDARIES (STEP 3)
// ============================================================================

/**
 * Attributes a feedback signal to its legitimate target entities according to strict
 * non-contagion rules:
 * - Whole-outfit rejection does NOT dislike every individual garment.
 * - Pairwise rejection updates pairwise preference evidence, not individual garment preference.
 * - Actual wear is evidence of physical use, not automatic proof of satisfaction.
 * - Lookbook saves and calendar plans represent intent, not confirmed satisfaction.
 * - Passive inspection carries 0.0 positive preference weight.
 */
export function attributeSignalEvidence(
  signal: StyleSignalEvent,
  sessionDampening: number,
  itemsMap: Map<string, WardrobeItem>
): AttributedEvidenceItem[] {
  const category = classifyFeedbackSignal(signal);
  const attributed: AttributedEvidenceItem[] = [];

  const pieces = signal.itemIds
    .map((id) => itemsMap.get(id))
    .filter((p): p is WardrobeItem => Boolean(p));

  // --------------------------------------------------------------------------
  // RULE 1: WHOLE-OUTFIT REJECTION ATTRIBUTION
  // Untargeted rejection targets the ensemble combo, NOT every single piece.
  // --------------------------------------------------------------------------
  if (category === 'whole_outfit' && (signal.signalType === 'rejected' || signal.signalType === 'dismissed')) {
    const isUntargeted = !signal.rejectionReason || signal.rejectionReason === 'other';
    const weight = signal.signalType === 'rejected' ? -2.0 : -0.8;

    if (signal.outfitId) {
      attributed.push({
        category: 'whole_outfit',
        signalId: signal.id,
        signalType: signal.signalType,
        targetType: 'outfit',
        targetKey: signal.outfitId,
        weight,
        correlationDampening: sessionDampening,
        recencyWeight: 1.0,
        occasion: signal.occasion,
        isExplicit: signal.signalType === 'rejected',
        isObserved: true,
        isIntentOnly: false,
        notes: isUntargeted
          ? 'Untargeted outfit rejection: attributed to outfit ensemble level, pieces preserved.'
          : `Outfit rejected with reason: ${signal.rejectionReason}`,
      });
    }

    // Also record combination-level avoidance if multi-piece, without penalizing pieces
    if (pieces.length >= 2) {
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const comboKey = pieces[i].id < pieces[j].id ? `${pieces[i].id}:${pieces[j].id}` : `${pieces[j].id}:${pieces[i].id}`;
          attributed.push({
            category: 'pairwise',
            signalId: signal.id,
            signalType: signal.signalType,
            targetType: 'pair',
            targetKey: comboKey,
            weight: weight * 0.7,
            correlationDampening: sessionDampening,
            recencyWeight: 1.0,
            occasion: signal.occasion,
            isExplicit: false,
            isObserved: true,
            isIntentOnly: false,
            notes: 'Ensemble rejection soft combination penalty.',
          });
        }
      }
    }

    return attributed;
  }

  // --------------------------------------------------------------------------
  // RULE 2: PAIRWISE REJECTION ATTRIBUTION
  // Combination dislike updates pair affinity ONLY, NOT individual pieces.
  // --------------------------------------------------------------------------
  if (category === 'pairwise') {
    if (pieces.length >= 2) {
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const comboKey = pieces[i].id < pieces[j].id ? `${pieces[i].id}:${pieces[j].id}` : `${pieces[j].id}:${pieces[i].id}`;
          attributed.push({
            category: 'pairwise',
            signalId: signal.id,
            signalType: signal.signalType,
            targetType: 'pair',
            targetKey: comboKey,
            weight: -3.5,
            correlationDampening: 1.0,
            recencyWeight: 1.0,
            occasion: signal.occasion,
            isExplicit: true,
            isObserved: true,
            isIntentOnly: false,
            notes: 'Explicit combination dislike: pair combination penalized, individual garments preserved.',
          });
        }
      }
    }
    return attributed;
  }

  // --------------------------------------------------------------------------
  // RULE 3: CONTEXTUAL REJECTION ATTRIBUTION
  // Rejection because of weather/occasion/formality updates context slices.
  // --------------------------------------------------------------------------
  if (category === 'contextual' && signal.rejectionReason) {
    attributed.push({
      category: 'contextual',
      signalId: signal.id,
      signalType: signal.signalType,
      targetType: 'context',
      targetKey: signal.rejectionReason,
      weight: -2.0,
      correlationDampening: sessionDampening,
      recencyWeight: 1.0,
      occasion: signal.occasion,
      rejectionReason: signal.rejectionReason,
      isExplicit: true,
      isObserved: true,
      isIntentOnly: false,
      notes: `Contextual feedback: attributed to ${signal.rejectionReason} for occasion ${signal.occasion || 'general'}.`,
    });
    return attributed;
  }

  // --------------------------------------------------------------------------
  // RULE 4 & 5: PASSIVE INTERACTIONS (INSPECTION, VIEWING, SKIPPING)
  // Passive inspection must NEVER be interpreted as positive preference.
  // --------------------------------------------------------------------------
  if (category === 'passive_interaction') {
    for (const p of pieces) {
      attributed.push({
        category: 'passive_interaction',
        signalId: signal.id,
        signalType: signal.signalType,
        targetType: 'garment',
        targetKey: p.id,
        weight: signal.signalType === 'skipped' ? -0.3 : 0.0, // Inspected/viewed carries 0.0 score weight
        correlationDampening: sessionDampening,
        recencyWeight: 1.0,
        isExplicit: false,
        isObserved: false,
        isIntentOnly: false,
        notes: `Passive ${signal.signalType}: zero positive preference weight.`,
      });
    }
    return attributed;
  }

  // --------------------------------------------------------------------------
  // RULE 6: INTENT VS SATISFACTION (SAVES, PLANS, WEARS)
  // Wears indicate physical use (weight 2.5); Saves and Plans reflect intent (weight 1.2-1.5).
  // --------------------------------------------------------------------------
  const isWear = signal.signalType === 'worn';
  const isIntent = signal.signalType === 'saved' || signal.signalType === 'planned';
  const weight = isWear ? 2.5 : isIntent ? (signal.signalType === 'saved' ? 1.5 : 1.2) : 1.0;

  for (const p of pieces) {
    attributed.push({
      category: signal.itemIds.length === 1 ? 'individual_garment' : 'whole_outfit',
      signalId: signal.id,
      signalType: signal.signalType,
      targetType: 'garment',
      targetKey: p.id,
      weight,
      correlationDampening: sessionDampening,
      recencyWeight: 1.0,
      occasion: signal.occasion,
      isExplicit: false,
      isObserved: isWear,
      isIntentOnly: isIntent,
      notes: isWear ? 'Physical wear adoption.' : isIntent ? 'Forward intent signal (curation/schedule).' : 'Positive engagement.',
    });
  }

  return attributed;
}

// ============================================================================
// 4. USER CORRECTION API (STEP 6)
// ============================================================================

/**
 * Applies an explicit user correction to an existing PersonalStyleProfile,
 * immediately overriding any inferred preferences and establishing an authoritative
 * prior with explicit provenance.
 */
export function correctInferredPreference(
  profile: PersonalStyleProfile,
  request: PreferenceCorrectionRequest
): PersonalStyleProfile {
  const updatedProfile: PersonalStyleProfile = {
    ...profile,
    updatedAt: Date.now(),
  };

  const { dimension, key, polarity, occasion, userNote } = request;
  const targetKey = key.toLowerCase();

  // Informative Beta Prior parameters:
  // Prefer: alpha=5.0, beta=1.0 (mean 0.83, score ~0.67)
  // Avoid:  alpha=1.0, beta=5.0 (mean 0.17, score ~-0.67)
  // Neutral: alpha=2.0, beta=2.0 (mean 0.50, score 0.0)
  const alpha = polarity === 'prefer' ? 5.0 : polarity === 'avoid' ? 1.0 : 2.0;
  const beta = polarity === 'prefer' ? 1.0 : polarity === 'avoid' ? 5.0 : 2.0;
  const score = Math.round(((alpha - beta) / (alpha + beta)) * 100) / 100;
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const uncertainty = polarity === 'neutral' ? 0.7 : 0.25;

  const provenance: PreferenceEvidenceProvenance = {
    status: 'explicit',
    observationCount: 1,
    alpha,
    beta,
    variance: Math.round(variance * 10000) / 10000,
    uncertainty,
    credibleInterval: [
      Math.round((score - 0.25) * 100) / 100,
      Math.round((score + 0.25) * 100) / 100,
    ],
    signalCounts: {},
    lastInteractedAt: Date.now(),
    isExplicitOverride: true,
  };

  const affinity: AttributeAffinity = {
    score,
    confidence: 0.85,
    sampleCount: 1,
    lastInteractedAt: Date.now(),
    status: 'explicit',
    alpha,
    beta,
    variance: Math.round(variance * 10000) / 10000,
    uncertainty,
    provenance,
  };

  // Route to the appropriate dimensional map
  switch (dimension) {
    case 'color':
      updatedProfile.colorAffinities = {
        ...updatedProfile.colorAffinities,
        [targetKey]: affinity,
      };
      if (polarity === 'avoid') {
        updatedProfile.avoidedColors = Array.from(new Set([...updatedProfile.avoidedColors, targetKey]));
      } else {
        updatedProfile.avoidedColors = updatedProfile.avoidedColors.filter((c) => c !== targetKey);
      }
      break;

    case 'fabric':
      updatedProfile.fabricAffinities = {
        ...updatedProfile.fabricAffinities,
        [targetKey as FabricType]: affinity,
      };
      if (polarity === 'avoid') {
        updatedProfile.avoidedFabrics = Array.from(new Set([...updatedProfile.avoidedFabrics, targetKey as FabricType]));
      } else {
        updatedProfile.avoidedFabrics = updatedProfile.avoidedFabrics.filter((f) => f !== targetKey);
      }
      break;

    case 'pattern':
      updatedProfile.patternAffinities = {
        ...updatedProfile.patternAffinities,
        [targetKey as PatternType]: affinity,
      };
      if (polarity === 'avoid') {
        updatedProfile.avoidedPatterns = Array.from(new Set([...updatedProfile.avoidedPatterns, targetKey as PatternType]));
      } else {
        updatedProfile.avoidedPatterns = updatedProfile.avoidedPatterns.filter((p) => p !== targetKey);
      }
      break;

    case 'fit':
      updatedProfile.fitAffinities = {
        ...updatedProfile.fitAffinities,
        [targetKey as SilhouetteFit]: affinity,
      };
      break;

    case 'silhouette':
      updatedProfile.silhouetteAffinities = {
        ...(updatedProfile.silhouetteAffinities || {}),
        [targetKey as SilhouetteType]: affinity,
      } as Record<SilhouetteType, AttributeAffinity>;
      break;

    case 'category':
      updatedProfile.categoryAffinities = {
        ...(updatedProfile.categoryAffinities || {}),
        [targetKey as Category]: affinity,
      } as Record<Category, AttributeAffinity>;
      break;

    case 'styleFamily':
      updatedProfile.styleFamilyAffinities = {
        ...(updatedProfile.styleFamilyAffinities || {}),
        [targetKey]: affinity,
      };
      break;

    case 'comfort':
      updatedProfile.comfortAffinities = {
        ...(updatedProfile.comfortAffinities || {}),
        [targetKey]: affinity,
      };
      break;
  }

  // Handle Occasion-Specific Contextual Slice if Occasion Specified
  if (occasion && updatedProfile.contextualPreferences) {
    const existingSlice = updatedProfile.contextualPreferences.byOccasion[occasion] || {
      occasion,
      preferredColors: [],
      avoidedColors: [],
      preferredFabrics: [],
      colorScores: {},
      fabricScores: {},
    };

    if (dimension === 'color') {
      existingSlice.colorScores[targetKey] = score;
      if (polarity === 'prefer') {
        existingSlice.preferredColors = Array.from(new Set([...existingSlice.preferredColors, targetKey]));
      } else if (polarity === 'avoid') {
        existingSlice.avoidedColors = Array.from(new Set([...existingSlice.avoidedColors, targetKey]));
      }
    } else if (dimension === 'fabric') {
      existingSlice.fabricScores[targetKey as FabricType] = score;
      if (polarity === 'prefer') {
        existingSlice.preferredFabrics = Array.from(new Set([...existingSlice.preferredFabrics, targetKey as FabricType]));
      }
    }

    updatedProfile.contextualPreferences.byOccasion[occasion] = existingSlice;
  }

  return updatedProfile;
}

// ============================================================================
// 5. USER TRANSPARENCY & EXPLANATIONS (STEP 6)
// ============================================================================

/**
 * Generates transparent, human-readable explanations of what the system has learned
 * without exposing raw statistical notation in the user interface.
 */
export function explainLearnedPreferences(
  profile: PersonalStyleProfile
): LearnedPreferenceExplanation[] {
  const explanations: LearnedPreferenceExplanation[] = [];

  const formatConfidence = (
    conf: number,
    status?: PreferenceStatus
  ): 'High confidence' | 'Moderate confidence' | 'Early signal / Uncertain' => {
    if (status === 'explicit' || conf >= 0.7) return 'High confidence';
    if (conf >= 0.45) return 'Moderate confidence';
    return 'Early signal / Uncertain';
  };

  // 1. Color Preferences
  for (const [color, aff] of Object.entries(profile.colorAffinities || {})) {
    if (aff.sampleCount >= 2 || aff.status === 'explicit') {
      const isPositive = aff.score >= 0.25;
      const isNegative = aff.score <= -0.25;
      if (!isPositive && !isNegative) continue;

      const polarityWord = isPositive ? 'prefer' : 'tend to avoid';
      const basis =
        aff.status === 'explicit'
          ? 'Explicitly declared in your style settings'
          : `Learned from ${aff.sampleCount} wardrobe outfits and wear events`;

      explanations.push({
        dimension: 'Color',
        key: color,
        score: aff.score,
        label: `${color.charAt(0).toUpperCase() + color.slice(1)}`,
        humanDescription: `You ${polarityWord} ${color} garments in your regular rotation.`,
        evidenceBasis: basis,
        status: aff.status || 'inferred',
        confidenceDescription: formatConfidence(aff.confidence, aff.status),
        isExplicit: aff.status === 'explicit',
        uncertaintyScore: aff.uncertainty ?? 0.5,
        correctionPrompt: 'Tap to update your color preference',
      });
    }
  }

  // 2. Fabric Preferences
  for (const [fabric, aff] of Object.entries(profile.fabricAffinities || {})) {
    if (aff.sampleCount >= 2 || aff.status === 'explicit') {
      const isPositive = aff.score >= 0.25;
      const isNegative = aff.score <= -0.25;
      if (!isPositive && !isNegative) continue;

      const polarityWord = isPositive ? 'prefer' : 'tend to avoid';
      const basis =
        aff.status === 'explicit'
          ? 'Explicitly declared in your fabric sensitivities'
          : `Learned from ${aff.sampleCount} garment wear interactions`;

      explanations.push({
        dimension: 'Fabric',
        key: fabric,
        score: aff.score,
        label: `${fabric.charAt(0).toUpperCase() + fabric.slice(1)} fabric`,
        humanDescription: `You ${polarityWord} ${fabric} weaves.`,
        evidenceBasis: basis,
        status: aff.status || 'inferred',
        confidenceDescription: formatConfidence(aff.confidence, aff.status),
        isExplicit: aff.status === 'explicit',
        uncertaintyScore: aff.uncertainty ?? 0.5,
        correctionPrompt: 'Tap to update your fabric preference',
      });
    }
  }

  // 3. Silhouette / Fit Preferences
  for (const [sil, aff] of Object.entries(profile.silhouetteAffinities || {})) {
    if (aff.sampleCount >= 2 || aff.status === 'explicit') {
      const isPositive = aff.score >= 0.25;
      if (!isPositive) continue;

      explanations.push({
        dimension: 'Silhouette',
        key: sil,
        score: aff.score,
        label: `${sil.charAt(0).toUpperCase() + sil.slice(1)} silhouette`,
        humanDescription: `You frequently choose ${sil} silhouettes for balanced comfort.`,
        evidenceBasis:
          aff.status === 'explicit'
            ? 'Declared in style preferences'
            : `Observed across ${aff.sampleCount} worn outfits`,
        status: aff.status || 'inferred',
        confidenceDescription: formatConfidence(aff.confidence, aff.status),
        isExplicit: aff.status === 'explicit',
        uncertaintyScore: aff.uncertainty ?? 0.5,
        correctionPrompt: 'Tap to adjust your silhouette preference',
      });
    }
  }

  return explanations;
}
