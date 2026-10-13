import React, { useState } from 'react';
import { ShoppingBag, Sparkles, CheckCircle2, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { useSmartBuy } from '../../hooks/useSmartBuy';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { WardrobeItem, OccasionReadiness } from '../../types';
import { NoPurchaseNeededCard } from './NoPurchaseNeededCard';
import { DormantRediscoveryCard } from './DormantRediscoveryCard';
import { GapEvidenceCard } from './GapEvidenceCard';
import { StyleItemSheet } from '../wardrobe/StyleItemSheet';
import { EmptyState } from '../common/EmptyState';

export interface SmartBuyReportViewProps {
  injectedReferenceTimestamp?: number;
}

export const SmartBuyReportView: React.FC<SmartBuyReportViewProps> = ({
  injectedReferenceTimestamp,
}) => {
  const { items, loadSample } = useWardrobeContext();
  const { report, dataSufficiency, gaps, purchaseAssessment, coverageSummary, negativeEvidence } =
    useSmartBuy({ referenceTimestamp: injectedReferenceTimestamp });

  const [stylingItem, setStylingItem] = useState<WardrobeItem | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-7 w-7 text-(--kumkum)" />}
        title="Your wardrobe gap intelligence is waiting"
        description="Add your clothing pieces or load the sample collection to evaluate genuine coverage gaps and dormant rediscovery opportunities."
        action={{
          label: 'Load Sample Wardrobe',
          onClick: loadSample,
        }}
      />
    );
  }

  const rediscoveryGaps = gaps.filter((g) => g.gapState === 'REDISCOVERY_SUGGESTED');
  const verifiedGaps = gaps.filter((g) => g.gapState !== 'REDISCOVERY_SUGGESTED');

  return (
    <div className="space-y-6 animate-fade-in" aria-label="Wardrobe Gap Intelligence Report">
      {/* 1. Data Sufficiency Diagnostic Alert (if insufficient data) */}
      {!dataSufficiency.isSufficient && (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex items-start gap-3.5"
          role="status"
          aria-live="polite"
        >
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs sm:text-sm">
            <h3 className="font-semibold text-(--ink)">
              Baseline Data Establishing ({Math.round(dataSufficiency.confidenceScore * 100)}% Confidence)
            </h3>
            <p className="text-muted leading-relaxed">
              {dataSufficiency.ineligibilityReason}
            </p>
            <p className="text-[11px] text-muted/90 pt-1">
              Currently tracked: {dataSufficiency.totalGarments} garments, {dataSufficiency.totalWearEvents} recorded wears, {dataSufficiency.activeOccasionsCount} active routines.
            </p>
          </div>
        </div>
      )}

      {/* 2. Primary Decision Outcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-(--border) pb-3">
        <div>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            PURCHASE DECISION SUPPORT
          </span>
          <h2 className="mt-0.5 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
            {purchaseAssessment === 'NO_PURCHASE_NEEDED'
              ? 'No purchase needed.'
              : 'Verified wardrobe gap detected.'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              purchaseAssessment === 'NO_PURCHASE_NEEDED'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}
          >
            {purchaseAssessment === 'NO_PURCHASE_NEEDED'
              ? 'NO PURCHASE NEEDED'
              : 'PURCHASE JUSTIFIED'}
          </span>
        </div>
      </div>

      {/* 3. Occasion Readiness Summary Audit (Section 26) */}
      <section
        className="rounded-2xl border border-(--border) bg-card p-4 sm:p-5 shadow-2xs space-y-3"
        aria-label="Occasion Readiness Audit"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            OCCASION READINESS AUDIT
          </span>
          <span className="text-[11px] font-medium text-muted">
            {coverageSummary.coveredOccasionsCount} of {coverageSummary.occasionReadiness.length} routines covered
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {coverageSummary.occasionReadiness.map((readiness: OccasionReadiness) => (
            <div
              key={readiness.occasion}
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                readiness.readiness === 'fully_ready'
                  ? 'bg-(--ivory)/60 border-(--border)/60 text-(--ink)'
                  : readiness.readiness === 'partially_ready'
                  ? 'bg-amber-500/5 border-amber-500/20 text-(--ink)'
                  : 'bg-rose-500/5 border-rose-500/20 text-(--ink)'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <span className="font-semibold capitalize block truncate">
                  {readiness.occasion}
                </span>
                <span className="text-[11px] text-muted block truncate">
                  {readiness.summaryText}
                </span>
              </div>

              {readiness.readiness === 'fully_ready' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-label="Fully ready" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Coverage shortage" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. No Purchase Needed Banner (if applicable) */}
      {purchaseAssessment === 'NO_PURCHASE_NEEDED' && (
        <NoPurchaseNeededCard
          negativeEvidence={negativeEvidence}
          totalGarments={coverageSummary.totalGarments}
        />
      )}

      {/* 5. Dormant Rediscovery Section (Section 13) */}
      {rediscoveryGaps.length > 0 && (
        <section className="space-y-3" aria-label="Dormant Rediscovery Opportunities">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
              CLOSET REDISCOVERY CANDIDATES
            </span>
            <span className="text-[11px] text-muted">
              Solve shortages with owned pieces
            </span>
          </div>

          <div className="grid gap-4">
            {rediscoveryGaps.map((gap) => (
              <DormantRediscoveryCard
                key={gap.id}
                gap={gap}
                onStyleItem={setStylingItem}
              />
            ))}
          </div>
        </section>
      )}

      {/* 6. Verified Gaps / Diagnostics Section */}
      {verifiedGaps.length > 0 && (
        <section className="space-y-3" aria-label="Wardrobe Gap Diagnoses">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
              EVIDENCE-AUDITED GAP DIAGNOSES
            </span>
            <span className="text-[11px] text-muted">
              Evidence-backed shortage analysis
            </span>
          </div>

          <div className="grid gap-4">
            {verifiedGaps.map((gap) => (
              <GapEvidenceCard key={gap.id} gap={gap} />
            ))}
          </div>
        </section>
      )}

      {/* 7. Phase 7 Style This Item Sheet Integration */}
      {stylingItem && (
        <StyleItemSheet
          anchorItem={stylingItem}
          isOpen={Boolean(stylingItem)}
          onClose={() => setStylingItem(null)}
        />
      )}
    </div>
  );
};
