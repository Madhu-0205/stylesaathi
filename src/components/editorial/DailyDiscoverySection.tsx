import React from 'react';
import {
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Lightbulb,
  Compass,
  Shirt,
  ChevronRight,
} from 'lucide-react';
import { WardrobeItem, OutfitPlan, Occasion } from '../../types';
import { ItemImage } from '../common/ItemImage';
import { Button } from '@/components/ui/button';
import { DESIGNERS_EDIT_PHILOSOPHIES } from '../../engine/knowledge/designersEditCatalog';

interface DailyDiscoverySectionProps {
  underusedItem?: WardrobeItem | null;
  upcomingPlan?: OutfitPlan | null;
  activeOccasion: Occasion;
  onStyleThreeWays?: (item: WardrobeItem) => void;
  onOpenInAtelier: (anchorItem?: WardrobeItem, occasion?: string) => void;
  onGoToCalendar: () => void;
  onGoToWardrobe: () => void;
  onGoToTrends?: () => void;
}

export const DailyDiscoverySection: React.FC<DailyDiscoverySectionProps> = ({
  underusedItem,
  upcomingPlan,
  activeOccasion,
  onStyleThreeWays,
  onOpenInAtelier,
  onGoToCalendar,
  onGoToWardrobe,
  onGoToTrends,
}) => {
  // Select a relevant design philosophy tip
  const dailyPhilosophy = DESIGNERS_EDIT_PHILOSOPHIES[0];

  return (
    <section aria-label="Daily Fashion Discovery" className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-(--burnished-gold)" />
            <h2 className="editorial-title text-xl sm:text-2xl text-(--ink) font-normal">
              Daily Style Discovery
            </h2>
          </div>
          <p className="text-xs text-muted font-sans mt-0.5">
            Mindful wardrobe rotation, architectural styling wisdom, and upcoming calendar prep.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. UNDERUSED PIECE SPOTLIGHT */}
        <article className="rounded-3xl couture-card specular-border border border-border/90 p-5 flex flex-col justify-between space-y-4 shadow-2xs bg-(--paper)/90">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                Forgotten Gem
              </span>
              <span className="text-[11px] font-sans text-muted">
                {underusedItem ? (underusedItem.timesWorn === 0 ? 'Unworn' : `Worn ${underusedItem.timesWorn}×`) : 'Archive Piece'}
              </span>
            </div>

            {underusedItem ? (
              <div className="flex items-center gap-3.5 pt-1">
                <div className="relative h-20 w-16 shrink-0 rounded-xl overflow-hidden border border-border/80 bg-card shadow-xs">
                  <ItemImage item={underusedItem} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-serif text-base text-(--ink) font-normal truncate">
                    {underusedItem.name}
                  </h3>
                  <p className="text-xs text-muted font-sans truncate">
                    {underusedItem.subcategory || underusedItem.category} · {underusedItem.colors?.[0] || 'Neutral'}
                  </p>
                  <p className="text-[11px] text-muted italic font-sans line-clamp-2">
                    Dormant in your archive. Ready for a fresh silhouette.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center rounded-2xl border border-dashed border-border/80 text-xs text-muted">
                All garments in active rotation. Great mindful wardrobe balance!
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center gap-2">
            {underusedItem && onStyleThreeWays ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => onStyleThreeWays(underusedItem)}
                className="min-h-11 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white flex-1 couture-press shadow-xs"
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                <span>Style 3 Ways</span>
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onGoToWardrobe}
                className="min-h-11 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white flex-1 couture-press shadow-xs"
              >
                <span>Browse Closet</span>
              </Button>
            )}

            {underusedItem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenInAtelier(underusedItem, activeOccasion)}
                className="min-h-11 px-3 rounded-full text-xs font-semibold text-muted hover:text-(--ink) couture-press"
                title="Open in Atelier"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </article>

        {/* 2. STYLING PRO-TIP FROM THE DESIGNER'S EDIT */}
        <article className="rounded-3xl couture-card specular-border border border-border/90 p-5 flex flex-col justify-between space-y-4 shadow-2xs bg-(--paper)/90">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-(--burnished-gold)/10 text-(--burnished-gold) border border-(--burnished-gold)/20">
                Stylist's Wisdom
              </span>
              <span className="text-[11px] font-sans text-muted">
                Indian Fashion Craft
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-(--ink)">
                <Lightbulb className="h-4 w-4 text-(--burnished-gold) shrink-0" />
                <h3 className="font-serif text-base font-normal">
                  {dailyPhilosophy.title}
                </h3>
              </div>
              <p className="text-xs text-muted font-sans line-clamp-3 leading-relaxed">
                "{dailyPhilosophy.description || dailyPhilosophy.subtitle}"
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center justify-between">
            <span className="text-[11px] text-muted font-sans">
              Rule of living craft &amp; drape
            </span>
            <div className="flex items-center gap-1">
              {onGoToTrends && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onGoToTrends}
                  className="min-h-11 px-3 rounded-full text-xs font-semibold text-(--burnished-gold) hover:text-(--ink) couture-press"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  <span>Trends</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenInAtelier(undefined, activeOccasion)}
                className="min-h-11 px-3 rounded-full text-xs font-semibold text-muted hover:text-(--ink) couture-press"
              >
                <span>Atelier</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </article>

        {/* 3. UPCOMING HORIZON / CALENDAR PREPARATION */}
        <article className="rounded-3xl couture-card specular-border border border-border/90 p-5 flex flex-col justify-between space-y-4 shadow-2xs bg-(--paper)/90">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-(--kumkum)/10 text-(--kumkum) border border-(--kumkum)/20">
                Calendar Horizon
              </span>
              <span className="text-[11px] font-sans text-muted">
                Lookahead
              </span>
            </div>

            {upcomingPlan ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-(--burnished-gold)">
                    {new Date(upcomingPlan.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span className="text-[10px] capitalize text-muted">
                    {upcomingPlan.occasion}
                  </span>
                </div>
                <h3 className="font-serif text-base text-(--ink) font-normal line-clamp-1">
                  {upcomingPlan.outfit.template || `${upcomingPlan.occasion} Look`}
                </h3>
                <div className="flex -space-x-2 pt-1">
                  {Object.values(upcomingPlan.outfit.slots || {})
                    .flat()
                    .slice(0, 3)
                    .map((item: any) => (
                      <div
                        key={item.id}
                        className="h-11 w-10 shrink-0 rounded-lg overflow-hidden border-2 border-white dark:border-stone-900 bg-card shadow-xs"
                      >
                        <ItemImage item={item} className="h-full w-full object-cover" />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <h3 className="font-serif text-base text-(--ink) font-normal">
                  Tomorrow is an Open Canvas
                </h3>
                <p className="text-xs text-muted font-sans leading-relaxed">
                  No look planned for the coming days. Schedule your outfits in advance for effortless mornings.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToCalendar}
              className="min-h-11 px-4 rounded-full text-xs font-semibold text-(--ink) hover:border-(--kumkum) hover:text-(--kumkum) w-full flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Calendar className="h-3.5 w-3.5 text-(--kumkum)" />
              <span>{upcomingPlan ? 'View in Calendar' : 'Plan Ahead in Calendar'}</span>
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
};

