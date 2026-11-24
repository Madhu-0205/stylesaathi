import React, { useState, useMemo } from 'react';
import { Compass, AlertCircle, X, Shirt, Sparkles } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { CuratedActiveTrend, TrendDiscoveryOpportunity } from '../engine/trends/types';
import { getBundledCuratedTrends } from '../engine/trends/trendCatalog';
import { evaluateWardrobeDiscoveryOpportunities, exploreTrendWithWardrobe } from '../engine/trends/discoveryEngine';
import { computeWearAnalytics } from '../engine/analytics';
import { TrendDiscoveryCard } from '../components/trends/TrendDiscoveryCard';
import { TrendTelemetryModal } from '../components/trends/TrendTelemetryModal';
import { RecommendedOutfit, MissingOutfitRequirement, WardrobeItem } from '../types';
import { getCompatibilityDescriptor } from '../utils/scoreFormatter';

type FilterTab = 'ALL' | 'STRONG_DISCOVERY' | 'WARDROBE_RELEVANT' | 'STYLE_RELEVANT' | 'INDIAN_HERITAGE';

interface TrendDiscoveryScreenProps {
  onGoToDress?: (anchorItem?: WardrobeItem, occasion?: string) => void;
}

export const TrendDiscoveryScreen: React.FC<TrendDiscoveryScreenProps> = ({ onGoToDress }) => {
  const { items, styleProfile } = useWardrobeContext();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [telemetryOpportunity, setTelemetryOpportunity] = useState<TrendDiscoveryOpportunity | null>(null);

  // Wardrobe exploration modal state
  const [explorationResult, setExplorationResult] = useState<{
    trend: CuratedActiveTrend;
    outfits: RecommendedOutfit[];
    missingRequirements: MissingOutfitRequirement[];
  } | null>(null);

  // Deterministic reference timestamp for active session
  const referenceTimestampMs = useMemo(() => Date.now(), []);
  const referenceDateStr = useMemo(
    () => new Date(referenceTimestampMs).toISOString().split('T')[0],
    [referenceTimestampMs]
  );

  // Compute dormant items via Phase 8 Wear Analytics
  const dormantItems = useMemo(() => {
    try {
      const analytics = computeWearAnalytics(items, [], referenceTimestampMs);
      return analytics.dormantItems.map((d) => d.item);
    } catch {
      return [];
    }
  }, [items, referenceTimestampMs]);

  // Evaluate active curated trends against personal wardrobe
  const opportunities = useMemo(() => {
    const activeTrends = getBundledCuratedTrends();
    return evaluateWardrobeDiscoveryOpportunities(
      activeTrends,
      items,
      styleProfile,
      undefined, // Weather unverified unless actively available
      undefined, // Cultural signals default to styleProfile
      dormantItems,
      referenceDateStr
    );
  }, [items, styleProfile, dormantItems, referenceDateStr]);

  // Filter opportunities based on selected tab
  const filteredOpportunities = useMemo(() => {
    if (activeFilter === 'ALL') {
      return opportunities.filter((o) => o.evidence.classification !== 'NOT_RELEVANT');
    }
    if (activeFilter === 'INDIAN_HERITAGE') {
      return opportunities.filter(
        (o) =>
          o.trend.concept.indianFashionContext?.isIndianFusion ||
          o.trend.provenance.sourceType === 'INDIAN_HERITAGE_CURATION'
      );
    }
    return opportunities.filter((o) => o.evidence.classification === activeFilter);
  }, [opportunities, activeFilter]);

  // Handle "Try With Your Wardrobe" - Phase 11 hands off to Phase 5
  const handleExplore = (opportunity: TrendDiscoveryOpportunity) => {
    const result = exploreTrendWithWardrobe(
      opportunity.trend,
      items,
      styleProfile,
      undefined,
      undefined,
      referenceDateStr
    );

    setExplorationResult({
      trend: opportunity.trend,
      outfits: result.outfits,
      missingRequirements: result.missingRequirements,
    });
  };

  return (
    <div className="pb-28 sm:pb-24 md:pb-8 animate-fade-in space-y-5" aria-label="Trend Intelligence Discovery Hub">
      {/* Header */}
      <header className="border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="editorial-kicker text-(--burnished-gold)">
            TREND INTELLIGENCE
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/15 text-muted">
            <Compass className="w-3 h-3" />
            Wardrobe-First Discovery
          </span>
        </div>
        <h1 className="mt-1 editorial-title text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
          Curated Trends &amp; Wardrobe Match
        </h1>
        <p className="text-xs text-muted font-normal mt-0.5">
          Evaluating verified fashion trends against what you already own. Zero shopping, zero affiliate links.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 glass-pill specular-border rounded-full w-fit max-w-full overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`min-h-11 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all tactile-press-sm ${
            activeFilter === 'ALL'
              ? 'bg-(--ink) text-(--paper) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'ALL'}
        >
          All Active Trends
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('STRONG_DISCOVERY')}
          className={`min-h-11 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all tactile-press-sm ${
            activeFilter === 'STRONG_DISCOVERY'
              ? 'bg-(--ink) text-(--paper) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'STRONG_DISCOVERY'}
        >
          Strong Discovery
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('WARDROBE_RELEVANT')}
          className={`min-h-11 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all tactile-press-sm ${
            activeFilter === 'WARDROBE_RELEVANT'
              ? 'bg-(--ink) text-(--paper) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'WARDROBE_RELEVANT'}
        >
          Wardrobe Relevant
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('STYLE_RELEVANT')}
          className={`min-h-11 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all tactile-press-sm ${
            activeFilter === 'STYLE_RELEVANT'
              ? 'bg-(--ink) text-(--paper) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'STYLE_RELEVANT'}
        >
          Style Relevant
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('INDIAN_HERITAGE')}
          className={`min-h-11 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all tactile-press-sm ${
            activeFilter === 'INDIAN_HERITAGE'
              ? 'bg-(--ink) text-(--paper) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'INDIAN_HERITAGE'}
        >
          Indian &amp; Heritage
        </button>
      </div>

      {/* Opportunities Grid */}
      {filteredOpportunities.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card/60 space-y-2">
          <p className="text-sm font-medium text-(--ink)">No trends match this filter.</p>
          <p className="text-xs text-muted">
            Try switching to &ldquo;All Active Trends&rdquo; to inspect other verified trends.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOpportunities.map((opportunity) => (
            <TrendDiscoveryCard
              key={opportunity.trend.concept.id}
              opportunity={opportunity}
              onExplore={handleExplore}
              onInspectTelemetry={(opp) => setTelemetryOpportunity(opp)}
              wardrobeItems={items}
            />
          ))}
        </div>
      )}

      {/* Telemetry Modal */}
      {telemetryOpportunity && (
        <TrendTelemetryModal
          opportunity={telemetryOpportunity}
          onClose={() => setTelemetryOpportunity(null)}
        />
      )}

      {/* Try With Your Wardrobe Exploration Modal (Phase 5 Handoff) */}
      {explorationResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exploration-modal-title"
        >
          <div className="relative w-full max-w-xl rounded-3xl glass-card specular-border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between border-b border-border/80 pb-3">
              <div>
                <span className="editorial-kicker text-accent">
                  PHASE 5 OUTFIT EXPLORATION
                </span>
                <h2
                  id="exploration-modal-title"
                  className="editorial-title text-xl font-normal text-(--ink) mt-0.5"
                >
                  Styling &ldquo;{explorationResult.trend.concept.name}&rdquo;
                </h2>
                <p className="text-xs text-muted">
                  Outfits ranked authoritatively by Phase 5 Recommendation Engine.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExplorationResult(null)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-(--ivory) hover:text-(--ink) transition-colors active:scale-95 tactile-press-sm"
                aria-label="Close exploration modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {explorationResult.outfits.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-muted">
                  Found {explorationResult.outfits.length} compatible look
                  {explorationResult.outfits.length > 1 ? 's' : ''} in your wardrobe matching this trend:
                </p>

                <div className="space-y-3">
                  {explorationResult.outfits.map((rec, idx) => (
                    <div
                      key={rec.id || `look-${idx}`}
                      className="p-4 rounded-xl border border-border bg-(--ivory)/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-(--ink)">
                          Look #{idx + 1}
                        </span>
                        {(() => {
                          const desc = getCompatibilityDescriptor(rec.score);
                          return (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${desc.badgeClass}`}
                              title={desc.heuristicNote}
                            >
                              {desc.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.values(rec.slots || {}).flat().map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-(--ink)"
                          >
                            <Shirt className="w-3 h-3 text-accent" />
                            {item.name}
                          </span>
                        ))}
                      </div>

                      <p className="text-[11px] text-muted italic pt-1">
                        {rec.explanation && typeof rec.explanation === 'object'
                          ? rec.explanation.headline || rec.explanation.reasons?.join(' · ') || 'Coordinated ensemble'
                          : String(rec.explanation || 'Coordinated ensemble')}
                      </p>

                      {onGoToDress && (
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const outfitPieces = Object.values(rec.slots || {}).flat();
                              const anchorPiece = outfitPieces.find((p) => p.category === 'Tops' || p.category === 'Ethnic') || outfitPieces[0];
                              setExplorationResult(null);
                              onGoToDress(anchorPiece, 'everyday');
                            }}
                            className="min-h-11 px-3.5 rounded-full bg-(--ink) text-(--paper) hover:opacity-90 active:scale-95 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs couture-press cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
                            <span>Style in Atelier</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Insufficient clean wardrobe pieces for a complete look
                </div>
                <p>
                  Phase 5 requires compatible top and bottom pieces to form a complete outfit.
                </p>
                {explorationResult.missingRequirements.length > 0 && (
                  <div className="pt-1">
                    <span className="font-semibold block">Missing roles:</span>
                    <ul className="list-disc list-inside">
                      {explorationResult.missingRequirements.map((m, i) => (
                        <li key={`${m.missingRole || m.explanation || 'req'}-${i}`}>{m.missingRole || m.explanation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
