import React from 'react';
import { WardrobeGapReport } from '../../engine/smartBuy/types';
import { PurchaseAssessment } from '../../types';
import { ShieldCheck, AlertCircle, RefreshCw, ShoppingBag } from 'lucide-react';

export interface SaathiSmartBuyAssessmentData {
  verdict?: any;
  purchaseVerdict?: 'NO_PURCHASE_NEEDED' | 'PURCHASE_OPTIONAL' | 'PURCHASE_RECOMMENDED' | 'PURCHASE_STRONGLY_RECOMMENDED' | 'INSUFFICIENT_INFORMATION' | string;
  headline?: string;
  summary?: string;
  dormantRediscoveries?: any[];
  occasionGaps?: any[];
  evidenceHierarchy?: string[];
  confidenceScore?: number;
  evaluatedPieces?: any[];
  laundryNotice?: string;
}

interface SaathiSmartBuyCardProps {
  report?: WardrobeGapReport;
  assessment?: PurchaseAssessment | SaathiSmartBuyAssessmentData;
}

export const SaathiSmartBuyCard: React.FC<SaathiSmartBuyCardProps> = ({ report, assessment }) => {
  const isObj = typeof assessment === 'object' && assessment !== null;
  const assessmentObj = isObj ? (assessment as SaathiSmartBuyAssessmentData) : undefined;
  const rawVerdict =
    assessmentObj?.purchaseVerdict ||
    assessmentObj?.verdict ||
    (typeof assessment === 'string' ? assessment : undefined) ||
    report?.purchaseAssessment ||
    'NO_PURCHASE_NEEDED';

  const isNoPurchase =
    rawVerdict === 'NO_PURCHASE_NEEDED' ||
    rawVerdict === 'PURCHASE_OPTIONAL' ||
    rawVerdict === 'OPTIONAL_GAP' ||
    rawVerdict === 'NO_VALID_OUTFIT' ||
    rawVerdict === 'INSUFFICIENT_INFORMATION';

  const badgeText =
    rawVerdict === 'PURCHASE_OPTIONAL' || rawVerdict === 'OPTIONAL_GAP'
      ? 'PURCHASE OPTIONAL'
      : rawVerdict === 'PURCHASE_STRONGLY_RECOMMENDED'
      ? 'PURCHASE STRONGLY RECOMMENDED'
      : rawVerdict === 'PURCHASE_RECOMMENDED'
      ? 'PURCHASE RECOMMENDED'
      : rawVerdict === 'WARDROBE_GAP'
      ? 'PURCHASE STRONGLY RECOMMENDED'
      : rawVerdict === 'NO_VALID_OUTFIT'
      ? 'LAUNDRY BOTTLENECK'
      : rawVerdict === 'INSUFFICIENT_INFORMATION'
      ? 'INSUFFICIENT INFORMATION'
      : isNoPurchase
      ? 'NO PURCHASE NEEDED'
      : 'PURCHASE JUSTIFIED';

  const headline =
    assessmentObj?.headline ||
    (rawVerdict === 'PURCHASE_OPTIONAL' || rawVerdict === 'OPTIONAL_GAP'
      ? 'Optional Enhancement Only'
      : rawVerdict === 'PURCHASE_STRONGLY_RECOMMENDED'
      ? 'Essential Structural Gap'
      : rawVerdict === 'PURCHASE_RECOMMENDED'
      ? 'Recommended Wardrobe Addition'
      : rawVerdict === 'WARDROBE_GAP'
      ? 'Verified Wardrobe Gap'
      : rawVerdict === 'NO_VALID_OUTFIT'
      ? 'No Purchase Needed (Laundry Bottleneck)'
      : rawVerdict === 'INSUFFICIENT_INFORMATION'
      ? 'More Wardrobe Information Needed'
      : isNoPurchase
      ? 'No Purchase Needed'
      : 'Verified Wardrobe Gap');

  const summary =
    assessmentObj?.summary ||
    report?.negativeEvidence?.primaryReason ||
    'Your existing wardrobe covers current needs sufficiently.';

  const evaluatedPieces: any[] = assessmentObj?.evaluatedPieces || [];

  const rediscoveryCount =
    assessmentObj?.dormantRediscoveries?.length ??
    report?.negativeEvidence?.rediscoveryOpportunitiesCount ??
    0;

  const gaps = assessmentObj?.occasionGaps || report?.gaps || [];

  return (
    <div
      className="mt-3 rounded-xl border border-(--border) bg-card p-4 space-y-3 shadow-2xs"
      data-testid="saathi-smart-buy-card"
    >
      <div className="flex items-center justify-between border-b border-(--border)/40 pb-2">
        <div className="flex items-center gap-1.5">
          {isNoPurchase ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            SMART BUY ASSESSMENT
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted bg-(--ivory) px-1.5 py-0.5 rounded border border-(--border)">
            Zero commercial links
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isNoPurchase
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {badgeText}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-(--ink)">{headline}</h4>
        <p className="text-xs text-(--ink) leading-relaxed text-muted">
          {summary}
        </p>
      </div>

      {/* Laundry Advisory Notice */}
      {assessmentObj?.laundryNotice && (
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-300">
          <span className="font-semibold block">Laundry Notice:</span>
          <p className="text-[11px] leading-relaxed mt-0.5">{assessmentObj.laundryNotice}</p>
        </div>
      )}

      {/* Evaluated Owned Pieces */}
      {evaluatedPieces.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-(--border)/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Evaluated Ready Pieces in Closet
          </span>
          <div className="flex flex-wrap gap-1.5">
            {evaluatedPieces.map((p: any, idx: number) => {
              const name = typeof p === 'string' ? p : p?.name || 'Garment';
              const role = typeof p === 'object' && p?.role ? ` (${p.role})` : '';
              return (
                <span
                  key={idx}
                  className="text-[11px] px-2 py-1 rounded-md bg-(--ivory) border border-(--border) text-(--ink)"
                >
                  {name}{role}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Rediscovery callout if owned pieces can solve shortages */}
      {rediscoveryCount > 0 && (
        <div className="p-2.5 rounded-lg bg-(--burnished-gold)/10 border border-(--burnished-gold)/20 flex items-start gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-(--burnished-gold) mt-0.5 shrink-0" />
          <p className="text-[11px] text-(--ink)">
            You have {rediscoveryCount} dormant piece(s) in your wardrobe that can satisfy current shortages before purchasing new items.
          </p>
        </div>
      )}

      {/* Verified Gaps List (if any) */}
      {gaps.length > 0 && !isNoPurchase && (
        <div className="space-y-1.5 pt-1 border-t border-(--border)/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Identified Capability Shortage
          </span>
          {gaps.map((g: any, idx: number) => (
            <div key={g.id || idx} className="p-2 rounded-lg bg-(--ivory)/40 text-xs space-y-0.5">
              <span className="font-semibold block text-(--ink)">{g.headline || g.category || 'Gap'}</span>
              <span className="text-[11px] text-muted block">{g.explanation || g.reason || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
