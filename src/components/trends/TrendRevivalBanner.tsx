import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { TrendDiscoveryOpportunity } from '../../engine/trends/types';

export interface TrendRevivalBannerProps {
  opportunity: TrendDiscoveryOpportunity;
  onRevive?: () => void;
}

export const TrendRevivalBanner: React.FC<TrendRevivalBannerProps> = ({
  opportunity,
  onRevive,
}) => {
  const rotation = opportunity.evidence.rotationOpportunity;
  if (!rotation.hasDormantPieces) return null;

  const itemNames = rotation.dormantItemNames.join(', ');

  return (
    <div
      className="rounded-xl border border-(--burnished-gold)/40 bg-(--ivory)/90 p-3 sm:p-3.5 space-y-2 text-xs"
      aria-label="Wardrobe dormant item revival opportunity"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-(--burnished-gold)/20 text-(--ink) border border-(--burnished-gold)/40">
          <Sparkles className="w-3 h-3 text-(--burnished-gold)" aria-hidden="true" />
          DORMANT PIECE REVIVAL
        </span>
        <span className="text-[10px] text-muted font-medium">Phase 8 Wear Analytics</span>
      </div>

      <p className="text-muted leading-relaxed">
        {opportunity.revivalAnchorItem ? (
          <>
            Your <strong className="text-(--ink)">{opportunity.revivalAnchorItem.name}</strong> has not been worn recently. It matches this trend and can serve as your anchor piece.
          </>
        ) : (
          <>
            You have unworn matching pieces (<strong className="text-(--ink)">{itemNames}</strong>) that align with this trend.
          </>
        )}
      </p>

      {onRevive && (
        <button
          type="button"
          onClick={onRevive}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--burnished-gold) hover:underline pt-1"
        >
          <RefreshCw className="w-3 h-3" />
          Style with this piece
        </button>
      )}
    </div>
  );
};
