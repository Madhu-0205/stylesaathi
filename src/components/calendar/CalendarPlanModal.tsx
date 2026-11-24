import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  X,
  Check,
  Sparkles,
  Bookmark,
  AlertTriangle,
  Shirt,
  Pin,
} from 'lucide-react';
import {
  GeneratedOutfit,
  WardrobeItem,
  Occasion,
  Season,
  SavedOutfit,
  OutfitPlan,
} from '../../types';
import { OCCASIONS } from '../../data/taxonomy';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { useWeather } from '../../context/WeatherContext';
import { recommendOutfitsWithTelemetry, deriveSeasonalContext } from '../../engine';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CalendarPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDateStr: string;
  initialOccasion?: Occasion;
  existingPlan?: OutfitPlan | null;
  onConfirmPlan: (planData: {
    date: string;
    outfit: GeneratedOutfit;
    accessory?: WardrobeItem | null;
    occasion: Occasion;
  }) => Promise<void>;
}

export const CalendarPlanModal: React.FC<CalendarPlanModalProps> = ({
  isOpen,
  onClose,
  targetDateStr,
  initialOccasion = 'office',
  existingPlan,
  onConfirmPlan,
}) => {
  const { items, savedOutfits, preferences, styleProfile } = useWardrobeContext();

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {}

  const [selectedOccasion, setSelectedOccasion] = useState<Occasion>(
    existingPlan?.occasion || initialOccasion
  );
  const [activeTab, setActiveTab] = useState<'recommend' | 'saved'>('recommend');
  const [selectedOutfit, setSelectedOutfit] = useState<GeneratedOutfit | null>(
    existingPlan?.outfit || null
  );
  const [selectedAccessory, setSelectedAccessory] = useState<WardrobeItem | null>(
    existingPlan?.accessory || null
  );
  const [anchorItem, setAnchorItem] = useState<WardrobeItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive season for target date
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDateObj = useMemo(() => new Date(y, m - 1, d), [y, m, d]);
  const season: Season = useMemo(() => {
    return deriveSeasonalContext(targetDateObj, weatherContext?.weather);
  }, [targetDateObj, weatherContext?.weather]);

  // Context snapshot for the selected occasion
  const contextSnapshot = useMemo(() => {
    return weatherContext?.getContextForOccasion(selectedOccasion);
  }, [weatherContext, selectedOccasion]);

  // Recent worn pieces lookback (anti-repetition penalty)
  const recentWornItemIds = useMemo(() => {
    const twoDaysAgo = Date.now() - 48 * 3600 * 1000;
    return items
      .filter((i) => (i.lastWorn && i.lastWorn > twoDaysAgo) || (i.timesWorn && i.timesWorn > 0))
      .map((i) => i.id);
  }, [items]);

  // Generate recommendations for the date and occasion
  const generatedRecommendations = useMemo(() => {
    if (!isOpen || activeTab !== 'recommend') return [];
    try {
      const res = recommendOutfitsWithTelemetry({
        items,
        occasion: selectedOccasion,
        season,
        localDate: targetDateStr,
        preferences,
        styleProfile,
        context: contextSnapshot,
        limit: 4,
        anchorItemId: anchorItem?.id,
        allowPlanningMode: true, // Planning ahead permits unwashed anchors with care notice
        recentWornItemIds,
      });
      return res.set.outfits || [];
    } catch {
      return [];
    }
  }, [
    isOpen,
    activeTab,
    items,
    selectedOccasion,
    season,
    targetDateStr,
    preferences,
    styleProfile,
    contextSnapshot,
    anchorItem,
    recentWornItemIds,
  ]);

  if (!isOpen) return null;

  // Formatted date label
  const formattedDateLabel = targetDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Check laundry status for currently selected outfit
  const selectedPieces = selectedOutfit ? Object.values(selectedOutfit.slots).flat() : [];
  if (selectedAccessory) selectedPieces.push(selectedAccessory);
  const unwashedPieces = selectedPieces.filter((p) => p.status !== 'clean');

  const handleConfirm = async () => {
    if (!selectedOutfit) return;
    try {
      setIsSubmitting(true);
      await onConfirmPlan({
        date: targetDateStr,
        outfit: selectedOutfit,
        accessory: selectedAccessory,
        occasion: selectedOccasion,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabels: Record<string, { label: string; className: string }> = {
    best_match: { label: 'Best Match', className: 'text-(--burnished-gold) border-(--burnished-gold)/40 bg-(--paper)' },
    alternative: { label: 'Alternative', className: 'text-(--ink)/80 border-border bg-card' },
    explore: { label: 'Explore', className: 'text-(--kumkum) border-(--kumkum)/30 bg-(--kumkum)/5' },
    underused: { label: 'Archive Rediscovery', className: 'text-emerald-700 border-emerald-400/40 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl text-left specular-border overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border/80 flex items-start justify-between bg-(--ivory)/40 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="h-4 w-4 text-(--burnished-gold)" />
              <span className="editorial-kicker text-(--kumkum)">
                STYLE CALENDAR · OUTFIT PLANNER
              </span>
            </div>
            <h2 className="editorial-headline text-xl sm:text-2xl text-(--ink)">
              {existingPlan ? 'Replace Planned Look' : 'Plan Outfit for Date'}
            </h2>
            <p className="mt-0.5 text-xs text-muted font-sans">
              Scheduling for <strong className="text-(--ink)">{formattedDateLabel}</strong> ({season} climate)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) hover:bg-(--ivory) active:scale-95 transition-transform"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Occasion Selector Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              TARGET OCCASION:
            </span>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setSelectedOccasion(occ as Occasion)}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-3.5 text-xs font-semibold capitalize tracking-wide transition-all tactile-press ${
                    selectedOccasion === occ
                      ? 'bg-(--ink) text-(--paper) shadow-2xs'
                      : 'border border-border/80 bg-card text-muted hover:border-(--ink)'
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>

          {/* Planning Source Segmented Switcher */}
          <div className="flex items-center rounded-full border border-border/80 bg-card p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('recommend')}
              className={`flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all tactile-press-sm ${
                activeTab === 'recommend'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Studio Recommendation</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all tactile-press-sm ${
                activeTab === 'saved'
                  ? 'bg-(--ink) text-(--paper) shadow-2xs'
                  : 'text-muted hover:text-(--ink)'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5 text-(--burnished-gold)" />
              <span>From Saved Looks ({savedOutfits.length})</span>
            </button>
          </div>

          {/* Tab 1: Studio Curated Outfits */}
          {activeTab === 'recommend' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="editorial-kicker text-muted">
                  CURATED CANDIDATES ({generatedRecommendations.length})
                </span>
                <span className="text-[11px] font-sans">
                  Tap to preview and select look
                </span>
              </div>

              {generatedRecommendations.length === 0 ? (
                <div className="py-8 text-center rounded-2xl border border-dashed border-border bg-(--ivory)/40 p-4">
                  <Shirt className="h-6 w-6 text-muted mx-auto mb-2" />
                  <p className="text-xs text-muted">
                    No compatible combinations found for {selectedOccasion} in your wardrobe.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedRecommendations.map((cand, idx) => {
                    const isSelected = selectedOutfit?.id === cand.id || selectedOutfit?.template === cand.template;
                    const pieces = Object.values(cand.slots).flat();
                    return (
                      <button
                        key={`${cand.template}-${idx}`}
                        type="button"
                        onClick={() => setSelectedOutfit(cand)}
                        className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'border-(--ink) bg-(--ivory) ring-2 ring-(--ink)/20 shadow-xs'
                            : 'border-border bg-card/70 hover:border-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-(--burnished-gold)">
                            Look 0{idx + 1}
                          </span>
                          {cand.role && roleLabels[cand.role] && (
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${roleLabels[cand.role].className}`}>
                              {roleLabels[cand.role].label}
                            </span>
                          )}
                        </div>

                        {/* Garment Thumbnails Row */}
                        <div className="flex gap-1.5 mb-2 overflow-hidden">
                          {pieces.slice(0, 4).map((piece, pIdx) => (
                            <div
                              key={`${piece.id}-${pIdx}`}
                              className="h-14 w-11 rounded-lg border border-border bg-card overflow-hidden shrink-0"
                            >
                              <ItemImage item={piece} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>

                        <h4 className="font-serif text-sm font-normal text-(--ink) truncate">
                          {cand.template.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-[10px] text-muted line-clamp-1 mt-0.5">
                          {cand.why || `${pieces.length} coordinated pieces`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Saved Looks Archive */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <span className="editorial-kicker text-muted block">
                SAVED OUTFIT ARCHIVE ({savedOutfits.length})
              </span>

              {savedOutfits.length === 0 ? (
                <div className="py-8 text-center rounded-2xl border border-dashed border-border bg-(--ivory)/40 p-4">
                  <Bookmark className="h-6 w-6 text-muted mx-auto mb-2" />
                  <p className="text-xs text-muted">
                    You haven&apos;t saved any favorite looks yet. Switch to Studio Recommendation to generate fresh outfits.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedOutfits.map((saved, idx) => {
                    const outfit = saved.outfit;
                    const isSelected = selectedOutfit?.id === outfit?.id;
                    const pieces = outfit ? (Object.values(outfit.slots).flat().filter(Boolean) as WardrobeItem[]) : [];
                    return (
                      <button
                        key={saved.id}
                        type="button"
                        onClick={() => setSelectedOutfit(outfit)}
                        className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'border-(--ink) bg-(--ivory) ring-2 ring-(--ink)/20 shadow-xs'
                            : 'border-border bg-card/70 hover:border-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-(--burnished-gold)">
                            Saved Look 0{idx + 1}
                          </span>
                          <span className="text-[9px] text-muted font-sans font-medium">
                            {pieces.length} pieces
                          </span>
                        </div>

                        {/* Thumbnails */}
                        <div className="flex gap-1.5 mb-2 overflow-hidden">
                          {pieces.slice(0, 4).map((piece, pIdx) => (
                            <div
                              key={`${piece.id}-${pIdx}`}
                              className="h-14 w-11 rounded-lg border border-border bg-card overflow-hidden shrink-0"
                            >
                              <ItemImage item={piece} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>

                        <h4 className="font-serif text-sm font-normal text-(--ink) truncate">
                          {saved.name || outfit?.template?.replace(/_/g, ' ') || 'Saved Look'}
                        </h4>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Care Warning Banner if any piece in selected outfit is unwashed */}
          {unwashedPieces.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Care Notice:</strong>
                <span>
                  {unwashedPieces.map((p) => p.name).join(', ')} currently {unwashedPieces[0].status.replace('_', ' ')}. Wash before wearing on {formattedDateLabel}.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-(--ivory)/30 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider px-4 tactile-press"
          >
            Cancel
          </Button>

          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedOutfit}
            className="flex-1 min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider gap-1.5 shadow-2xs tactile-press"
          >
            <Check className="h-4 w-4 text-(--burnished-gold)" />
            <span>
              {existingPlan ? 'Confirm Replacement' : 'Confirm Plan'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
