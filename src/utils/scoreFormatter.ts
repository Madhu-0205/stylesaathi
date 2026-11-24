/**
 * Score Formatter & Descriptive Compatibility Utility
 * 
 * Safely converts recommendation engine scores into honest presentation labels and normalized values.
 * 
 * NOTE: The recommendation engine produces an additive/subtractive utility score spanning
 * roughly ~2.0 to ~9.5 (scoring.ts). It is NOT a bounded percentage.
 * 
 * To protect data integrity and avoid displaying misleading percentages (such as "618% Match"),
 * recommendation scores are presented using descriptive compatibility tiers:
 * - Exceptional Resonance (≥ 7.0)
 * - Harmonious Match (5.5 – 6.9)
 * - Balanced Everyday Ensemble (4.0 – 5.4)
 * - Experimental Pairing (< 4.0)
 * 
 * These tiers are heuristic presentation labels, not scientifically validated classifications.
 * Dimension-level explanations are displayed ONLY when the underlying engine provides corresponding data.
 * Fabricated dimension scores are strictly prohibited.
 */

export type CompatibilityTier =
  | 'exceptional'
  | 'harmonious'
  | 'balanced'
  | 'experimental'
  | 'unrated';

export interface CompatibilityDescriptor {
  tier: CompatibilityTier;
  label: string;
  sublabel: string;
  badgeClass: string;
  heuristicNote: string;
}

export function getCompatibilityDescriptor(score: number | null | undefined): CompatibilityDescriptor {
  if (score == null || typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) {
    return {
      tier: 'unrated',
      label: 'Curated Ensemble',
      sublabel: 'Awaiting style profile telemetry',
      badgeClass: 'bg-(--ivory) border-border text-muted',
      heuristicNote: 'Heuristic presentation label: unrated baseline ensemble.',
    };
  }

  if (score >= 7.0) {
    return {
      tier: 'exceptional',
      label: 'Exceptional Resonance',
      sublabel: 'Masterful cohesion across palette, silhouette & occasion',
      badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
      heuristicNote: 'Heuristic presentation label: high multi-factor utility resonance.',
    };
  } else if (score >= 5.5) {
    return {
      tier: 'harmonious',
      label: 'Harmonious Match',
      sublabel: 'Well-balanced styling with natural occasion affinity',
      badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300',
      heuristicNote: 'Heuristic presentation label: balanced everyday aesthetic affinity.',
    };
  } else if (score >= 4.0) {
    return {
      tier: 'balanced',
      label: 'Balanced Everyday Ensemble',
      sublabel: 'Reliable everyday coordination with versatile styling',
      badgeClass: 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300',
      heuristicNote: 'Heuristic presentation label: baseline functional coordination.',
    };
  } else {
    return {
      tier: 'experimental',
      label: 'Experimental Pairing',
      sublabel: 'Unconventional juxtaposition with creative flair',
      badgeClass: 'bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300',
      heuristicNote: 'Heuristic presentation label: exploratory combination.',
    };
  }
}

/**
 * Backward-compatible utility to convert recommendation engine scores into normalized integer percentages (0–100).
 * Preserves ranking order and monotonicity without inflating or inventing values.
 */
export function formatRecommendationScore(score: number | null | undefined): number {
  if (score == null || typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) {
    return 0;
  }

  // Scores at or below zero (e.g. heavy wear penalty or unviable candidates) map to 0%
  if (score <= 0) {
    return 0;
  }

  // Recommendation engine produces 0–10 scale:
  // Scale by 10 to obtain percentage, and clamp strictly to [0, 100]
  const percentage = Math.round(score * 10);
  return Math.min(100, Math.max(0, percentage));
}
