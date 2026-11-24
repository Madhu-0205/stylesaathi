import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Bookmark,
  ArrowRight,
  Layers,
  AlertCircle,
  Shirt,
  Info,
  ChevronRight,
} from 'lucide-react';
import {
  WardrobeItem,
  Occasion,
  Season,
  GeneratedOutfit,
  RecommendedOutfit,
  MissingOutfitRequirement,
} from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { useWeather } from '../../context/WeatherContext';
import {
  recommendOutfitsWithTelemetry,
  deriveSeasonalContext,
} from '../../engine';
import {
  buildEditorialReasoning,
  extractEditorialComponents,
} from '../../engine/saathi/editorialReasoning';
import { formatRecommendationScore } from '../../utils/scoreFormatter';

export interface StyleThreeWaysModalProps {
  anchorItem: WardrobeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkWorn: (outfit: GeneratedOutfit) => void;
  onSaveLook: (outfit: GeneratedOutfit) => void;
  onOpenInAtelier: (anchorItem?: WardrobeItem, occasion?: string) => void;
}

interface StyleDirectionConfig {
  id: 'minimal' | 'relaxed' | 'statement';
  title: string;
  tagline: string;
  occasion: Occasion;
  concept: string;
  whatChanges: string;
  accentClass: string;
}

const STYLE_DIRECTIONS: StyleDirectionConfig[] = [
  {
    id: 'minimal',
    title: 'Minimal & Refined',
    tagline: 'Crisp Lines & Tonal Restraint',
    occasion: 'office',
    concept: 'Architectural minimalism with clean contours and understated polish',
    whatChanges:
      'Pairs the anchor piece with tailored, structured companions in muted or monochrome tones. Silhouette is crisp and uncluttered, shifting focus to cut and drape.',
    accentClass: 'text-stone-800 bg-stone-100 border-stone-200 dark:text-stone-200 dark:bg-stone-800',
  },
  {
    id: 'relaxed',
    title: 'Relaxed Everyday',
    tagline: 'Fluid Drapes & Effortless Comfort',
    occasion: 'everyday',
    concept: 'Easy movement, tactile breathability, and laid-back day-long ease',
    whatChanges:
      'Swaps structured tailoring for fluid cottons, breathable weaves, and casual slip-ons or sneakers. Silhouette softens for natural, unstudied ease.',
    accentClass: 'text-(--burnished-gold) bg-(--burnished-gold)/10 border-(--burnished-gold)/20',
  },
  {
    id: 'statement',
    title: 'Contemporary Statement',
    tagline: 'Textured Contrast & Expressive Energy',
    occasion: 'party',
    concept: 'Bold chromatic counterpoints, festive accents, or elevated evening layers',
    whatChanges:
      'Elevates the anchor piece with striking contrasts, artisanal accessories, or statement layers. Ideal for evening gatherings or cultural celebrations.',
    accentClass: 'text-(--kumkum) bg-(--kumkum)/10 border-(--kumkum)/20',
  },
];

