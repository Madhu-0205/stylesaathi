import React from 'react';
import { Heart } from 'lucide-react';
import { WardrobeItem } from '../../types';
import { ItemImage } from '../common/ItemImage';

interface ItemCardProps {
  item: WardrobeItem;
  onSelect: (item: WardrobeItem) => void;
  onToggleFavorite: (e: React.MouseEvent, item: WardrobeItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onSelect,
  onToggleFavorite,
}) => {
  const isLaundry = item.status === 'in_laundry';
  const isWash = item.status === 'needs_washing';
  const hasPhoto = Boolean(item.photo || item.photoId);

  return (
    <article
      className={`group relative flex flex-col select-none transition-[opacity,filter] duration-200 card-hover-lift ${
        isLaundry ? 'opacity-65 grayscale-30' : ''
      }`}
    >
      {/* Primary Card-Detail Activation Surface: Dedicated focusable action without nested interactive children */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${item.name}`}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(item);
          }
        }}
        className="flex flex-col cursor-pointer couture-press rounded-2xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Editorial Photo Frame */}
        <div className="relative aspect-4/5 aspect-couture w-full overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 group-hover:border-muted/60 specular-border shadow-2xs group-hover:shadow-md">
          <ItemImage
            item={item}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />

          {/* Subtle status indicator: only shown when garment is not clean, or clearly label textile plate fallback */}
          {isWash || isLaundry ? (
            <div className="absolute left-2.5 top-2.5 z-10">
              <span
                className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold tracking-wider uppercase backdrop-blur-md shadow-2xs ${
                  isWash
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                    : 'bg-stone-200/90 text-stone-700 border border-stone-300 dark:bg-stone-800/80 dark:text-stone-300'
                }`}
              >
                {isWash ? 'Needs Wash' : 'In Laundry'}
              </span>
            </div>
          ) : !hasPhoto ? (
            <div className="absolute left-2.5 top-2.5 z-10 opacity-75 group-hover:opacity-100 transition-opacity">
              <span className="rounded-full px-2 py-0.5 text-[7.5px] font-mono tracking-widest uppercase bg-black/45 text-stone-200 border border-white/10 backdrop-blur-xs shadow-2xs">
                Textile Plate
              </span>
            </div>
          ) : null}
        </div>

        {/* Garment Caption & Editorial Metadata */}
        <div className="pt-2 px-0.5">
          <h4
            title={item.name}
            className="line-clamp-2 min-h-8 font-serif text-[13.5px] sm:text-sm font-normal text-(--ink) tracking-tight leading-snug group-hover:text-accent transition-colors"
          >
            {item.name}
          </h4>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted tracking-wide font-sans">
            <span className="capitalize truncate max-w-32 opacity-90">
              {item.fabric ? `${item.fabric} · ` : ''}{item.subcategory || item.category}
            </span>
            {item.timesWorn > 0 && (
              <span className="text-[10px] font-medium text-muted/75 shrink-0">
                Worn {item.timesWorn}×
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Favorite Heart Button: Independent sibling control, eliminating nested interactive semantics */}
      <button
        type="button"
        aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => onToggleFavorite(e, item)}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition-transform hover:scale-105 active:scale-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent couture-press"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full glass-pill text-muted shadow-2xs">
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${
              item.favorite
                ? 'fill-accent stroke-accent'
                : 'stroke-(--text)/70 group-hover:stroke-accent'
            }`}
          />
        </div>
      </button>
    </article>
  );
};
