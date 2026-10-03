import React from 'react';
import { Heart } from 'lucide-react';
import { WardrobeItem } from '../../types';
import { LazyImage } from '../common/LazyImage';

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

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-(--border) bg-(--card) p-2.5 transition-all duration-200 hover:shadow-md active:scale-[0.98] cursor-pointer select-none ${
        isLaundry ? 'opacity-60 grayscale-40' : ''
      }`}
    >
      {/* Photo tile container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-(--background)">
        <LazyImage
          src={item.photo}
          alt={item.name}
          category={item.category}
          subcategory={item.subcategory}
          colors={item.colors}
          className="h-full w-full"
        />

        {/* Status indicator badge */}
        <div className="absolute left-2 top-2 z-10">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight shadow-2xs ${
              item.status === 'clean'
                ? 'bg-white/90 text-emerald-800 dark:bg-black/70 dark:text-emerald-300'
                : isWash
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            {item.status === 'clean' ? 'Ready' : isWash ? 'Wash' : 'Laundry'}
          </span>
        </div>

        {/* Favorite heart button */}
        <button
          type="button"
          aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => onToggleFavorite(e, item)}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-xs text-(--muted) transition-transform hover:scale-110 active:scale-90 dark:bg-black/60"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              item.favorite
                ? 'fill-(--accent) stroke-(--accent)'
                : 'stroke-(--text)/70 hover:stroke-(--accent)'
            }`}
          />
        </button>
      </div>

      {/* Item info */}
      <div className="mt-2.5 px-1 pb-1">
        <h4 className="truncate text-xs font-bold text-(--text) tracking-tight sm:text-sm">
          {item.name}
        </h4>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-(--muted)">
          <span className="capitalize">{item.subcategory || item.category}</span>
          {item.timesWorn > 0 && (
            <span className="text-[10px] font-medium text-(--muted)/80">
              {item.timesWorn}w
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