export const StyleThreeWaysModal: React.FC<StyleThreeWaysModalProps> = ({
  anchorItem,
  isOpen,
  onClose,
  onMarkWorn,
  onSaveLook,
  onOpenInAtelier,
}) => {
  const { items, preferences, styleProfile, showToast } = useWardrobeContext();

  let weatherContext: ReturnType<typeof useWeather> | null = null;
  try {
    weatherContext = useWeather();
  } catch {
    // Weather provider fallback
  }

  const [activeDirectionId, setActiveDirectionId] = useState<string>('minimal');

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const season = useMemo<Season>(() => {
    return deriveSeasonalContext(today, weatherContext?.weather);
  }, [today, weatherContext?.weather]);

  // Generate 3 styled looks pinned to the anchor garment
  const generatedDirections = useMemo(() => {
    if (!anchorItem || !isOpen) return [];

    return STYLE_DIRECTIONS.map((dir) => {
      try {
        const contextSnapshot = weatherContext?.getContextForOccasion(dir.occasion);
        const res = recommendOutfitsWithTelemetry({
          items,
          occasion: dir.occasion,
          season,
          localDate: todayStr,
          anchorItemId: anchorItem.id,
          preferences,
          styleProfile,
          context: contextSnapshot,
          limit: 1,
        });

        const outfit = res.set.outfits[0] || null;
        const missing = res.set.missingRequirements || [];
        const components = outfit ? extractEditorialComponents(outfit.slots) : null;
        const editorial = outfit && components
          ? buildEditorialReasoning({
              concept: `${dir.title} styling around ${anchorItem.name}`,
              occasion: dir.occasion,
              components,
            })
          : null;

        return {
          config: dir,
          outfit,
          missing,
          components,
          editorial,
        };
      } catch {
        return {
          config: dir,
          outfit: null,
          missing: [],
          components: null,
          editorial: null,
        };
      }
    });
  }, [anchorItem, isOpen, items, season, todayStr, weatherContext, preferences, styleProfile]);

  if (!isOpen || !anchorItem) return null;

  const currentResult =
    generatedDirections.find((d) => d.config.id === activeDirectionId) ||
    generatedDirections[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Style ${anchorItem.name} Three Ways`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-4xl rounded-3xl glass-card specular-border border border-border/90 bg-(--paper) shadow-2xl p-5 sm:p-7 z-10 my-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-16 w-14 shrink-0 rounded-xl overflow-hidden border border-border/80 bg-card shadow-xs relative">
              <ItemImage item={anchorItem} className="h-full w-full object-cover" />
              <div className="absolute top-1 left-1 rounded-sm bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
                Anchor
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="editorial-kicker text-(--kumkum) tracking-[0.2em]">
                  EDITORIAL CAPSULE
                </span>
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-(--burnished-gold)/10 text-(--burnished-gold) border border-(--burnished-gold)/20">
                  3 Ways
                </span>
              </div>
              <h2 className="editorial-hero text-2xl sm:text-3xl text-(--ink) font-normal mt-0.5">
                Style {anchorItem.name}
              </h2>
              <p className="text-xs text-muted font-sans mt-0.5">
                {anchorItem.category} · {anchorItem.colors?.join(', ') || 'Neutral'} · Verified against your available wardrobe
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="min-h-11 min-w-11 p-0 rounded-full text-muted hover:text-(--ink) active:scale-95"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Direction Switcher Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {generatedDirections.map((dir) => {
            const isActive = dir.config.id === activeDirectionId;
            const hasOutfit = Boolean(dir.outfit);

            return (
              <button
                key={dir.config.id}
                type="button"
                onClick={() => setActiveDirectionId(dir.config.id)}
                className={`min-h-12 p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                  isActive
                    ? 'border-(--kumkum) bg-(--ivory) shadow-xs'
                    : 'border-border/80 bg-card/60 hover:bg-card hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${dir.config.accentClass}`}
                  >
                    {dir.config.title}
                  </span>
                  {hasOutfit ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      Missing piece
                    </span>
                  )}
                </div>
                <p className="text-xs font-serif text-(--ink) mt-1.5 font-normal truncate">
                  {dir.config.tagline}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Direction Content */}
        {currentResult && (
          <div className="rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5 space-y-4">
            {/* Direction Concept & What Changes */}
            <div className="space-y-1.5 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-(--burnished-gold)" />
                <h3 className="font-serif text-lg text-(--ink) font-normal">
                  {currentResult.config.title}: {currentResult.config.tagline}
                </h3>
              </div>
              <p className="text-xs text-(--ink) font-sans font-medium">
                {currentResult.config.concept}
              </p>
              <div className="rounded-xl bg-(--ivory)/80 border border-border/60 p-3 mt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted block mb-0.5">
                  What Changes in this Silhouette:
                </span>
                <p className="text-xs text-muted font-sans leading-relaxed">
                  {currentResult.config.whatChanges}
                </p>
              </div>
            </div>

            {/* Generated Look or Honest Missing State */}
            {currentResult.outfit ? (
              <div className="space-y-4">
                {/* Garments Visual Row */}
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted block mb-2">
                    Ensemble Components:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.values(currentResult.outfit.slots || {})
                      .flat()
                      .map((piece: WardrobeItem) => {
                        const isAnchor = piece.id === anchorItem.id;
                        return (
                          <div
                            key={piece.id}
                            className={`relative rounded-xl border p-2 bg-card flex flex-col justify-between space-y-2 shadow-2xs ${
                              isAnchor
                                ? 'border-(--kumkum) ring-1 ring-(--kumkum)/20'
                                : 'border-border/80'
                            }`}
                          >
                            <div className="aspect-square w-full rounded-lg overflow-hidden bg-(--ivory) relative">
                              <ItemImage item={piece} className="h-full w-full object-cover" />
                              {isAnchor && (
                                <span className="absolute top-1 left-1 rounded-sm bg-(--kumkum) text-white px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider">
                                  Anchor Piece
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-serif text-(--ink) truncate font-medium">
                                {piece.name}
                              </p>
                              <p className="text-[10px] text-muted truncate">
                                {piece.subcategory || piece.category} · {piece.colors?.[0] || 'Neutral'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Editorial Reason */}
                {currentResult.editorial && (
                  <div className="rounded-xl border border-border/60 bg-(--paper) p-3 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-(--burnished-gold) block">
                      Stylist's Narrative:
                    </span>
                    <p className="text-muted leading-relaxed">
                      {currentResult.editorial.sections.proportionSilhouette}
                    </p>
                  </div>
                )}

                {/* Primary Action Buttons (All >= 44px min-h-11 Touch Targets) */}
                <div className="pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      variant="default"
                      size="default"
                      onClick={() => {
                        if (currentResult.outfit) {
                          onMarkWorn(currentResult.outfit);
                          onClose();
                        }
                      }}
                      className="min-h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white flex-1 sm:flex-initial tactile-press shadow-xs"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      <span>Wear This Look</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        if (currentResult.outfit) {
                          onSaveLook(currentResult.outfit);
                        }
                      }}
                      className="min-h-11 px-4 rounded-full text-xs font-semibold text-muted hover:text-(--ink) active:scale-95"
                    >
                      <Bookmark className="h-4 w-4 mr-1.5" />
                      <span>Save Look</span>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="default"
                    onClick={() => {
                      onOpenInAtelier(anchorItem, currentResult.config.occasion);
                      onClose();
                    }}
                    className="min-h-11 px-4 rounded-full text-xs font-semibold text-(--burnished-gold) hover:text-(--ink) active:scale-95"
                  >
                    <span>Edit in Atelier</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-500/5 p-4 sm:p-5 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="font-serif text-base text-(--ink) font-normal">
                    Closet Gap for {currentResult.config.title}
                  </h4>
                  <p className="text-xs text-muted font-sans">
                    You have the anchor {anchorItem.name}, but your wardrobe is missing compatible clean companions to complete this specific {currentResult.config.occasion} look without fabricating ghost garments.
                  </p>
                  {currentResult.missing && currentResult.missing.length > 0 && (
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 pt-1">
                      Recommended to acquire: {currentResult.missing.map((m: any) => m.category || m.slot).join(', ')}
                    </p>
                  )}
                </div>
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenInAtelier(anchorItem, currentResult.config.occasion);
                      onClose();
                    }}
                    className="min-h-11 px-4 rounded-full text-xs font-semibold"
                  >
                    <span>Open in Atelier to Style Manually</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

