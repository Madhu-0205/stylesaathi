import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Bookmark,
  ThumbsDown,
  ArrowRight,
  Layers,
  ArrowUpRight,
  Shirt,
  Info,
} from 'lucide-react';
import { RecommendedOutfit, GeneratedOutfit, WardrobeItem, Occasion } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import {
  buildEditorialReasoning,
  extractEditorialComponents,
} from '../../engine/saathi/editorialReasoning';
import { formatRecommendationScore } from '../../utils/scoreFormatter';

interface AlternativeLooksStripProps {
  outfits: (RecommendedOutfit | GeneratedOutfit)[];
  activeOccasion: Occasion;
  onSelectHero?: (outfit: RecommendedOutfit | GeneratedOutfit) => void;
  onMarkWorn: (outfit: GeneratedOutfit) => void;
  onSaveLook: (outfit: GeneratedOutfit) => void;
  onOpenInAtelier: (anchorItem?: WardrobeItem, occasion?: string) => void;
  onOpenFeedback: (outfit: GeneratedOutfit) => void;
  onStyleThreeWays?: (anchorItem: WardrobeItem) => void;
}

export const AlternativeLooksStrip: React.FC<AlternativeLooksStripProps> = ({
  outfits,
  activeOccasion,
  onSelectHero,
  onMarkWorn,
  onSaveLook,
  onOpenInAtelier,
  onOpenFeedback,
  onStyleThreeWays,
}) => {
  if (!outfits || outfits.length === 0) {
    return null;
  }

  return (
    <section id="alternative-looks" aria-label="Alternative Curated Looks" className="space-y-4 scroll-mt-20">
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-(--kumkum)" />
            <h2 className="editorial-title text-xl sm:text-2xl text-(--ink) font-normal">
              Alternative Styling Angles
            </h2>
          </div>
          <p className="text-xs text-muted font-sans mt-0.5">
            Different silhouettes, tonal directions, and creative pairings from your current wardrobe archive.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {outfits.map((outfit, index) => {
          const allItems: WardrobeItem[] = Object.values(outfit.slots || {}).flat();
          const components = extractEditorialComponents(outfit.slots);
          const heroPiece = components.top || components.bottom || allItems[0];
          const scorePercent = formatRecommendationScore(outfit.score);

          let roleTitle = `Look 0${index + 2}`;
          let roleKicker = 'Alternative Angle';
          let roleBadgeClass =
            'text-(--kumkum) bg-(--kumkum)/10 border-(--kumkum)/20';

          if (outfit.role === 'best_match') {
            roleTitle = 'Look 01 · Signature Best Match';
            roleKicker = 'Highest Alignment';
            roleBadgeClass =
              'text-(--burnished-gold) bg-(--burnished-gold)/15 border-(--burnished-gold)/30';
          } else if (outfit.role === 'alternative') {
            roleTitle = 'Look 02 · Alternative Balance';
            roleKicker = 'Tonal Variation';
            roleBadgeClass =
              'text-amber-800 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-950/40';
          } else if (outfit.role === 'explore') {
            roleTitle = 'Look 03 · Creative Harmony';
            roleKicker = 'Unexpected Synergy';
            roleBadgeClass =
              'text-indigo-800 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-300 dark:bg-indigo-950/40';
          } else if (outfit.role === 'underused') {
            roleTitle = 'Look 04 · Archive Rediscovery';
            roleKicker = 'Dormant Treasure';
            roleBadgeClass =
              'text-emerald-800 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-950/40';
          }

          // Editorial reasoning
          const reasoning = buildEditorialReasoning({
            concept: outfit.template || `${activeOccasion} Look`,
            occasion: activeOccasion,
            components,
          });

          // Palette swatches
          const paletteColors = Array.from(
            new Set(
              allItems
                .flatMap((i) => i.colors || [])
                .map((c) => c.toLowerCase().trim())
                .filter(Boolean)
            )
          ).slice(0, 4);

          return (
            <article
              key={outfit.id || `alt-look-${index}`}
              className="rounded-3xl couture-card specular-border border border-border/90 p-5 flex flex-col justify-between space-y-4 hover:border-(--kumkum)/40 transition-all shadow-2xs group bg-(--paper)/90"
            >
              <div className="space-y-3.5">
                {/* Header & Badges */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${roleBadgeClass}`}
                  >
                    {roleTitle}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-sans text-muted">
                    <span className="font-semibold text-(--burnished-gold) px-2 py-0.5 rounded-full bg-(--burnished-gold)/10 border border-(--burnished-gold)/20">
                      {scorePercent}% match
                    </span>
                  </div>
                </div>

                {/* Garments Visual Stage */}
                <div className="grid grid-cols-3 gap-2 aspect-16/9 w-full rounded-2xl overflow-hidden bg-(--ivory)/90 p-2 border border-border/70">
                  {allItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="relative h-full w-full rounded-xl overflow-hidden border border-border/60 bg-card group/item"
                    >
                      <ItemImage item={item} className="h-full w-full object-cover transition-transform duration-300 group-hover/item:scale-105" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-1">
                        <p className="text-[9px] font-sans font-medium text-white truncate text-center">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Color Palette Strip */}
                {paletteColors.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-sans text-muted uppercase tracking-wider">
                      Palette:
                    </span>
                    <div className="flex items-center gap-1">
                      {paletteColors.map((col) => (
                        <span
                          key={col}
                          className="h-3 w-3 rounded-full border border-black/15 shadow-2xs inline-block"
                          style={{ backgroundColor: col }}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Title & Editorial Note */}
                <div>
                  <h3 className="font-serif text-lg sm:text-xl text-(--ink) font-normal line-clamp-1">
                    {outfit.template || `${activeOccasion} Composition`}
                  </h3>
                  <p className="text-xs text-muted font-sans line-clamp-2 mt-1 leading-relaxed">
                    {outfit.why || reasoning.sections.proportionSilhouette || reasoning.sections.colorTheory}
                  </p>
                </div>
              </div>

              {/* Action Buttons (All >= 44px min-h-11 Touch Targets) */}
              <div className="pt-3 border-t border-border/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onMarkWorn(outfit)}
                    className="min-h-11 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white flex-1 couture-press shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    <span>Wear</span>
                  </Button>

                  {onSelectHero && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectHero(outfit)}
                      className="min-h-11 px-3 rounded-full text-xs font-semibold text-(--ink) hover:border-(--kumkum) hover:text-(--kumkum) couture-press"
                      title="Promote this look into the primary Hero spotlight"
                      aria-label="Promote look to Hero"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Spotlight</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {onStyleThreeWays && heroPiece && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStyleThreeWays(heroPiece)}
                      className="min-h-11 w-11 p-0 rounded-full text-muted hover:text-(--burnished-gold) hover:border-(--burnished-gold)/40 couture-press"
                      title="Style this garment 3 ways"
                      aria-label="Style piece 3 ways"
                    >
                      <Layers className="h-4 w-4 text-(--burnished-gold)" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSaveLook(outfit)}
                    className="min-h-11 w-11 p-0 rounded-full text-muted hover:text-(--ink) couture-press"
                    title="Save to Lookbook"
                    aria-label="Save outfit"
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenFeedback(outfit)}
                    className="min-h-11 w-11 p-0 rounded-full text-muted hover:text-rose-600 hover:border-rose-300 couture-press"
                    title="Refine recommendations"
                    aria-label="Fine-tune outfit"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenInAtelier(heroPiece, activeOccasion)}
                    className="min-h-11 w-11 p-0 rounded-full text-muted hover:text-(--ink) couture-press"
                    title="Open in Atelier"
                    aria-label="Open look in Atelier"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

