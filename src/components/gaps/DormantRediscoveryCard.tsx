import React from 'react';
import { Sparkles, ArrowRight, Clock, Tag } from 'lucide-react';
import { WardrobeGap, WardrobeItem } from '../../types';

export interface DormantRediscoveryCardProps {
  gap: WardrobeGap;
  onStyleItem: (item: WardrobeItem) => void;
}

export const DormantRediscoveryCard: React.FC<DormantRediscoveryCardProps> = ({
  gap,
  onStyleItem,
}) => {
  const candidate = gap.rediscoveryCandidate;
  if (!candidate) return null;

  const item = candidate.item;

  return (
    <article
      className="rounded-2xl border border-(--burnished-gold)/40 bg-card p-5 sm:p-6 shadow-2xs space-y-4 relative overflow-hidden"
      aria-label={`Dormant rediscovery suggestion for ${item.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-(--burnished-gold)/15 text-(--burnished-gold) border border-(--burnished-gold)/30">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              REDISCOVER IN YOUR WARDROBE
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/20 text-muted">
              NO PURCHASE NEEDED
            </span>
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-normal text-(--ink) tracking-tight">
            {gap.headline}
          </h2>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal">
        {gap.explanation}
      </p>

      {/* Garment Details Card */}
      <div className="flex items-center gap-3.5 p-3 rounded-xl bg-(--ivory)/60 border border-(--border)/60">
        {item.photo || item.photoUrl ? (
          <img
            src={(item.photo || item.photoUrl) as string}
            alt={item.name}
            className="w-14 h-14 object-cover rounded-lg border border-(--border) shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-(--border-light) flex items-center justify-center text-(--burnished-gold) font-serif font-bold text-lg shrink-0">
            {item.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-sm font-semibold text-(--ink) truncate">
            {item.name}
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="capitalize">{item.subcategory}</span>
            {item.colors && item.colors.length > 0 && (
              <>
                <span>•</span>
                <span className="capitalize">{item.colors[0]}</span>
              </>
            )}
            {item.fabric && (
              <>
                <span>•</span>
                <span className="capitalize">{item.fabric}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-(--burnished-gold) font-medium pt-0.5">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>Dormant in closet — Ready to be restyled</span>
          </div>
        </div>
      </div>

      {/* Target Occasions & Evidence */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-muted">Solves demand for:</span>
        {candidate.resolvedOccasions.map((occ) => (
          <span
            key={occ}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-card border border-(--border) text-(--ink)"
          >
            <Tag className="w-2.5 h-2.5 text-muted" aria-hidden="true" />
            <span className="capitalize">{occ}</span>
          </span>
        ))}
      </div>

      {/* Phase 7 Style This Item Action Button */}
      <div className="pt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onStyleItem(item)}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-(--kumkum) text-white shadow-xs hover:opacity-95 focus:outline-hidden focus:ring-2 focus:ring-(--kumkum) focus:ring-offset-2 transition-all cursor-pointer"
          aria-label={`Style ${item.name} in Style This Item`}
        >
          <span>STYLE THIS ITEM</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
