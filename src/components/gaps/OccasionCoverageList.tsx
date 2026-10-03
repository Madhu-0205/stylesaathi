import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
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
    <div className="rounded-3xl border border-(--border) bg-(--card) p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-(--text)">
          Occasion Coverage
        </h3>
        <span className="text-[11px] text-(--muted)">Calculated from clean items</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {coverage.map((c) => (
          <div
            key={c.occasion}
            className={`flex items-center justify-between rounded-2xl border p-2.5 transition-colors ${
              c.isCovered
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20'
                : 'border-amber-200 bg-amber-50/50 dark:border-amber-950 dark:bg-amber-950/20'
            }`}
          >
            <span className="truncate text-xs font-semibold capitalize text-(--text)">
              {c.occasion}
            </span>
            {c.isCovered ? (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                <Check className="h-2.5 w-2.5 stroke-3" />
                Ready
              </span>
            ) : (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                Gap
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
