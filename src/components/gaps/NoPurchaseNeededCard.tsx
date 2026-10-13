import React from 'react';
import { CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { NegativeEvidence } from '../../types';

export interface NoPurchaseNeededCardProps {
  negativeEvidence: NegativeEvidence;
  totalGarments: number;
}

export const NoPurchaseNeededCard: React.FC<NoPurchaseNeededCardProps> = ({
  negativeEvidence,
  totalGarments,
}) => {
  const {
    primaryReason,
    details,
    rediscoveryOpportunitiesCount,
    concentrationAdvisory,
  } = negativeEvidence;

  return (
    <article
      className="rounded-2xl border border-(--border) bg-card p-5 sm:p-6 shadow-2xs space-y-4"
      aria-label="No purchase needed assessment"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              NO PURCHASE NEEDED
            </span>
            {rediscoveryOpportunitiesCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-(--burnished-gold)/10 text-(--burnished-gold) border border-(--burnished-gold)/20">
                <RefreshCw className="w-2.5 h-2.5" aria-hidden="true" />
                {rediscoveryOpportunitiesCount} Dormant Solution{rediscoveryOpportunitiesCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-normal text-(--ink) tracking-tight">
            Your wardrobe baseline is complete.
          </h2>
        </div>
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal">
        {primaryReason}
      </p>

      {details.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-(--border)/60" aria-label="Evidence details">
          {details.map((detail, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-xs text-(--ink)/80">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}

      {concentrationAdvisory && (
        <div className="rounded-xl border border-(--border)/70 bg-(--ivory)/60 p-3 text-[11px] text-muted leading-relaxed">
          <span className="font-semibold text-(--ink)">Stylist Rotation Tip: </span>
          {concentrationAdvisory}
        </div>
      )}

      <footer className="pt-2 flex items-center justify-between text-[11px] text-muted border-t border-(--border)/40">
        <span>Wardrobe capacity: {totalGarments} pieces</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">100% Demand Covered</span>
      </footer>
    </article>
  );
};
