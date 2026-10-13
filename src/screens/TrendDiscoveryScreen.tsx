import React, { useState, useMemo } from 'react';
import { Sparkles, Compass, AlertCircle, Layers, X, Shirt } from 'lucide-react';
import { useWardrobeContext } from '../context/WardrobeContext';
import { CuratedActiveTrend, TrendDiscoveryOpportunity, DiscoveryClassification } from '../engine/trends/types';
import { getBundledCuratedTrends } from '../engine/trends/trendCatalog';
import { evaluateWardrobeDiscoveryOpportunities, exploreTrendWithWardrobe } from '../engine/trends/discoveryEngine';
import { computeWearAnalytics } from '../engine/analytics';
import { TrendDiscoveryCard } from '../components/trends/TrendDiscoveryCard';
import { TrendTelemetryModal } from '../components/trends/TrendTelemetryModal';
import { RecommendedOutfit, MissingOutfitRequirement } from '../types';

type FilterTab = 'ALL' | 'STRONG_DISCOVERY' | 'WARDROBE_RELEVANT' | 'STYLE_RELEVANT';

export const TrendDiscoveryScreen: React.FC = () => {
  const { items, styleProfile, preferences } = useWardrobeContext();
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
    <div className="pb-12 animate-fade-in space-y-5" aria-label="Trend Intelligence Discovery Hub">
      {/* Header */}
      <header className="border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold)">
            TREND INTELLIGENCE
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/15 text-muted">
            <Compass className="w-3 h-3" />
            Wardrobe-First Discovery
          </span>
        </div>
        <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight">
          Curated Trends &amp; Wardrobe Match
        </h1>
        <p className="text-xs text-muted font-normal mt-0.5">
          Evaluating verified fashion trends against what you already own. Zero shopping, zero affiliate links.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-(--border-light)/70 rounded-full border border-(--border)/60 w-fit max-w-full overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeFilter === 'ALL'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'ALL'}
        >
          All Active Trends
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('STRONG_DISCOVERY')}
          className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeFilter === 'STRONG_DISCOVERY'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'STRONG_DISCOVERY'}
        >
          Strong Discovery
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('WARDROBE_RELEVANT')}
          className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeFilter === 'WARDROBE_RELEVANT'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'WARDROBE_RELEVANT'}
        >
          Wardrobe Relevant
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('STYLE_RELEVANT')}
          className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
            activeFilter === 'STYLE_RELEVANT'
              ? 'bg-card text-(--ink) shadow-2xs'
              : 'text-muted hover:text-(--ink)'
          }`}
          aria-pressed={activeFilter === 'STYLE_RELEVANT'}
        >
          Style Relevant
        </button>
      </div>

      {/* Opportunities Grid */}
      {filteredOpportunities.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card/60 space-y-2">
          <p className="text-sm font-medium text-(--ink)">No trends match this filter.</p>
          <p className="text-xs text-muted">
            Try switching to "All Active Trends" to inspect other verified trends.
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
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  PHASE 5 OUTFIT EXPLORATION
                </span>
                <h2
                  id="exploration-modal-title"
                  className="font-serif text-xl font-normal text-(--ink) mt-0.5"
                >
                  Styling "{explorationResult.trend.concept.name}"
                </h2>
                <p className="text-xs text-muted">
                  Outfits ranked authoritatively by Phase 5 Recommendation Engine.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExplorationResult(null)}
                className="rounded-full p-1.5 text-muted hover:bg-muted/20 hover:text-(--ink) transition-colors"
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
                      key={rec.id || (rec as any).outfit?.id || idx}
                      className="p-4 rounded-xl border border-border bg-(--ivory)/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-(--ink)">
                          Look #{idx + 1}
                        </span>
                        <span className="text-[11px] text-muted font-medium">
                          Score: {typeof rec.score === 'number' ? (rec.score * 100).toFixed(0) : '85'}%
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.values(rec.slots || {}).flat().map((item: any) => (
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
                        {typeof rec.explanation === 'string'
                          ? rec.explanation
                          : rec.explanation?.headline || rec.explanation?.reasons?.join(' · ') || 'Coordinated ensemble'}
                      </p>
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
                        <li key={i}>{m.missingRole || m.explanation}</li>
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
