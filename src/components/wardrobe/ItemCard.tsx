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
      className={`group relative flex flex-col cursor-pointer select-none transition-all active:scale-[0.98] ${
        isLaundry ? 'opacity-65 grayscale-30' : ''
      }`}
    >
      {/* Editorial Photo Frame */}
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-2xl border border-(--border) bg-(--card) transition-all duration-300 group-hover:border-(--muted)/60">
        <LazyImage
          src={item.photo}
          alt={item.name}
          category={item.category}
          subcategory={item.subcategory}
          colors={item.colors}
          className="h-full w-full object-contain p-2"
        />

        {/* Subtle status indicator: only shown when garment is not clean */}
        {(isWash || isLaundry) && (
          <div className="absolute left-2 top-2 z-10">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase backdrop-blur-md ${
                isWash
                  ? 'bg-amber-100/90 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'bg-stone-200/90 text-stone-700 border border-stone-300 dark:bg-stone-800/80 dark:text-stone-300'
              }`}
            >
              {isWash ? 'Needs Wash' : 'In Laundry'}
            </span>
          </div>
        )}

        {/* Favorite heart button */}
        <button
          type="button"
          aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => onToggleFavorite(e, item)}
          className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-(--muted) transition-transform hover:scale-105 active:scale-90"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--card)/85 backdrop-blur-md border border-(--border)/60 text-(--muted)">
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                item.favorite
                  ? 'fill-(--accent) stroke-(--accent)'
                  : 'stroke-(--text)/70 group-hover:stroke-(--accent)'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Garment Caption & Editorial Metadata */}
      <div className="pt-2 px-0.5">
        <h4 className="truncate text-xs font-bold text-(--text) tracking-tight">
          {item.name}
        </h4>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-(--muted) tracking-wide">
          <span className="capitalize">{item.subcategory || item.category}</span>
          {item.timesWorn > 0 && (
            <span className="text-[10px] font-medium text-(--muted)/80">
              Worn {item.timesWorn}×
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
