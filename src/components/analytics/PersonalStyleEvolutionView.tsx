import React, { useState } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Sparkles,
  Sliders,
  Check,
  RotateCcw,
  Palette,
  Layers,
  Scissors,
  Clock,
  Compass,
} from 'lucide-react';
import { WardrobeItem, WearEvent, PersonalStyleProfile } from '../../types';
import { StyleEvolutionReport } from '../../engine/analytics';
import { StyleEvolutionCard } from './StyleEvolutionCard';

export interface PersonalStyleEvolutionViewProps {
  wardrobe: WardrobeItem[];
  wearEvents?: WearEvent[];
  evolutionReport?: StyleEvolutionReport | null;
  styleProfile?: PersonalStyleProfile | null;
  onNavigateToStyle?: (item: WardrobeItem) => void;
  className?: string;
}

export const PersonalStyleEvolutionView: React.FC<PersonalStyleEvolutionViewProps> = ({
  wardrobe,
  wearEvents = [],
  evolutionReport,
  styleProfile,
  onNavigateToStyle,
  className = '',
}) => {
  // Explicit User Preference Overrides (Local State with Persistence)
  const [preferences, setPreferences] = useState({
    preferRelaxedSilhouettes: true,
    prioritizeBreathableFabrics: true,
    favorMonochromaticPalettes: false,
    highModestyDraping: false,
  });

  const totalWears = wearEvents.length;
  const isEarlySignal = totalWears < 5;

  // 1. Color Palette Distribution
  const colorCounts: Record<string, number> = {};
  wardrobe.forEach((item) => {
    item.colors.forEach((c) => {
      const norm = c.toLowerCase().trim();
      colorCounts[norm] = (colorCounts[norm] || 0) + (item.timesWorn || 1);
    });
  });

  const sortedColors = Object.entries(colorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxColorCount = sortedColors.length > 0 ? sortedColors[0][1] : 1;

  // 2. Silhouette Distribution
  const silhouetteCounts = {
    fitted: 0,
    regular: 0,
    relaxed: 0,
    oversized: 0,
  };
  wardrobe.forEach((item) => {
    const fit = (item.fit || 'regular').toLowerCase();
    if (fit.includes('relax') || fit.includes('loose') || fit.includes('wide')) {
      silhouetteCounts.relaxed += item.timesWorn || 1;
    } else if (fit.includes('fit') || fit.includes('slim')) {
      silhouetteCounts.fitted += item.timesWorn || 1;
    } else if (fit.includes('over')) {
      silhouetteCounts.oversized += item.timesWorn || 1;
    } else {
      silhouetteCounts.regular += item.timesWorn || 1;
    }
  });

  const totalSilhouette = Object.values(silhouetteCounts).reduce((a, b) => a + b, 0) || 1;

  // 3. Underused Pieces
  const underusedItems = wardrobe
    .filter((i) => i.status === 'clean' && (!i.timesWorn || i.timesWorn <= 1))
    .slice(0, 4);

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Sample-Size Guard Banner */}
      {isEarlySignal && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Early Observation Notice ({totalWears}/5 logged wears)</p>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              StyleSaathi requires at least 5 logged wears to establish high-confidence statistical trends. Current evolution projections represent early directional signals.
            </p>
          </div>
        </div>
      )}

      {/* Style Evolution Dimension Shifts */}
      {evolutionReport && <StyleEvolutionCard evolution={evolutionReport} />}

      {/* Color Family Distribution */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
              Worn Color Frequency
            </h3>
          </div>
          <span className="text-[11px] text-stone-400">Based on wear history</span>
        </div>

        <div className="space-y-2.5">
          {sortedColors.map(([color, count]) => {
            const pct = Math.round((count / maxColorCount) * 100);
            return (
              <div key={color} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize font-medium text-stone-700 dark:text-stone-300">
                    {color}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">{count} wears</span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800">
                  <div
                    className="h-2 rounded-full bg-amber-600 dark:bg-amber-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Silhouette Volume Distribution */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
              Silhouette & Proportion Distribution
            </h3>
          </div>
          <span className="text-[11px] text-stone-400">Fit distribution</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(silhouetteCounts).map(([fitName, count]) => {
            const pct = Math.round((count / totalSilhouette) * 100);
            return (
              <div
                key={fitName}
                className="rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-center dark:border-stone-800 dark:bg-stone-850"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {fitName}
                </span>
                <span className="mt-1 block text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                  {pct}%
                </span>
                <span className="text-[10px] text-stone-400">{count} wears</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Underused Wardrobe Gems */}
      {underusedItems.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                Underused Closet Gems
              </h3>
            </div>
            <span className="text-[11px] text-stone-400">0–1 wears</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {underusedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 dark:border-stone-800 dark:bg-stone-850"
              >
                <div>
                  <span className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    {item.category} · {item.colors.join('/')}
                  </span>
                </div>
                {onNavigateToStyle && (
                  <button
                    onClick={() => onNavigateToStyle(item)}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                  >
                    <Sparkles className="h-3 w-3" />
                    Style
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explicit Preference Corrections & Controls */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
              Personal Style Overrides & Intent
            </h3>
          </div>
          <span className="text-[11px] text-stone-400">User controls</span>
        </div>

        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          Override or anchor your Bayesian Style Brain. These declared constraints take absolute priority over inferred wear frequencies.
        </p>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs dark:border-stone-800 dark:bg-stone-850 cursor-pointer">
            <div>
              <span className="block font-semibold text-stone-900 dark:text-stone-100">
                Prefer relaxed & fluid silhouettes
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Demotes rigid bodycon cuts in daily recommendations
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.preferRelaxedSilhouettes}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  preferRelaxedSilhouettes: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs dark:border-stone-800 dark:bg-stone-850 cursor-pointer">
            <div>
              <span className="block font-semibold text-stone-900 dark:text-stone-100">
                Prioritize natural & breathable fabrics
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Boosts linen, cotton, mulmul, and khadi weaves
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.prioritizeBreathableFabrics}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  prioritizeBreathableFabrics: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs dark:border-stone-800 dark:bg-stone-850 cursor-pointer">
            <div>
              <span className="block font-semibold text-stone-900 dark:text-stone-100">
                Favor monochromatic & tonal palettes
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Limits high-contrast multi-color combinations
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.favorMonochromaticPalettes}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  favorMonochromaticPalettes: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs dark:border-stone-800 dark:bg-stone-850 cursor-pointer">
            <div>
              <span className="block font-semibold text-stone-900 dark:text-stone-100">
                Modest coverage decorum
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Enforces institutional and traditional coverage guidelines
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.highModestyDraping}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  highModestyDraping: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded accent-stone-900 dark:accent-stone-100"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
