import React from 'react';
import { RecommendedOutfit, WardrobeItem } from '../../types';
import { Sparkles, Check, Calendar, RefreshCw, ShoppingBag, Shirt } from 'lucide-react';
import { ItemImage } from '../common/ItemImage';
import { getCompatibilityDescriptor } from '../../utils/scoreFormatter';

interface SaathiRecommendationCardProps {
  outfit: RecommendedOutfit;
  onPlanLook?: (outfit: RecommendedOutfit) => void;
  onOpenInAtelier?: (outfit: RecommendedOutfit) => void;
  onShowAlternative?: () => void;
  onAssessPurchase?: () => void;
  onStyleThis?: (item: WardrobeItem) => void;
}

export const SaathiRecommendationCard: React.FC<SaathiRecommendationCardProps> = ({
  outfit,
  onPlanLook,
  onOpenInAtelier,
  onShowAlternative,
  onAssessPurchase,
  onStyleThis,
}) => {
  const pieces = Object.entries(outfit.slots || {}).flatMap(([role, items]) =>
    items.map((item) => ({ role, item }))
  );

  const reasons = outfit.explanation?.reasons?.slice(0, 3) || [];

  return (
    <div
      className="mt-3 rounded-2xl couture-card p-4 space-y-3 shadow-2xs"
      data-testid="saathi-recommendation-card"
    >
      <div className="flex items-center justify-between border-b border-(--border)/40 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {outfit.template || 'Curated Look'}
          </span>
        </div>
        {outfit.score !== undefined && (() => {
          const descriptor = getCompatibilityDescriptor(outfit.score);
          return (
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${descriptor.badgeClass}`}
              title={descriptor.heuristicNote}
            >
              {descriptor.label}
            </span>
          );
        })()}
      </div>

      {/* Garment Pieces List with Photo / Textile Plate Thumbnails */}
      <div className="space-y-2">
        {pieces.map((p, idx) => (
          <div
            key={p.item?.id || idx}
            className="flex items-center justify-between p-2 rounded-lg bg-(--ivory)/40 border border-border/50 text-xs gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-10 rounded-md overflow-hidden shrink-0 border border-border/70 bg-card">
                {p.item ? (
                  <ItemImage item={p.item} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-(--ivory)">
                    <Shirt className="w-4 h-4 text-muted" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-(--ink) truncate block">
                  {p.item?.name}
                </span>
                <span className="text-[10px] text-muted capitalize truncate block">
                  {p.item?.colors?.join('/') || p.role} • {p.item?.fabric || p.role}
                </span>
              </div>
            </div>

            {onStyleThis && p.item && (
              <button
                type="button"
                onClick={() => onStyleThis(p.item)}
                title={`Style around ${p.item.name}`}
                className="shrink-0 min-h-11 inline-flex items-center justify-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-card text-muted hover:text-(--ink) transition-colors tactile-press"
              >
                Anchor
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Verified Reasons from Telemetry */}
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

      {/* Authentic Dimension Indicators (Displayed strictly when engine provides them) */}
      {outfit.scoreBreakdown && (
        <div className="pt-1.5 border-t border-(--border)/40 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-semibold text-muted">Dimensions:</span>
          {typeof outfit.scoreBreakdown.baseCompatibility === 'number' && (
            <span className="px-1.5 py-0.5 rounded bg-(--ivory) border border-border text-muted">
              Harmony: {outfit.scoreBreakdown.baseCompatibility.toFixed(1)}
            </span>
          )}
          {typeof outfit.scoreBreakdown.personalStyle === 'number' && (
            <span className="px-1.5 py-0.5 rounded bg-(--ivory) border border-border text-muted">
              Style: {outfit.scoreBreakdown.personalStyle.toFixed(1)}
            </span>
          )}
          {typeof outfit.scoreBreakdown.contextFit === 'number' && (
            <span className="px-1.5 py-0.5 rounded bg-(--ivory) border border-border text-muted">
              Context: {outfit.scoreBreakdown.contextFit.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Actionable Controls Strip (≥44px touch targets) */}
      <div className="pt-2 border-t border-border/40 flex flex-wrap gap-2">
        {onOpenInAtelier && (
          <button
            type="button"
            onClick={() => onOpenInAtelier(outfit)}
            className="flex-1 min-h-11 px-3 rounded-xl bg-accent text-white hover:opacity-90 active:scale-95 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-2xs couture-press cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
            <span>Open in Atelier</span>
          </button>
        )}

        {onPlanLook && (
          <button
            type="button"
            onClick={() => onPlanLook(outfit)}
            className="min-h-11 px-3.5 rounded-xl border border-border bg-card hover:bg-(--ivory) active:scale-95 text-xs font-semibold uppercase tracking-wider text-(--ink) flex items-center justify-center gap-1.5 transition-all shadow-2xs couture-press cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-(--kumkum)" />
            <span>Plan this look in Calendar</span>
          </button>
        )}

        {onShowAlternative && (
          <button
            type="button"
            onClick={onShowAlternative}
            className="min-h-11 px-3.5 rounded-xl border border-border bg-card hover:bg-(--ivory) active:scale-95 text-xs font-semibold text-(--ink) flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted" />
            <span>Alternative</span>
          </button>
        )}

        {onAssessPurchase && (
          <button
            type="button"
            onClick={onAssessPurchase}
            className="min-h-11 px-3.5 rounded-xl border border-border bg-card hover:bg-(--ivory) active:scale-95 text-xs font-semibold text-(--ink) flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-muted" />
            <span>Need to Buy?</span>
          </button>
        )}
      </div>
    </div>
  );
};
