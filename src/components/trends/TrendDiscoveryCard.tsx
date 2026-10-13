import React from 'react';
import { Compass, Sparkles, Shirt, ShieldCheck, Info, ChevronRight, Layers } from 'lucide-react';
import { TrendDiscoveryOpportunity, DiscoveryClassification } from '../../engine/trends/types';
import { TrendRevivalBanner } from './TrendRevivalBanner';

export interface TrendDiscoveryCardProps {
  opportunity: TrendDiscoveryOpportunity;
  onExplore: (opportunity: TrendDiscoveryOpportunity) => void;
  onInspectTelemetry: (opportunity: TrendDiscoveryOpportunity) => void;
}

function getBadgeStyle(classification: DiscoveryClassification): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (classification) {
    case 'STRONG_DISCOVERY':
      return {
        bg: 'bg-(--kumkum)/10',
        text: 'text-(--kumkum)',
        border: 'border-(--kumkum)/30',
        label: 'STRONG DISCOVERY',
      };
    case 'WARDROBE_RELEVANT':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-500/30',
        label: 'WARDROBE RELEVANT',
      };
    case 'STYLE_RELEVANT':
      return {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-500/30',
        label: 'STYLE RELEVANT',
      };
    case 'INFORMATIVE':
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-500/30',
        label: 'INFORMATIVE',
      };
  }
}

export const TrendDiscoveryCard: React.FC<TrendDiscoveryCardProps> = ({
  opportunity,
  onExplore,
  onInspectTelemetry,
}) => {
  const { trend, evidence } = opportunity;
  const { concept, provenance } = trend;
  const badge = getBadgeStyle(evidence.classification);

  const totalMatches =
    evidence.wardrobeCoverage.directMatchesCount +
    evidence.wardrobeCoverage.structuralSubstitutesCount;

  return (
    <article
      className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4 relative overflow-hidden transition-all hover:shadow-xs"
      aria-label={`Trend: ${concept.name}`}
    >
      {/* Top Header: Classification Badge & Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text} border ${badge.border}`}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          {badge.label}
        </span>

        <span className="text-[11px] text-muted font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          {provenance.sourceReference}
        </span>
      </div>

      {/* Title & Editorial Summary */}
      <div className="space-y-1">
        <h2 className="font-serif text-lg sm:text-xl font-normal text-(--ink) tracking-tight">
          {concept.name}
        </h2>
        <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal">
          {concept.summary}
        </p>
      </div>

      {/* Wardrobe Evidence Pill Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--ivory) border border-border text-(--ink) font-medium">
          <Shirt className="w-3.5 h-3.5 text-accent" />
          {totalMatches > 0
            ? `${totalMatches} matching ${totalMatches === 1 ? 'piece' : 'pieces'} owned`
            : 'No matching pieces currently owned'}
        </span>

        {concept.indianFashionContext?.isIndianFusion && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300 font-medium text-[11px]">
            <Compass className="w-3 h-3" />
            Indian Fusion
          </span>
        )}

        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 text-muted text-[11px]">
          Valid through {concept.validUntil}
        </span>
      </div>

      {/* Dormant Item Revival Banner if applicable */}
      {evidence.rotationOpportunity.hasDormantPieces && (
        <TrendRevivalBanner
          opportunity={opportunity}
          onRevive={() => onExplore(opportunity)}
        />
      )}

      {/* Learned Affinity Soft Warning if applicable */}
      {evidence.personalStyleAlignment.learnedAffinityPenalty && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-200">
          This trend uses silhouettes or fabrics you've previously rated with lower affinity, but remains explorable.
        </div>
      )}

      {/* Missing Complement pieces notice (informational only) */}
      {evidence.wardrobeCoverage.missingSlotRoles.length > 0 && totalMatches > 0 && (
        <p className="text-[11px] text-muted italic">
          Complementary pieces not currently in wardrobe:{' '}
          {evidence.wardrobeCoverage.missingSlotRoles.join(', ')} (informational only).
        </p>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
        <button
          type="button"
          onClick={() => onInspectTelemetry(opportunity)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-(--ink) transition-colors py-2 px-2.5 rounded-lg hover:bg-muted/10"
        >
          <Info className="w-3.5 h-3.5" />
          Inspect Evidence & Telemetry
        </button>

        <button
          type="button"
          onClick={() => onExplore(opportunity)}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-(--ink) text-(--card) text-xs font-semibold tracking-wide hover:opacity-90 active:scale-95 transition-all shadow-xs"
        >
          <Layers className="w-3.5 h-3.5" />
          Try With Your Wardrobe
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
};
