import {
  WardrobeItem,
  WearEvent,
  StyleSignalEvent,
  StylePreferences,
  PersonalStyleProfile,
  AttributeAffinity,
  FabricType,
  PatternType,
  SilhouetteFit,
  SilhouetteType,
  Occasion,
  CulturalContext,
  StyleDNAProfile,
  StyleDNANode,
  StyleDNAInsight,
  PreferenceEvidenceSource,
  PreferenceStatus,
} from '../types';
import {
  derivePersonalStyleProfile,
  correctPreference,
  mapFitToSilhouette,
  STYLE_BRAIN_VERSION,
  MIN_EVIDENCE_COUNT,
} from './styleBrain';

export const STYLE_DNA_VERSION = 1;

/**
 * Maps raw style signal types & wear events into an explainable evidence provenance source.
 */
export function determineEvidenceSource(
  affinity?: AttributeAffinity,
  isExplicit?: boolean,
  wearCount: number = 0
): PreferenceEvidenceSource {
  if (isExplicit || affinity?.status === 'explicit' || affinity?.provenance?.isExplicitOverride) {
    return 'explicit_declaration';
  }
  if (wearCount > 0 || (affinity?.provenance?.signalCounts?.worn ?? 0) > 0) {
    return 'worn_history';
  }
  if (
    (affinity?.provenance?.signalCounts?.rejected ?? 0) > 0 ||
    (affinity?.provenance?.signalCounts?.liked ?? 0) > 0
  ) {
    return 'outfit_feedback';
  }
  if ((affinity?.provenance?.signalCounts?.planned ?? 0) > 0) {
    return 'calendar_plan';
  }
  if (
    (affinity?.provenance?.signalCounts?.saved ?? 0) > 0 ||
    (affinity?.provenance?.signalCounts?.favorited ?? 0) > 0
  ) {
    return 'saved_look';
  }
  if (affinity && affinity.sampleCount > 0) {
    return 'worn_history';
  }
  return 'unobserved';
}

/**
 * Human-friendly formatting of attribute values.
 */
function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Derives a complete, explainable StyleDNAProfile from the Bayesian PersonalStyleProfile,
 * physical wardrobe items, historical wear events, user preferences, and style signals.
 */
