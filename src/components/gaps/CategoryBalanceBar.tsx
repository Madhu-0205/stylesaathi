import React from 'react';
import { Category, WardrobeItem } from '../../types';
import { LazyImage } from '../common/LazyImage';

interface CategoryBalanceBarProps {
  balance: {
    category: Category;
    count: number;
    percentage: number;
    sampleItem: WardrobeItem | null;
  }[];
}

export const CategoryBalanceBar: React.FC<CategoryBalanceBarProps> = ({ balance }) => {
  return (
    <div className="rounded-3xl border border-(--border) bg-(--card) p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-(--text)">
          Category Balance
        </h3>
        <span className="text-[11px] text-(--muted)">Actual pieces owned</span>
      </div>

      <div className="space-y-3">
        {balance.map((b) => (
          <div key={b.category} className="flex items-center gap-3">
            {/* Thumbnail / Fallback Icon */}
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-(--border) bg-(--background)">
              {b.sampleItem ? (
                <LazyImage
                  src={b.sampleItem.photo}
                  alt={b.category}
                  category={b.category}
                  subcategory={b.sampleItem.subcategory}
                  colors={b.sampleItem.colors}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-(--muted)">
                  0
                </div>
              )}
            </div>

            {/* Progress bar and labels */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs font-semibold text-(--text) mb-1">
                <span>{b.category}</span>
                <span className="text-(--muted) font-bold">{b.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-(--background) border border-(--border)/40">
                <div
                  className="h-full rounded-full bg-(--accent) transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(b.count > 0 ? 8 : 0, b.percentage))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
