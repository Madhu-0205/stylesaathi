import React from 'react';
import { RecommendedOutfit } from '../../types';
import { Sparkles, Shirt, Check } from 'lucide-react';

interface SaathiRecommendationCardProps {
  outfit: RecommendedOutfit;
  onPlanLook?: (outfit: RecommendedOutfit) => void;
}

export const SaathiRecommendationCard: React.FC<SaathiRecommendationCardProps> = ({
  outfit,
  onPlanLook,
}) => {
  const pieces = Object.entries(outfit.slots || {}).flatMap(([role, items]) =>
    items.map((item) => ({ role, item }))
  );

  const reasons = outfit.explanation?.reasons?.slice(0, 3) || [];

  return (
    <div
      className="mt-3 rounded-xl border border-(--border) bg-card p-4 space-y-3 shadow-2xs"
      data-testid="saathi-recommendation-card"
    >
      <div className="flex items-center justify-between border-b border-(--border)/40 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {outfit.template || 'Curated Look'}
          </span>
        </div>
        {outfit.score !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-(--ivory) border border-(--border) text-(--ink)">
            {`${Math.round(outfit.score * 100)}% Match`}
          </span>
        )}
      </div>

      {/* Garment Pieces List */}
      <div className="space-y-1.5">
        {pieces.map((p, idx) => (
          <div
            key={p.item?.id || idx}
            className="flex items-center justify-between p-2 rounded-lg bg-(--ivory)/40 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Shirt className="w-3.5 h-3.5 text-muted shrink-0" />
              <span className="font-semibold text-(--ink) truncate">
                {p.item?.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted capitalize">
                {p.item?.colors?.join('/') || p.role}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Verified Reasons from Phase 5 Telemetry */}
      {reasons.length > 0 && (
        <div className="pt-1 border-t border-(--border)/40 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Why this works
          </span>
          {reasons.map((r, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-muted">
              <Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {onPlanLook && (
        <button
          type="button"
          onClick={() => onPlanLook(outfit)}
          className="w-full min-h-11 mt-1 rounded-lg bg-(--ivory) hover:bg-(--border) text-(--ink) text-xs font-semibold uppercase tracking-wider transition-colors active:scale-98"
        >
          Plan this look in Calendar →
        </button>
      )}
    </div>
  );
};