export function deriveStyleDNAProfile(
  profile: PersonalStyleProfile,
  items: WardrobeItem[] = [],
  wearEvents: WearEvent[] = [],
  preferences?: StylePreferences,
  _signals: StyleSignalEvent[] = []
): StyleDNAProfile {
  const now = Date.now();
  const totalSignalsCount = profile.totalSignalsCount || (wearEvents.length + (preferences ? 2 : 0));
  const hasSufficientEvidence = totalSignalsCount >= MIN_EVIDENCE_COUNT;

  // Track wear counts per item and per color/fabric/fit
  const colorWearCounts = new Map<string, number>();
  const fabricWearCounts = new Map<string, number>();
  const fitWearCounts = new Map<string, number>();
  const itemsMap = new Map<string, WardrobeItem>();

  for (const item of items) {
    itemsMap.set(item.id, item);
  }

  for (const wear of wearEvents) {
    const it = itemsMap.get(wear.wardrobeItemId);
    if (!it) continue;
    for (const c of it.colors) {
      const norm = c.toLowerCase();
      colorWearCounts.set(norm, (colorWearCounts.get(norm) || 0) + 1);
    }
    if (it.fabric && it.fabric !== 'unknown') {
      fabricWearCounts.set(it.fabric, (fabricWearCounts.get(it.fabric) || 0) + 1);
    }
    if (it.fit) {
      fitWearCounts.set(it.fit, (fitWearCounts.get(it.fit) || 0) + 1);
    }
  }

  // --------------------------------------------------------------------------
  // 1. AESTHETICS & STYLE FAMILIES
  // --------------------------------------------------------------------------
  const candidateAesthetics = [
    { id: 'minimalist', label: 'Minimalist & Quiet Luxury', desc: 'Understated silhouettes, neutral palette, and pure drapes' },
    { id: 'indo_western', label: 'Indo-Western Fusion', desc: 'Harmonious pairing of Indian ethnic pieces with western tailoring' },
    { id: 'contemporary', label: 'Contemporary Casual', desc: 'Relaxed modern proportions designed for everyday movement' },
    { id: 'traditional', label: 'Indian Traditional', desc: 'Heritage handlooms, classic kurtas, and ceremonial elegance' },
    { id: 'tailored', label: 'Office & Tailored', desc: 'Structured lines, sharp collars, and architectural presence' },
    { id: 'festive', label: 'Festive & Celebration', desc: 'Rich celebratory jewel tones, brocades, and festive ornamentation' },
    { id: 'streetwear', label: 'Streetwear & Relaxed', desc: 'Oversized layers, expressive cuts, and casual comfort' },
  ];

  const aesthetics: StyleDNANode[] = candidateAesthetics.map((aes) => {
    const isExplicit = preferences?.preferredAesthetics?.some((a) => {
      const normA = a.toLowerCase().replace(/[-_ ]/g, '');
      const normId = aes.id.toLowerCase().replace(/[-_ ]/g, '');
      return normA.includes(normId) || normId.includes(normA);
    });
    const isDisliked = preferences?.dislikedStyles?.some((d) => {
      const normD = d.toLowerCase().replace(/[-_ ]/g, '');
      const normId = aes.id.toLowerCase().replace(/[-_ ]/g, '');
      return normD.includes(normId) || normId.includes(normD);
    });

    const aff = profile.styleFamilyAffinities?.[aes.id];
    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    let sampleCount = aff?.sampleCount || 0;

    if (isExplicit) {
      score = 0.85;
      confidence = 0.95;
      status = 'explicit';
      sampleCount = Math.max(1, sampleCount);
    } else if (isDisliked) {
      score = -0.85;
      confidence = 0.95;
      status = 'explicit';
      sampleCount = Math.max(1, sampleCount);
    } else if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    }

    const evidenceSource = determineEvidenceSource(aff, isExplicit || isDisliked, sampleCount);

    return {
      id: `aes_${aes.id}`,
      dimension: 'aesthetic',
      value: aes.id,
      label: aes.label,
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      description: aes.desc,
      isConfirmed: isExplicit || status === 'explicit',
    };
  });

  // --------------------------------------------------------------------------
  // 2. COLOR PALETTE PREFERENCES
  // --------------------------------------------------------------------------
  const allKnownColors = new Set<string>();
  Object.keys(profile.colorAffinities || {}).forEach((c) => allKnownColors.add(c.toLowerCase()));
  items.forEach((i) => i.colors.forEach((c) => allKnownColors.add(c.toLowerCase())));
  (preferences?.preferredColors || []).forEach((c) => allKnownColors.add(c.toLowerCase()));

  const colors: StyleDNANode[] = Array.from(allKnownColors).map((color) => {
    const isExplicit = preferences?.preferredColors?.some((c) => c.toLowerCase() === color);
    const aff = profile.colorAffinities?.[color];
    const wearCount = colorWearCounts.get(color) || 0;

    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    let sampleCount = aff?.sampleCount || wearCount;

    if (isExplicit) {
      score = aff ? Math.max(0.6, aff.score) : 0.85;
      confidence = 0.95;
      status = 'explicit';
      sampleCount = Math.max(1, sampleCount);
    } else if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    } else if (wearCount > 0) {
      score = Math.min(1.0, 0.3 + wearCount * 0.15);
      confidence = Math.min(1.0, 0.4 + wearCount * 0.1);
      status = 'observed';
    }

    const evidenceSource = determineEvidenceSource(aff, isExplicit, wearCount);

    return {
      id: `col_${color}`,
      dimension: 'color',
      value: color,
      label: formatLabel(color),
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      isConfirmed: isExplicit || status === 'explicit',
    };
  });

  // Sort colors: explicit first, then highest confidence & score
  colors.sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.score - a.score;
  });

  // --------------------------------------------------------------------------
  // 3. SILHOUETTE & FIT PREFERENCES
  // --------------------------------------------------------------------------
  const allFits: SilhouetteFit[] = ['tailored', 'relaxed', 'slim', 'straight', 'regular', 'oversized', 'a_line', 'flared', 'anarkali'];
  const silhouettes: StyleDNANode[] = allFits.map((fit) => {
    const isExplicit = preferences?.preferredFits?.includes(fit);
    const aff = profile.fitAffinities?.[fit];
    const wearCount = fitWearCounts.get(fit) || 0;

    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    let sampleCount = aff?.sampleCount || wearCount;

    if (isExplicit) {
      score = aff ? Math.max(0.6, aff.score) : 0.85;
      confidence = 0.95;
      status = 'explicit';
      sampleCount = Math.max(1, sampleCount);
    } else if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    } else if (wearCount > 0) {
      score = Math.min(1.0, 0.25 + wearCount * 0.15);
      confidence = Math.min(1.0, 0.35 + wearCount * 0.1);
      status = 'observed';
    }

    const evidenceSource = determineEvidenceSource(aff, isExplicit, wearCount);

    return {
      id: `fit_${fit}`,
      dimension: 'silhouette',
      value: fit,
      label: `${formatLabel(fit)} Silhouette`,
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      isConfirmed: isExplicit || status === 'explicit',
    };
  });

  silhouettes.sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.score - a.score;
  });

  // --------------------------------------------------------------------------
  // 4. FABRIC & TEXTURE PREFERENCES
  // --------------------------------------------------------------------------
  const allFabrics: FabricType[] = [
    'cotton', 'linen', 'silk', 'wool', 'denim', 'khadi', 'mulmul',
    'chanderi', 'tussar', 'banarasi', 'velvet', 'modal', 'polyblend',
  ];

  const fabrics: StyleDNANode[] = allFabrics.map((fabric) => {
    const isSensitive = preferences?.fabricSensitivities?.includes(fabric);
    const aff = profile.fabricAffinities?.[fabric];
    const wearCount = fabricWearCounts.get(fabric) || 0;

    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    let sampleCount = aff?.sampleCount || wearCount;

    if (isSensitive) {
      score = -0.9;
      confidence = 0.95;
      status = 'explicit';
      sampleCount = Math.max(1, sampleCount);
    } else if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    } else if (wearCount > 0) {
      score = Math.min(1.0, 0.25 + wearCount * 0.15);
      confidence = Math.min(1.0, 0.35 + wearCount * 0.1);
      status = 'observed';
    }

    const evidenceSource = determineEvidenceSource(aff, isSensitive, wearCount);

    return {
      id: `fab_${fabric}`,
      dimension: 'fabric',
      value: fabric,
      label: formatLabel(fabric),
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      isConfirmed: isSensitive || status === 'explicit',
    };
  });

  fabrics.sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.score - a.score;
  });

  // --------------------------------------------------------------------------
  // 5. PATTERN PREFERENCES
  // --------------------------------------------------------------------------
  const allPatterns: PatternType[] = [
    'solid',
    'striped',
    'checked',
    'block_print',
    'embroidered',
    'floral',
    'geometric',
    'bandhani',
    'kalamkari',
    'chikankari',
    'zari_brocade',
  ];

  const patterns: StyleDNANode[] = allPatterns.map((pat) => {
    const aff = profile.patternAffinities?.[pat];
    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    const sampleCount = aff?.sampleCount || 0;

    if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    }

    const evidenceSource = determineEvidenceSource(aff, false, sampleCount);

    return {
      id: `pat_${pat}`,
      dimension: 'pattern',
      value: pat,
      label: formatLabel(pat),
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      isConfirmed: status === 'explicit',
    };
  });

  // --------------------------------------------------------------------------
  // 6. CULTURAL AFFINITIES (TRADITIONAL, CONTEMPORARY, INDO-WESTERN)
  // --------------------------------------------------------------------------
  const culturalDimensions: CulturalContext[] = [
    'traditional',
    'contemporary',
    'fusion',
    'ceremonial',
    'everyday_ethnic',
  ];
  const culturalAffinities: StyleDNANode[] = culturalDimensions.map((cult) => {
    const aff = profile.culturalAffinities?.[cult];
    let score = 0;
    let confidence = 0;
    let status: PreferenceStatus = 'unknown';
    const sampleCount = aff?.sampleCount || 0;

    if (aff && aff.sampleCount > 0) {
      score = aff.score;
      confidence = aff.confidence;
      status = aff.status || (aff.confidence >= 0.4 ? 'observed' : 'inferred');
    }

    const labelMap: Record<CulturalContext, string> = {
      traditional: 'Indian Traditional Heritage',
      contemporary: 'Modern Contemporary Western',
      fusion: 'Indo-Western Fusion',
      ceremonial: 'Ceremonial & Festive',
      everyday_ethnic: 'Everyday Ethnic & Casual Kurtas',
    };

    const evidenceSource = determineEvidenceSource(aff, false, sampleCount);

    return {
      id: `cult_${cult}`,
      dimension: 'cultural',
      value: cult,
      label: labelMap[cult] || formatLabel(cult),
      score,
      confidence,
      status,
      evidenceSource,
      sampleCount,
      lastUpdated: aff?.lastInteractedAt || now,
      isConfirmed: status === 'explicit',
    };
  });

  // --------------------------------------------------------------------------
  // 7. CONTEXTUAL OCCASION PREFERENCES (SLICES)
  // Slices keep occasion-specific styles from bleeding into global preferences.
  // --------------------------------------------------------------------------
  const occasionPreferences: Record<string, StyleDNANode[]> = {};
  const primaryOccasions: Occasion[] = ['everyday', 'office', 'festive', 'wedding guest', 'casual outing', 'party'];

  for (const occ of primaryOccasions) {
    const occSlice = profile.contextualPreferences?.byOccasion?.[occ];
    const nodes: StyleDNANode[] = [];

    if (occSlice) {
      // Preferred colors for this occasion
      for (const col of occSlice.preferredColors || []) {
        const sc = occSlice.colorScores?.[col] ?? 0.5;
        nodes.push({
          id: `occ_${occ}_col_${col}`,
          dimension: 'color',
          value: col,
          label: formatLabel(col),
          score: sc,
          confidence: 0.65,
          status: 'observed',
          evidenceSource: 'worn_history',
          sampleCount: 2,
          lastUpdated: now,
          description: `Preferred tone for ${formatLabel(occ)}`,
        });
      }

      // Preferred fabrics for this occasion
      for (const fab of occSlice.preferredFabrics || []) {
        const sc = occSlice.fabricScores?.[fab] ?? 0.5;
        nodes.push({
          id: `occ_${occ}_fab_${fab}`,
          dimension: 'fabric',
          value: fab,
          label: formatLabel(fab),
          score: sc,
          confidence: 0.65,
          status: 'observed',
          evidenceSource: 'worn_history',
          sampleCount: 2,
          lastUpdated: now,
          description: `Preferred fabric for ${formatLabel(occ)}`,
        });
      }
    }

    // Also collect directly observed colors/fabrics from wearEvents matching this occasion
    const occWears = wearEvents.filter((w) => w.occasion === occ);
    for (const w of occWears) {
      const it = itemsMap.get(w.wardrobeItemId);
      if (it) {
        for (const col of it.colors) {
          const normCol = col.toLowerCase();
          if (!nodes.some((n) => n.dimension === 'color' && n.value === normCol)) {
            nodes.push({
              id: `occ_${occ}_col_${normCol}`,
              dimension: 'color',
              value: normCol,
              label: formatLabel(normCol),
              score: 0.7,
              confidence: 0.6,
              status: 'observed',
              evidenceSource: 'worn_history',
              sampleCount: 1,
              lastUpdated: w.wornAt || w.timestamp || now,
              description: `Observed in ${formatLabel(occ)} wear`,
            });
          }
        }
        if (it.fabric && it.fabric !== 'unknown') {
          if (!nodes.some((n) => n.dimension === 'fabric' && n.value === it.fabric)) {
            nodes.push({
              id: `occ_${occ}_fab_${it.fabric}`,
              dimension: 'fabric',
              value: it.fabric,
              label: formatLabel(it.fabric),
              score: 0.7,
              confidence: 0.6,
              status: 'observed',
              evidenceSource: 'worn_history',
              sampleCount: 1,
              lastUpdated: w.wornAt || w.timestamp || now,
              description: `Observed in ${formatLabel(occ)} wear`,
            });
          }
        }
      }
    }

    occasionPreferences[occ] = nodes;
  }

  // --------------------------------------------------------------------------
  // 8. PERSONAL FASHION INSIGHTS (EVIDENCE-GROUNDED)
  // Strict rule: Suppress all insights if evidence is insufficient.
  // --------------------------------------------------------------------------
  const insights: StyleDNAInsight[] = [];

  if (hasSufficientEvidence) {
    // A. Colors repeatedly chosen
    const strongColor = colors.find((c) => c.score > 0.4 && c.confidence >= 0.4 && c.sampleCount >= 2);
    if (strongColor) {
      insights.push({
        id: 'ins_color_signature',
        type: 'color_frequency',
        title: `Color Anchor: ${strongColor.label}`,
        evidence: `You have selected ${strongColor.label.toLowerCase()} in ${strongColor.sampleCount} outfits with ${Math.round(strongColor.confidence * 100)}% consistency.`,
        confidence: strongColor.confidence,
        tags: [strongColor.value],
      });
    }

    // B. Signature Silhouette
    const strongFit = silhouettes.find((s) => s.score > 0.4 && s.confidence >= 0.4 && s.sampleCount >= 2);
    if (strongFit) {
      insights.push({
        id: 'ins_fit_signature',
        type: 'silhouette_signature',
        title: `Signature Cut: ${strongFit.label}`,
        evidence: `You reach for ${strongFit.value} proportions across everyday and tailored styling.`,
        confidence: strongFit.confidence,
        tags: [strongFit.value],
      });
    }

    // C. Underused Compatible Gem
    const topColorValues = new Set([
      ...colors.filter((c) => c.score > 0.25).map((c) => c.value.toLowerCase()),
      ...(profile.topColors || []).map((c) => c.toLowerCase()),
    ]);
    const topFitValues = new Set([
      ...silhouettes.filter((s) => s.score > 0.25).map((s) => s.value),
      ...(profile.topFits || []),
    ]);
    const topFabricValues = new Set([
      ...fabrics.filter((f) => f.score > 0.25).map((f) => f.value.toLowerCase()),
      ...(profile.topFabrics || []).map((f) => f.toLowerCase()),
    ]);

    const underusedGem = items.find(
      (item) =>
        item.status === 'clean' &&
        (!item.timesWorn || item.timesWorn <= 1) &&
        (item.colors.some((c) => topColorValues.has(c.toLowerCase())) ||
          (item.fit && topFitValues.has(item.fit)) ||
          (item.fabric && topFabricValues.has(item.fabric.toLowerCase())))
    );

    if (underusedGem) {
      insights.push({
        id: 'ins_underused_gem',
        type: 'underused_gem',
        title: `Wardrobe Gem: ${underusedGem.name}`,
        evidence: `Matches your favorite palette (${underusedGem.colors.join(', ')}) but has only been worn ${underusedGem.timesWorn || 0} times.`,
        confidence: 0.75,
        tags: [underusedGem.id],
        actionLabel: 'Style This Piece',
      });
    }

    // D. Everyday vs Occasion Preference Contrast
    const everydayColors = occasionPreferences['everyday']?.map((n) => n.value) || [];
    const officeColors = occasionPreferences['office']?.map((n) => n.value) || [];
    const festiveColors = occasionPreferences['festive']?.map((n) => n.value) || [];

    if (everydayColors.length > 0 && festiveColors.length > 0 && everydayColors[0] !== festiveColors[0]) {
      insights.push({
        id: 'ins_occasion_contrast',
        type: 'occasion_contrast',
        title: 'Contextual Rhythms: Daily vs Festive',
        evidence: `You shift toward ${festiveColors.join(', ')} for festive celebrations while keeping everyday wear centered in ${everydayColors.join(', ')}.`,
        confidence: 0.8,
      });
    } else if (everydayColors.length > 0 && officeColors.length > 0 && everydayColors[0] !== officeColors[0]) {
      insights.push({
        id: 'ins_occasion_contrast',
        type: 'occasion_contrast',
        title: 'Contextual Rhythms: Daily vs Workwear',
        evidence: `Your professional wardrobe is calibrated around ${officeColors.join(', ')} while daily wear explores ${everydayColors.join(', ')}.`,
        confidence: 0.75,
      });
    }

    // E. Emerging Preferences
    if (profile.recentExplorations && profile.recentExplorations.length > 0) {
      const emerging = profile.recentExplorations[0];
      insights.push({
        id: 'ins_emerging',
        type: 'emerging_trend',
        title: `Emerging Tone: ${formatLabel(emerging)}`,
        evidence: `You have begun experimenting with ${emerging} across recent looks with rising adoption.`,
        confidence: 0.65,
        tags: [emerging],
      });
    }
  }

  // --------------------------------------------------------------------------
  // 9. AVOIDANCE SUMMARY
  // --------------------------------------------------------------------------
  const avoidances = {
    colors: profile.avoidedColors || [],
    fabrics: profile.avoidedFabrics || (preferences?.fabricSensitivities || []),
    patterns: profile.avoidedPatterns || [],
    styles: preferences?.dislikedStyles || [],
  };

  return {
    version: STYLE_DNA_VERSION,
    userId: profile.userId,
    updatedAt: now,
    overallConfidence: profile.overallConfidence,
    totalSignalsCount,
    hasSufficientEvidence,
    aesthetics,
    colors,
    silhouettes,
    fabrics,
    patterns,
    culturalAffinities,
    occasionPreferences,
    insights,
    avoidances,
  };
}

