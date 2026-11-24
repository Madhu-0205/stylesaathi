import React from 'react';
import { Compass, Sparkles, Shirt, ShieldCheck, Info, ChevronRight, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { TrendDiscoveryOpportunity, DiscoveryClassification } from '../../engine/trends/types';
import { WardrobeItem } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { TrendRevivalBanner } from './TrendRevivalBanner';

export interface TrendDiscoveryCardProps {
  opportunity: TrendDiscoveryOpportunity;
  onExplore: (opportunity: TrendDiscoveryOpportunity) => void;
  onInspectTelemetry: (opportunity: TrendDiscoveryOpportunity) => void;
  wardrobeItems?: WardrobeItem[];
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
  wardrobeItems = [],
}) => {
  const { trend, evidence } = opportunity;
  const { concept, provenance } = trend;
  const badge = getBadgeStyle(evidence.classification);

  const isStale = concept.validUntil ? new Date(concept.validUntil).getTime() < Date.now() : false;
  const isEvergreen = provenance.sourceType === 'INDIAN_HERITAGE_CURATION';

  const totalMatches =
    evidence.wardrobeCoverage.directMatchesCount +
    evidence.wardrobeCoverage.structuralSubstitutesCount;

  // Resolve matching pieces from wardrobe
  const matchedPieces = wardrobeItems.filter((i) =>
    evidence.wardrobeCoverage.matchingOwnedItemIds?.includes(i.id)
  );

  return (
    <article
      className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs space-y-4 relative overflow-hidden transition-all hover:shadow-sm couture-card specular-border"
      aria-label={`Trend: ${concept.name}`}
    >
      {/* Top Header: Classification Badge & Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text} border ${badge.border}`}
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            {badge.label}
          </span>
          {isEvergreen && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-bold uppercase tracking-wider">
              Evergreen Inspiration
            </span>
          )}
          {isStale && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[9.5px] font-bold uppercase tracking-wider">
              <AlertCircle className="w-3 h-3" />
              Concluded ({concept.validUntil})
            </span>
          )}
        </div>

        <span className="text-[11px] text-muted font-medium flex items-center gap-1.5" title={`Source: ${provenance.sourceReference} • Observed: ${provenance.observedAt}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          <span className="truncate max-w-[200px]">{provenance.sourceReference} ({provenance.observedAt})</span>
        </span>
      </div>

      {/* Title & Editorial Summary */}
      <div className="space-y-1.5">
        <h2 className="font-serif text-xl sm:text-2xl font-normal text-(--ink) tracking-tight">
          {concept.name}
        </h2>
        <p className="text-xs sm:text-sm text-muted leading-relaxed font-sans font-normal">
          {concept.summary}
        </p>
      </div>

      {/* Matching Owned Garments Visual Strip */}
      {matchedPieces.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-(--ivory)/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-sans">
            <span className="font-semibold text-(--ink) flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Recreate with your owned pieces ({matchedPieces.length}):
            </span>
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ₹0 Required
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto py-1 no-scrollbar">
            {matchedPieces.map((piece) => (
              <div
                key={piece.id}
                className="group/thumb relative h-20 w-16 shrink-0 rounded-xl overflow-hidden border border-border bg-card shadow-2xs transition-transform hover:scale-105"
                title={`${piece.name} (${piece.fabric || piece.subcategory})`}
              >
                <ItemImage item={piece} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1 py-0.5 text-[8px] font-medium text-white backdrop-blur-xs">
                  {piece.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wardrobe Evidence Pill Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-(--ivory) border border-border/80 text-(--ink) font-medium text-[11px]">
          <Shirt className="w-3.5 h-3.5 text-accent" />
          {totalMatches > 0
            ? `${totalMatches} matching ${totalMatches === 1 ? 'piece' : 'pieces'} in rotation`
            : 'Explore styling with structural substitutes'}
        </span>

        {concept.indianFashionContext?.isIndianFusion && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300 font-medium text-[11px]">
            <Compass className="w-3 h-3" />
            Indian Fusion · {concept.indianFashionContext.regionalHeritage || 'Artisanal'}
          </span>
        )}

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/10 text-muted text-[11px]">
          Observed {provenance.observedAt} · Valid through {concept.validUntil}
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
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
        <button
          type="button"
          onClick={() => onInspectTelemetry(opportunity)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-(--ink) transition-colors py-2 px-3 rounded-full hover:bg-muted/10 tactile-press-sm"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Inspect Provenance ({Math.round(provenance.confidence * 100)}% verified)</span>
        </button>

        <button
          type="button"
          onClick={() => onExplore(opportunity)}
          className="inline-flex items-center gap-1.5 min-h-11 px-5 py-2 rounded-full bg-(--ink) text-(--paper) text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs tactile-press"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Try With Your Wardrobe</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
};
