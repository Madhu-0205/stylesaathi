import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Layers, Compass, SlidersHorizontal } from 'lucide-react';
import { WardrobeGap } from '../../types';

export interface GapEvidenceCardProps {
  gap: WardrobeGap;
}

export const GapEvidenceCard: React.FC<GapEvidenceCardProps> = ({ gap }) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);

  const isCritical = gap.gapState === 'CRITICAL_GAP';
  const isObserved = gap.gapState === 'OBSERVED_GAP';
  const isHighUtil = gap.headline.toLowerCase().includes('high utilization');

  const badgeText = isHighUtil
    ? 'HIGH UTILIZATION'
    : isCritical
    ? 'CRITICAL WARDROBE GAP'
    : isObserved
    ? 'VERIFIED WARDROBE GAP'
    : 'DIAGNOSTIC ADVISORY';

  const badgeStyle = isCritical
    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
    : isObserved
    ? 'bg-(--kumkum)/10 text-(--kumkum) border-(--kumkum)/20'
    : 'bg-(--burnished-gold)/15 text-(--burnished-gold) border-(--burnished-gold)/30';

  return (
    <article
      className="rounded-2xl border border-(--border) bg-card p-5 sm:p-6 shadow-2xs space-y-4"
      aria-label={`${badgeText}: ${gap.headline}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              {badgeText}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/15 text-muted">
              {Math.round(gap.confidence * 100)}% Confidence
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                gap.purchaseAssessment === 'PURCHASE_JUSTIFIED'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {gap.purchaseAssessment === 'PURCHASE_JUSTIFIED'
                ? 'PURCHASE JUSTIFIED'
                : 'NO PURCHASE NEEDED'}
            </span>
          </div>

          <h2 className="font-serif text-lg sm:text-xl font-normal text-(--ink) tracking-tight">
            {gap.headline}
          </h2>
        </div>
      </div>

      {/* Narrative Explanation */}
      <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal">
        {gap.explanation}
      </p>

      {/* Structural Requirements Meta Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-(--ivory)/60 border border-(--border)/60 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted text-[11px] font-medium">
            <Layers className="w-3 h-3" aria-hidden="true" />
            <span>Target Role &amp; Category:</span>
          </div>
          <p className="font-semibold text-(--ink) capitalize">
            {gap.expectedCategory} ({gap.targetRole})
          </p>
          <p className="text-[11px] text-muted capitalize">
            Compatible: {gap.compatibleSubcategories.slice(0, 4).join(', ')}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted text-[11px] font-medium">
            <Compass className="w-3 h-3" aria-hidden="true" />
            <span>Active Occasions Affected:</span>
          </div>
          <p className="font-semibold text-(--ink) capitalize">
            {gap.activeOccasions.join(', ')}
          </p>
        </div>
      </div>

      {/* Style Brain Constraints (Read-only personal guidance) */}
      {gap.attributeGuidance && (
        <div className="rounded-xl border border-(--border)/70 bg-card p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-(--burnished-gold)">
            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
            <span>Personal Style Brain Guidance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
            {gap.attributeGuidance.avoidedFabrics.length > 0 && (
              <div>
                <span className="text-muted">Excluded fabrics: </span>
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  {gap.attributeGuidance.avoidedFabrics.join(', ')}
                </span>
              </div>
            )}
            {gap.attributeGuidance.preferredFabrics.length > 0 && (
              <div>
                <span className="text-muted">Preferred fabrics: </span>
                <span className="font-medium text-(--ink)">
                  {gap.attributeGuidance.preferredFabrics.join(', ')}
                </span>
              </div>
            )}
            {gap.attributeGuidance.avoidedColors && gap.attributeGuidance.avoidedColors.length > 0 && (
              <div>
                <span className="text-muted">Avoided colors: </span>
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  {gap.attributeGuidance.avoidedColors.join(', ')}
                </span>
              </div>
            )}
            {gap.attributeGuidance.formalityTarget !== undefined && (
              <div>
                <span className="text-muted">Target formality: </span>
                <span className="font-medium text-(--ink)">
                  {`Level ${gap.attributeGuidance.formalityTarget} / 5`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expandable Tier 1-6 Evidence Trail */}
      <div className="border-t border-(--border)/60 pt-2 space-y-2">
        <button
          type="button"
          onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
          className="min-h-[44px] w-full flex items-center justify-between py-2 text-xs font-semibold text-muted hover:text-(--ink) transition-colors cursor-pointer"
          aria-expanded={isEvidenceExpanded}
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Audited Evidence Trail ({gap.evidence.length} checkpoints)</span>
          </span>
          {isEvidenceExpanded ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        {isEvidenceExpanded && (
          <ul className="space-y-2 pt-1 pb-2 pl-2" aria-label="Evidence checkpoints">
            {gap.evidence.map((ev, idx) => (
              <li key={idx} className="space-y-0.5 text-xs text-(--ink)/90">
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                    {ev.tier.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-muted text-[11.5px] pl-2 border-l border-(--border)">
                  {ev.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
};
