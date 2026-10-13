import React from 'react';
import { RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { RotationHealthMetrics, ItemRotationAnalysis } from '../../engine/analytics';
import { ItemImage } from '../common/ItemImage';
import { WardrobeItem } from '../../types';

interface RotationHealthCardProps {
  rotation: RotationHealthMetrics;
  onStyleItem?: (item: WardrobeItem) => void;
}

export const RotationHealthCard: React.FC<RotationHealthCardProps> = ({
  rotation,
  onStyleItem,
}) => {
  const {
    isEligible,
    ineligibilityReason,
    rotationHealthPercentage,
    totalCleanItems,
    activeCount,
    occasionalCount,
    dormantCount,
    neverWornCount,
    itemsByState,
  } = rotation;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-(--burnished-gold)" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            ROTATION HEALTH
          </span>
        </div>
        {isEligible && rotationHealthPercentage !== undefined && (
          <span className="text-xs font-semibold text-(--ink)">
            {rotationHealthPercentage}% In Active Rotation
          </span>
        )}
      </div>

      {!isEligible ? (
        <div className="rounded-xl border border-dashed border-border bg-(--ivory)/60 p-4 text-center space-y-1.5">
          <p className="text-xs font-medium text-(--ink)">Rotation baseline establishing</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {ineligibilityReason || 'Log at least 10 wears across 5 clean pieces to unlock rotation health.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-shade Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-(--border)/40 overflow-hidden flex">
              {totalCleanItems > 0 && (
                <>
                  <div
                    style={{ width: `${(activeCount / totalCleanItems) * 100}%` }}
                    className="bg-(--moss) transition-all duration-500"
                    title={`Active: ${activeCount}`}
                  />
                  <div
                    style={{ width: `${(occasionalCount / totalCleanItems) * 100}%` }}
                    className="bg-(--burnished-gold) transition-all duration-500"
                    title={`Occasional: ${occasionalCount}`}
                  />
                  <div
                    style={{ width: `${(dormantCount / totalCleanItems) * 100}%` }}
                    className="bg-(--kumkum) transition-all duration-500"
                    title={`Dormant: ${dormantCount}`}
                  />
                  <div
                    style={{ width: `${(neverWornCount / totalCleanItems) * 100}%` }}
                    className="bg-muted/40 transition-all duration-500"
                    title={`Never Worn: ${neverWornCount}`}
                  />
                </>
              )}
            </div>

            {/* Legend Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-(--moss)" />
                <span className="text-muted">Active:</span>
                <span className="font-semibold text-(--ink)">{activeCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-(--burnished-gold)" />
                <span className="text-muted">Occasional:</span>
                <span className="font-semibold text-(--ink)">{occasionalCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-(--kumkum)" />
                <span className="text-muted">Dormant:</span>
                <span className="font-semibold text-(--ink)">{dormantCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted/60" />
                <span className="text-muted">Never Worn:</span>
                <span className="font-semibold text-(--ink)">{neverWornCount}</span>
              </div>
            </div>
          </div>

          {/* Dormant Items Quick Action CTA */}
          {itemsByState.dormant.length > 0 && onStyleItem && (
            <div className="pt-2 border-t border-(--border)/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  DORMANT PIECES TO ROTATE ({itemsByState.dormant.length})
                </span>
                <span className="text-[10px] text-muted">Untouched &gt; 90 days</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {itemsByState.dormant.slice(0, 4).map(({ item, lastWornDaysAgo }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-border bg-(--ivory)/40 gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-border/80">
                        <ItemImage item={item} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-(--ink) truncate">{item.name}</p>
                        <p className="text-[10px] text-muted">
                          {lastWornDaysAgo !== undefined
                            ? `Last worn ${lastWornDaysAgo}d ago`
                            : 'Dormant'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStyleItem(item)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--ink) text-(--paper) hover:bg-(--ink)/90 text-[10px] font-semibold tracking-wider uppercase active:scale-95 transition-transform"
                    >
                      <Sparkles className="h-3 w-3 text-(--burnished-gold)" />
                      <span>Style</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