/**
 * User Control: Explicitly sets or corrects an attribute preference in Style DNA.
 * Overrides previous inferred or contrary evidence with an authoritative explicit prior.
 */
export function correctStyleDNAPreference(
  profile: PersonalStyleProfile,
  items: WardrobeItem[],
  wearEvents: WearEvent[],
  preferences: StylePreferences | undefined,
  dimension: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion',
  key: string,
  targetAffinity: number
): { updatedProfile: PersonalStyleProfile; updatedDNA: StyleDNAProfile } {
  const updatedProfile = correctPreference(profile, dimension, key, targetAffinity);
  const updatedDNA = deriveStyleDNAProfile(updatedProfile, items, wearEvents, preferences);
  return { updatedProfile, updatedDNA };
}

/**
 * User Control: Removes an inferred preference, returning the attribute to an unobserved neutral state.
 */
export function removeStyleDNAPreference(
  profile: PersonalStyleProfile,
  items: WardrobeItem[],
  wearEvents: WearEvent[],
  preferences: StylePreferences | undefined,
  dimension: 'color' | 'fabric' | 'pattern' | 'fit',
  key: string
): { updatedProfile: PersonalStyleProfile; updatedDNA: StyleDNAProfile } {
  const now = Date.now();
  const resetAffinity: AttributeAffinity = {
    score: 0,
    confidence: 0,
    sampleCount: 0,
    lastInteractedAt: now,
    status: 'unknown',
    uncertainty: 1.0,
    provenance: {
      status: 'unknown',
      observationCount: 0,
      alpha: 1.0,
      beta: 1.0,
      variance: 0.0833,
      uncertainty: 1.0,
      credibleInterval: [-0.95, 0.95],
      signalCounts: {},
      lastInteractedAt: now,
      isExplicitOverride: false,
    },
  };

  const updatedProfile: PersonalStyleProfile = {
    ...profile,
    updatedAt: now,
  };

  switch (dimension) {
    case 'color': {
      const lk = key.toLowerCase();
      updatedProfile.colorAffinities = { ...profile.colorAffinities, [lk]: resetAffinity };
      updatedProfile.topColors = (updatedProfile.topColors || []).filter((c) => c !== lk);
      updatedProfile.avoidedColors = (updatedProfile.avoidedColors || []).filter((c) => c !== lk);
      break;
    }
    case 'fabric': {
      const fk = key as FabricType;
      updatedProfile.fabricAffinities = { ...profile.fabricAffinities, [fk]: resetAffinity };
      updatedProfile.topFabrics = (updatedProfile.topFabrics || []).filter((f) => f !== fk);
      updatedProfile.avoidedFabrics = (updatedProfile.avoidedFabrics || []).filter((f) => f !== fk);
      break;
    }
    case 'fit': {
      const ft = key as SilhouetteFit;
      updatedProfile.fitAffinities = { ...profile.fitAffinities, [ft]: resetAffinity };
      updatedProfile.topFits = (updatedProfile.topFits || []).filter((f) => f !== ft);
      break;
    }
    case 'pattern': {
      const pt = key as PatternType;
      updatedProfile.patternAffinities = { ...profile.patternAffinities, [pt]: resetAffinity };
      updatedProfile.avoidedPatterns = (updatedProfile.avoidedPatterns || []).filter((p) => p !== pt);
      break;
    }
  }

  const updatedDNA = deriveStyleDNAProfile(updatedProfile, items, wearEvents, preferences);
  return { updatedProfile, updatedDNA };
}

/**
 * User Control: Confirms an inferred or suggested preference, promoting it to explicit confirmed status.
 */
export function confirmStyleDNAPreference(
  profile: PersonalStyleProfile,
  items: WardrobeItem[],
  wearEvents: WearEvent[],
  preferences: StylePreferences | undefined,
  dimension: 'color' | 'fabric' | 'pattern' | 'fit',
  key: string
): { updatedProfile: PersonalStyleProfile; updatedDNA: StyleDNAProfile } {
  // Boost to authoritative positive prior
  return correctStyleDNAPreference(profile, items, wearEvents, preferences, dimension, key, 0.85);
}
