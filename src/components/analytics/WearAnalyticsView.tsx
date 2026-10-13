import React, { useState } from 'react';
import {
  TrendingUp,
  Shirt,
  Sparkles,
  PieChart,
  Coins,
  History,
  AlertCircle,
} from 'lucide-react';
import { useWearAnalytics, AnalyticsTimeframe } from '../../hooks/useWearAnalytics';
import { RotationHealthCard } from './RotationHealthCard';
import { StyleEvolutionCard } from './StyleEvolutionCard';
import { ItemImage } from '../common/ItemImage';
import { WardrobeItem } from '../../types';
import { StyleItemSheet } from '../wardrobe/StyleItemSheet';

interface WearAnalyticsViewProps {
  injectedReferenceTimestamp?: number;
}

export const WearAnalyticsView: React.FC<WearAnalyticsViewProps> = ({
  injectedReferenceTimestamp,
}) => {
  const {
    report,
    selectedTimeframe,
    setSelectedTimeframe,
    activeSnapshot,
    rotation,
    concentration,
    evolution,
    mostWornItems,
    dormantItems,
    orphans,
  } = useWearAnalytics(injectedReferenceTimestamp);

  const [stylingAnchorItem, setStylingAnchorItem] = useState<WardrobeItem | null>(null);

  const { totalLifetimeWears, uniqueWornItemsCount } = report;
  const isGlobalColdStart = totalLifetimeWears < 5;

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Timeframe Selector Bar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            ANALYTICS &amp; EVOLUTION
          </span>
          <h2 className="text-xl sm:text-2xl font-serif font-normal text-(--ink) tracking-tight">
            Your Wardrobe in Motion
          </h2>
        </div>

        {/* Timeframe Chips */}
        <div className="flex items-center p-1 rounded-xl bg-(--ivory) border border-border">
          {(['7d', '30d', '90d', 'all'] as AnalyticsTimeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedTimeframe === tf
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === '90d' ? '90D' : 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {/* Global Cold Start Banner */}
      {isGlobalColdStart && (
        <div className="rounded-2xl border border-dashed border-(--burnished-gold)/60 bg-(--ivory)/60 p-4 sm:p-5 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-(--ink)">
            <History className="h-4 w-4 text-(--burnished-gold)" />
            <span>{`StyleSaathi is Observing Habits (${totalLifetimeWears}/5 Wears)`}</span>
          </div>
          <p className="text-[11px] text-muted max-w-md mx-auto leading-relaxed">
            As you log outfits in Dress Me or Style Calendar, StyleSaathi privately analyzes your real rotation health, cost-per-wear amortization, and temporal style evolution.
          </p>
        </div>
      )}

      {/* Summary KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted block">
            TOTAL WEARS
          </span>
          <p className="text-xl sm:text-2xl font-bold text-(--ink)">
            {totalLifetimeWears}
          </p>
          <span className="text-[10px] text-muted block">Lifetime logged</span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted block">
            PIECES REACHED
          </span>
          <p className="text-xl sm:text-2xl font-bold text-(--ink)">
            {uniqueWornItemsCount}
          </p>
          <span className="text-[10px] text-muted block">Distinct garments</span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted block">
            ACTIVE ROTATION
          </span>
          <p className="text-xl sm:text-2xl font-bold text-(--ink)">
            {rotation.isEligible && rotation.rotationHealthPercentage !== undefined
              ? `${rotation.rotationHealthPercentage}%`
              : '—'}
          </p>
          <span className="text-[10px] text-muted block">
            {rotation.isEligible ? `${rotation.activeCount} active pieces` : 'Needs 10 wears'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted block">
            CONCENTRATION
          </span>
          <p className="text-xl sm:text-2xl font-bold text-(--ink)">
            {concentration.isEligible && concentration.concentrationRatio !== undefined
              ? `${concentration.concentrationRatio}%`
              : '—'}
          </p>
          <span className="text-[10px] text-muted block">
            {concentration.isEligible ? concentration.interpretation : 'Needs 15 wears'}
          </span>
        </div>
      </div>

      {/* Main Grid Columns */}
      <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* Left Column: Rotation Health & Most Worn */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Rotation Health Card */}
          <RotationHealthCard
            rotation={rotation}
            onStyleItem={(item) => setStylingAnchorItem(item)}
          />

          {/* 2. Most Worn Pieces & Cost-Per-Wear */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-(--burnished-gold)" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  MOST WORN ESSENTIALS
                </span>
              </div>
              <span className="text-xs text-muted">Cost-Per-Wear Amortization</span>
            </div>

            {mostWornItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-(--ivory)/60 p-4 text-center">
                <p className="text-xs text-muted">No wear events recorded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {mostWornItems.map(({ item, effectiveWears, costPerWear }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-(--ivory)/30 gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden border border-border/80">
                        <ItemImage item={item} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-(--ink) truncate">{item.name}</p>
                        <p className="text-[10.5px] text-muted">
                          {effectiveWears} {effectiveWears === 1 ? 'wear' : 'wears'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-card border border-border text-[10.5px] font-bold text-(--ink)">
                        {costPerWear.formattedCPW}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Usage Concentration (Pareto) */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-(--burnished-gold)" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  USAGE CONCENTRATION (PARETO)
                </span>
              </div>
              {concentration.isEligible && (
                <span className="text-xs font-semibold text-(--ink)">
                  {concentration.interpretation}
                </span>
              )}
            </div>

            {!concentration.isEligible ? (
              <p className="text-[11px] text-muted py-1">
                {concentration.ineligibilityReason ||
                  'Requires at least 15 recorded wears across 10 or more wardrobe items.'}
              </p>
            ) : (
              <div className="space-y-1.5 text-xs">
                <p className="text-xs text-(--ink) font-medium">
                  {concentration.explanation}
                </p>
                <p className="text-[11px] text-muted font-mono">
                  Top {concentration.kItemsCount} items generated {concentration.topKWears} of {concentration.totalLifetimeWears} total wears.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Style Evolution & Snapshot Breakdown */}
        <div className="lg:col-span-5 space-y-5">
          {/* 4. Style Evolution Card */}
          <StyleEvolutionCard evolution={evolution} />

          {/* 5. Active Window Distribution Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                WINDOW ATTRIBUTE DISTRIBUTION
              </span>
              <span className="text-xs text-muted uppercase font-semibold">
                {selectedTimeframe.toUpperCase()}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Neutral Color Ratio */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted">Neutral Palette Proportion:</span>
                  <span className="font-semibold text-(--ink)">
                    {Math.round(activeSnapshot.neutralColorRatio * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-(--border)/40 overflow-hidden">
                  <div
                    style={{ width: `${activeSnapshot.neutralColorRatio * 100}%` }}
                    className="h-full bg-(--ink) transition-all duration-300"
                  />
                </div>
              </div>

              {/* Breathable Fabric Ratio */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted">Breathable Lightweight Fabrics:</span>
                  <span className="font-semibold text-(--ink)">
                    {Math.round(activeSnapshot.breathableFabricRatio * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-(--border)/40 overflow-hidden">
                  <div
                    style={{ width: `${activeSnapshot.breathableFabricRatio * 100}%` }}
                    className="h-full bg-(--moss) transition-all duration-300"
                  />
                </div>
              </div>

              {/* Solid Pattern Ratio */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted">Solid Minimal Patterns:</span>
                  <span className="font-semibold text-(--ink)">
                    {Math.round(activeSnapshot.solidPatternRatio * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-(--border)/40 overflow-hidden">
                  <div
                    style={{ width: `${activeSnapshot.solidPatternRatio * 100}%` }}
                    className="h-full bg-(--burnished-gold) transition-all duration-300"
                  />
                </div>
              </div>

              {/* Formality Average */}
              <div className="pt-1.5 border-t border-(--border)/60 flex justify-between items-center text-[11.5px]">
                <span className="text-muted">Average Formality Level:</span>
                <span className="font-bold text-(--ink)">
                  {activeSnapshot.averageFormality} / 5.0
                </span>
              </div>
            </div>
          </div>

          {/* 6. Orphan Wears Notice (if any) */}
          {orphans.unresolvedOrphanCount > 0 && (
            <div className="rounded-xl border border-border bg-(--ivory)/60 p-3 text-[11px] text-muted leading-relaxed">
              {orphans.explanation}
            </div>
          )}
        </div>
      </div>

      {/* Phase 7 Style This Item Sheet for Dormant Garments */}
      {stylingAnchorItem && (
        <StyleItemSheet
          anchorItem={stylingAnchorItem}
          isOpen={Boolean(stylingAnchorItem)}
          onClose={() => setStylingAnchorItem(null)}
        />
      )}
    </div>
  );
};
