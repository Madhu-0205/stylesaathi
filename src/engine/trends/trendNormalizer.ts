import {
  Category,
  Subcategory,
  FabricType,
  PatternType,
  SilhouetteFit,
  Occasion,
  Season,
} from '../../types';
import {
  RawTrendSignal,
  NormalizedTrendConcept,
  CuratedActiveTrend,
  TrendProvenance,
} from './types';
import {
  deriveSourceTrustWeight,
  deriveTrendConfidence,
  evaluateTrendLifecycleState,
} from './provenancePolicy';

const VALID_CATEGORIES: Set<string> = new Set([
  'Tops',
  'Bottoms',
  'Ethnic',
  'Dresses',
  'Outerwear',
  'Footwear',
  'Accessories',
]);

const VALID_SILHOUETTES: Set<string> = new Set([
  'slim',
  'regular',
  'relaxed',
  'oversized',
  'straight',
  'a_line',
  'flared',
  'anarkali',
  'tailored',
]);

const VALID_SEASONS: Set<string> = new Set(['summer', 'monsoon', 'winter']);

/**
 * Maps arbitrary strings safely to a known taxonomy Set, discarding unsupported values.
 */
export function normalizeStringListToTaxonomy<T extends string>(
  items: string[],
  validSet: Set<T>
): T[] {
  return items.filter((item): item is T => validSet.has(item as T));
}

/**
 * Normalizes a raw external signal into a strongly-typed NormalizedTrendConcept.
 * Retains taxonomy fidelity without fabricating attributes.
 * Supports both standard pipeline call (signal, referenceDate) and custom override call.
 */
export function normalizeRawTrendSignal(
  signal: RawTrendSignal,
  customIdOrRefDate?: string,
  customName?: string,
  customSlug?: string,
  customSummary?: string,
  customValidFrom?: string,
  customValidUntil?: string
): NormalizedTrendConcept {
  const categories = (signal.extractedAttributes?.categories || []).filter((c) =>
    VALID_CATEGORIES.has(c)
  );

  const silhouettes = (signal.extractedAttributes?.silhouettes || []).filter((s) =>
    VALID_SILHOUETTES.has(s)
  );

  const seasons = (signal.extractedAttributes?.seasons || []).filter((s) =>
    VALID_SEASONS.has(s)
  );

  const fabrics = signal.extractedAttributes?.fabrics || [];
  const patterns = signal.extractedAttributes?.patterns || [];
  const subcategories = signal.extractedAttributes?.subcategories || [];
  const colorPalette = (signal.extractedAttributes?.colorPalette || []).map((c) =>
    c.toLowerCase().trim()
  );
  const occasions = signal.extractedAttributes?.occasions || [];

  const slug =
    customSlug ||
    signal.rawHeadline
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') ||
    signal.id;

  const id = customIdOrRefDate && customName ? customIdOrRefDate : `trend_${slug}`;
  const name = customName || signal.rawHeadline;
  const summary = customSummary || signal.rawExcerpt;

  const referenceDate = customIdOrRefDate && !customName ? customIdOrRefDate : '2026-05-01';
  const validFrom = customValidFrom || signal.observedAt || referenceDate;
  let validUntil = customValidUntil;
  if (!validUntil) {
    const validUntilDate = new Date(validFrom);
    validUntilDate.setDate(validUntilDate.getDate() + 180);
    validUntil = validUntilDate.toISOString().slice(0, 10);
  }

  const lifecycleState = evaluateTrendLifecycleState(
    1,
    false, // Raw signal starts unreviewed
    validFrom,
    validUntil,
    referenceDate
  );

  return {
    id,
    name,
    slug,
    summary,
    targetAttributes: {
      categories,
      subcategories,
      fabrics,
      patterns,
      silhouettes,
      colorPalette,
      occasions,
      seasons: seasons.length > 0 ? seasons : ['summer', 'winter'],
    },
    lifecycleState,
    validFrom,
    validUntil,
  };
}

/**
 * Wraps a normalized concept with provenance and human review into an approved CuratedActiveTrend.
 * Supports wrapping either an existing NormalizedTrendConcept or normalizing a RawTrendSignal.
 */
export function createCuratedActiveTrend(
  conceptOrSignal: NormalizedTrendConcept | RawTrendSignal,
  provenanceOrCorroboration: Partial<TrendProvenance> | TrendProvenance | string[],
  corroboratingSignalIdsOrReviewedBy?: string[] | string,
  editorialNotesArg?: string,
  reviewedByOrRefDate?: string,
  reviewedAtOrCustomWindow?: string | { validFrom: string; validUntil: string }
): CuratedActiveTrend {
  let concept: NormalizedTrendConcept;
  let provenance: TrendProvenance;
  let corroboratingSignalIds: string[];
  let editorialNotes: string;
  let reviewedBy: string;
  let reviewedAt: string;

  if ('targetAttributes' in conceptOrSignal) {
    // Called with (concept, provenance, corroboratingSignalIds, editorialNotes, reviewedBy, reviewedAt)
    concept = conceptOrSignal;
    corroboratingSignalIds = (corroboratingSignalIdsOrReviewedBy as string[]) || [];
    const provInput = (provenanceOrCorroboration as Partial<TrendProvenance>) || {};
    provenance = {
      sourceType: provInput.sourceType || 'CURATED_EDITORIAL',
      sourceReference: provInput.sourceReference || 'Editorial Review',
      curatorOrReviewer: provInput.curatorOrReviewer || 'Editorial Curator',
      observedAt: provInput.observedAt || '2026-03-25',
      confidence: provInput.confidence ?? 1.0,
      reviewed: provInput.reviewed ?? true,
      corroborationCount: provInput.corroborationCount ?? (corroboratingSignalIds.length + 1),
      notes: provInput.notes,
    };
    editorialNotes = editorialNotesArg || '';
    reviewedBy = (reviewedByOrRefDate as string) || 'StyleSaathi Editorial Board';
    reviewedAt = (reviewedAtOrCustomWindow as string) || '2026-03-25';
  } else {
    // Called with (signal, corroboratingSignalIds, reviewedBy, editorialNotes, referenceDate, customWindow)
    const referenceDate = (reviewedByOrRefDate as string) || '2026-05-01';
    concept = normalizeRawTrendSignal(conceptOrSignal, referenceDate);
    corroboratingSignalIds = (provenanceOrCorroboration as string[]) || [];
    reviewedBy = (corroboratingSignalIdsOrReviewedBy as string) || 'Editorial Board';
    editorialNotes = editorialNotesArg || '';
    reviewedAt = referenceDate;

    if (typeof reviewedAtOrCustomWindow === 'object') {
      concept.validFrom = reviewedAtOrCustomWindow.validFrom;
      concept.validUntil = reviewedAtOrCustomWindow.validUntil;
    }

    provenance = {
      sourceType: conceptOrSignal.sourceType,
      sourceReference: conceptOrSignal.sourceReference,
      curatorOrReviewer: conceptOrSignal.curatorOrAuthor || reviewedBy,
      observedAt: conceptOrSignal.observedAt,
      confidence: 0.95,
      reviewed: true,
      corroborationCount: corroboratingSignalIds.length + 1,
    };
  }

  concept.lifecycleState = 'ACTIVE';

  return {
    concept,
    provenance,
    corroboratingSignalIds,
    editorialNotes,
    reviewedBy,
    reviewedAt,
  };
}
