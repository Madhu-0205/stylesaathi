import React, { useState } from 'react';
import {
  CheckCircle2,
  Bookmark,
  ThumbsDown,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { RecommendedOutfit, GeneratedOutfit, WardrobeItem, Occasion } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import {
  buildEditorialReasoning,
  extractEditorialComponents,
  EditorialReasoningOutput,
} from '../../engine/saathi/editorialReasoning';
import { formatRecommendationScore } from '../../utils/scoreFormatter';

interface DailyEditorialHeroProps {
  outfit: RecommendedOutfit | GeneratedOutfit;
  occasion: Occasion;
  onMarkWorn: (outfit: GeneratedOutfit) => void;
  onSaveLook: (outfit: GeneratedOutfit) => void;
  onOpenInAtelier: (anchorItem?: WardrobeItem, occasion?: string) => void;
  onOpenFeedback: (outfit: GeneratedOutfit) => void;
  onStyleThreeWays?: (anchorItem: WardrobeItem) => void;
  onExploreAlternatives?: () => void;
  onAskSaathi?: (prompt?: string) => void;
  isPlannedToday?: boolean;
}

export const DailyEditorialHero: React.FC<DailyEditorialHeroProps> = ({
  outfit,
  occasion,
  onMarkWorn,
  onSaveLook,
  onOpenInAtelier,
  onOpenFeedback,
  onStyleThreeWays,
  onExploreAlternatives,
  onAskSaathi,
  isPlannedToday = false,
}) => {
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  const allItems: WardrobeItem[] = Object.values(outfit.slots || {}).flat();
  const components = extractEditorialComponents(outfit.slots);

  // Hero piece: prefer top or ethnic centerpiece, fallback to first available piece
  const heroPiece = components.top || components.bottom || allItems[0];
  const companionPieces = allItems.filter((i) => i.id !== heroPiece?.id);

  // Editorial reasoning in human language
  const reasoning: EditorialReasoningOutput = buildEditorialReasoning({
    concept: outfit.template || `${occasion} Ensemble`,
    occasion,
    components,
  });

  // Extract unique palette colors across all garments in the look
  const paletteColors = Array.from(
    new Set(
      allItems
        .flatMap((i) => i.colors || [])
        .map((c) => c.toLowerCase().trim())
        .filter(Boolean)
    )
  ).slice(0, 5);

  const scorePercent = formatRecommendationScore(outfit.score);

  return (
    <div className="relative rounded-3xl couture-card specular-border border border-border/90 bg-(--paper) p-5 sm:p-7 shadow-sm transition-all hover:border-(--kumkum)/30">
      {/* Top Editorial Kicker & Role Tag */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5 mb-5">
        <div className="flex items-center gap-2">
          <span className="editorial-kicker text-(--kumkum) tracking-[0.2em]">
            PRIMARY EDITORIAL LOOK
          </span>
          {isPlannedToday ? (
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              Scheduled For Today
            </span>
          ) : (
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-(--burnished-gold)/15 text-(--burnished-gold) border border-(--burnished-gold)/30">
              Signature Best Match
            </span>
          )}
        </div>

        {/* Color Palette Indicator */}
        {paletteColors.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-muted font-sans px-2.5 py-1 rounded-full bg-(--ivory)/70 border border-border/70" title="Palette synergy">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted/90">Palette Harmony:</span>
            <div className="flex items-center -space-x-1">
              {paletteColors.map((color) => (
                <span
                  key={color}
                  className="h-3.5 w-3.5 rounded-full border border-white dark:border-stone-900 shadow-2xs"
                  style={{
                    backgroundColor:
                      color === 'white'
                        ? '#FDFBF7'
                        : color === 'black'
                        ? '#121110'
                        : color === 'cream' || color === 'beige' || color === 'ivory'
                        ? '#F4ECE1'
                        : color === 'navy'
                        ? '#142036'
                        : color === 'olive'
                        ? '#4A543B'
                        : color === 'mustard'
                        ? '#C98B22'
                        : color === 'maroon' || color === 'red'
                        ? '#8A1B36'
                        : color === 'blue'
                        ? '#2B5480'
                        : color === 'green'
                        ? '#2A583A'
                        : color === 'brown'
                        ? '#5E412F'
                        : color,
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dominant Asymmetric Composition Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left: Dominant Hero Piece Visual Card */}
        {heroPiece && (
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl overflow-hidden border border-border/80 bg-(--ivory)/60 p-3 sm:p-4 shadow-2xs">
            <div className="relative aspect-couture w-full rounded-xl overflow-hidden border border-border/70 bg-card group">
              <ItemImage item={heroPiece} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="rounded-full bg-black/65 backdrop-blur-xs px-2.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider border border-white/10 shadow-xs">
                  Anchor Piece
                </span>
              </div>
              <div className="absolute bottom-2.5 left-2.5 right-2.5 rounded-xl bg-black/70 px-3 py-2 text-white backdrop-blur-md border border-white/10 shadow-sm">
                <p className="font-serif text-base font-normal tracking-tight truncate">{heroPiece.name}</p>
                <p className="text-[10px] text-white/80 font-sans truncate mt-0.5">
                  {heroPiece.fabric ? `${heroPiece.fabric} · ` : ''}
                  {heroPiece.subcategory || heroPiece.category}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] font-sans text-muted px-1">
              <span>{heroPiece.brand ? `Brand: ${heroPiece.brand}` : 'Wardrobe Staple'}</span>
              <span className="font-medium text-(--ink)">Worn {heroPiece.timesWorn || 0}×</span>
            </div>
          </div>
        )}

        {/* Right: Companion Pieces Stack & Editorial Narrative */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {/* Companion Pieces Grid */}
          <div className="space-y-2">
            <span className="editorial-kicker text-muted text-[10px] tracking-[0.18em]">
              PAIRED COMPANION PIECES ({companionPieces.length})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {companionPieces.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-xl overflow-hidden border border-border/80 bg-card p-2 flex flex-col justify-between space-y-1.5 shadow-2xs hover:border-(--kumkum)/40 transition-all couture-press group"
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-border/60 bg-(--ivory)/80">
                    <ItemImage item={comp} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div>
                    <h5 className="font-serif text-xs font-normal text-(--ink) truncate group-hover:text-accent transition-colors" title={comp.name}>
                      {comp.name}
                    </h5>
                    <p className="text-[9.5px] text-muted font-sans truncate capitalize">
                      {comp.subcategory || comp.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outfit Title & Editorial Styling Narrative */}
          <div className="rounded-2xl border border-border/80 bg-(--ivory)/40 p-4 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl sm:text-2xl text-(--ink) font-normal tracking-tight">
                {outfit.template || `${occasion.charAt(0).toUpperCase() + occasion.slice(1)} Ensemble`}
              </h3>
              <span className="text-[11px] font-semibold text-(--burnished-gold) font-sans shrink-0 px-2 py-0.5 rounded-full bg-(--burnished-gold)/10 border border-(--burnished-gold)/20">
                {scorePercent}% alignment
              </span>
            </div>

            <p className="text-xs sm:text-sm text-muted font-sans leading-relaxed">
              {outfit.why || reasoning.sections.coreConcept}
            </p>

            {/* Expandable 4-Part Editorial Intelligence */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowFullReasoning(!showFullReasoning)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--kumkum) hover:underline cursor-pointer min-h-11 py-1 couture-press"
                aria-expanded={showFullReasoning}
              >
                <span>{showFullReasoning ? 'Hide styling rationale' : 'Why this ensemble works'}</span>
                {showFullReasoning ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showFullReasoning && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-border/80 bg-card p-3.5 text-xs font-sans text-muted animate-fade-in shadow-xs">
                  <div>
                    <strong className="text-(--ink) block text-[11px] uppercase tracking-wider font-semibold">
                      Color Theory:
                    </strong>
                    <p className="text-[11.5px] leading-relaxed mt-0.5">
                      {reasoning.sections.colorTheory}
                    </p>
                  </div>

                  <div>
                    <strong className="text-(--ink) block text-[11px] uppercase tracking-wider font-semibold">
                      Proportions &amp; Silhouette:
                    </strong>
                    <p className="text-[11.5px] leading-relaxed mt-0.5">
                      {reasoning.sections.proportionSilhouette}
                    </p>
                  </div>

                  <div>
                    <strong className="text-(--ink) block text-[11px] uppercase tracking-wider font-semibold">
                      Textile &amp; Thermal Balance:
                    </strong>
                    <p className="text-[11.5px] leading-relaxed mt-0.5">
                      {reasoning.sections.fabricTexture}
                    </p>
                  </div>

                  <div>
                    <strong className="text-(--ink) block text-[11px] uppercase tracking-wider font-semibold">
                      Styling Direction:
                    </strong>
                    <p className="text-[11.5px] leading-relaxed mt-0.5">
                      {reasoning.sections.stylingDirection.split('\n')[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Editorial Action Strip (All >= 44px min-h-11 Touch Targets) */}
      <div className="mt-6 pt-4 border-t border-border/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="default"
            size="default"
            onClick={() => onMarkWorn(outfit)}
            className="min-h-11 px-5 rounded-full gap-2 font-bold text-xs uppercase tracking-wider bg-accent text-white shadow-xs hover:opacity-95 couture-press flex-1 sm:flex-initial"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Wear Today</span>
          </Button>

          <Button
            variant="outline"
            size="default"
            onClick={() => onSaveLook(outfit)}
            className="min-h-11 px-4 rounded-full gap-1.5 text-xs font-semibold text-muted hover:text-(--ink) couture-press"
            title="Save to Lookbook archive"
            aria-label="Save outfit to Lookbook"
          >
            <Bookmark className="h-4 w-4 text-(--burnished-gold)" />
            <span>Save Look</span>
          </Button>

          {onStyleThreeWays && heroPiece && (
            <Button
              variant="outline"
              size="default"
              onClick={() => onStyleThreeWays(heroPiece)}
              className="min-h-11 px-4 rounded-full gap-2 text-xs font-semibold hover:border-(--burnished-gold) hover:text-(--burnished-gold) couture-press"
            >
              <Layers className="h-4 w-4 text-(--burnished-gold)" />
              <span>Style 3 Ways</span>
            </Button>
          )}

          {onExploreAlternatives && (
            <Button
              variant="outline"
              size="default"
              onClick={onExploreAlternatives}
              className="min-h-11 px-4 rounded-full gap-2 text-xs font-semibold text-muted hover:text-(--ink) hover:border-(--ink) couture-press"
            >
              <ArrowRight className="h-4 w-4 text-(--kumkum)" />
              <span>Explore Alternatives</span>
            </Button>
          )}

          {onAskSaathi && (
            <Button
              variant="outline"
              size="default"
              onClick={() => onAskSaathi(`How can I elevate this ${outfit.template || occasion} look with styling or layering?`)}
              className="min-h-11 px-4 rounded-full gap-2 text-xs font-semibold text-(--ink) border-(--burnished-gold)/50 bg-(--burnished-gold)/5 hover:bg-(--burnished-gold)/10 couture-press"
            >
              <Sparkles className="h-4 w-4 text-(--burnished-gold)" />
              <span className="font-serif">Ask AI Saathi</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="ghost"
            size="default"
            onClick={() => onOpenInAtelier(heroPiece, occasion)}
            className="min-h-11 px-3.5 rounded-full text-xs font-semibold text-muted hover:text-(--ink) couture-press"
            title="Open in Atelier"
          >
            <span>Atelier</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>

          <Button
            variant="ghost"
            size="default"
            onClick={() => onOpenFeedback(outfit)}
            className="min-h-11 px-3 rounded-full text-muted hover:text-rose-600 couture-press"
            title="Provide feedback to refine future recommendations"
            aria-label="Fine-tune look with feedback"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
