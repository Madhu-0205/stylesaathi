import React from 'react';
import { Compass, Sparkles, CheckCircle2 } from 'lucide-react';
import { StyleEvolutionReport } from '../../engine/analytics';

interface StyleEvolutionCardProps {
  evolution: StyleEvolutionReport;
}

export const StyleEvolutionCard: React.FC<StyleEvolutionCardProps> = ({ evolution }) => {
  const { isEligible, ineligibilityReason, confidence, dimensions, significantShifts } = evolution;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-(--burnished-gold)" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            STYLE EVOLUTION
          </span>
        </div>
        {isEligible && (
          <span className="text-xs text-muted">
            {Math.round(confidence * 100)}% Confidence · 30d vs 60d Baseline
          </span>
        )}
      </div>

      {!isEligible ? (
        <div className="rounded-xl border border-dashed border-border bg-(--ivory)/60 p-4 text-center space-y-1.5">
          <p className="text-xs font-medium text-(--ink)">Style evolution establishing</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {ineligibilityReason ||
              'Requires at least 8 recorded wears in both the recent and baseline windows.'}
          </p>
        </div>
      ) : significantShifts.length === 0 ? (
        <div className="rounded-xl border border-border bg-(--ivory)/40 p-3.5 space-y-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-(--ink)">
            <CheckCircle2 className="h-4 w-4 text-(--moss)" />
            <span>Consistent Style Profile</span>
          </div>
          <p className="text-[11px] text-muted">
            Your recorded usage across color palettes, fabrics, and formalities has remained balanced and steady across recent periods.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {significantShifts.map((shift) => (
            <div
              key={shift.dimension}
              className="p-3.5 rounded-xl border border-(--burnished-gold)/40 bg-(--ivory)/40 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-(--kumkum)">
                  {shift.dimension} SHIFT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-(--ink) text-(--paper) text-[10px] font-bold">
                  {shift.deltaRatio > 0 ? `+${Math.round(shift.deltaRatio * 100)}%` : `${Math.round(shift.deltaRatio * 100)}%`}
                </span>
              </div>

              <p className="text-xs font-semibold text-(--ink) leading-snug">
                {shift.headline}
              </p>

              <div className="rounded-lg bg-card/80 p-2 border border-border/60">
                <p className="text-[10.5px] text-muted font-mono">
                  {shift.evidenceText}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
