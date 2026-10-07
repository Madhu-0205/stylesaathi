import React from 'react';
import { Check } from 'lucide-react';
import { Occasion } from '../../types';

interface OccasionCoverageListProps {
  coverage: {
    occasion: Occasion;
    isCovered: boolean;
    outfitCount: number;
  }[];
}

export const OccasionCoverageList: React.FC<OccasionCoverageListProps> = ({ coverage }) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between border-b border-border pb-3 mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            READINESS
          </span>
          <h3 className="mt-0.5 font-serif text-xl font-normal text-(--ink)">
            Occasion Coverage
          </h3>
        </div>
        <span className="text-[11px] text-muted font-medium">Clean items</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {coverage.map((c) => (
          <div
            key={c.occasion}
            className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
              c.isCovered
                ? 'border-border bg-(--ivory)/60'
                : 'border-dashed border-border bg-card'
            }`}
          >
            <span className="truncate text-xs font-semibold capitalize text-(--ink)">
              {c.occasion}
            </span>
            {c.isCovered ? (
              <span className="flex items-center gap-1 rounded bg-(--ink) px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--paper)">
                <Check className="h-2.5 w-2.5 stroke-3 text-(--burnished-gold)" />
                Ready
              </span>
            ) : (
              <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
                Gap
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

