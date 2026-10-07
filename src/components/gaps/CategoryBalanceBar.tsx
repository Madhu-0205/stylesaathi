import React from 'react';
import { Category, WardrobeItem } from '../../types';
import { ItemImage } from '../common/ItemImage';

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
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between border-b border-border pb-3 mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            INVENTORY ANALYSIS
          </span>
          <h3 className="mt-0.5 font-serif text-xl font-normal text-(--ink)">
            Category Proportions
          </h3>
        </div>
        <span className="text-[11px] text-muted font-medium">Physical pieces</span>
      </div>

      <div className="space-y-3.5">
        {balance.map((b) => (
          <div key={b.category} className="flex items-center gap-3">
            {/* Small Thumbnail */}
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-(--ivory)">
              {b.sampleItem ? (
                <ItemImage
                  item={b.sampleItem}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-muted">
                  —
                </div>
              )}
            </div>

            {/* Subtle proportion line and count */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs font-semibold text-(--ink) mb-1.5">
                <span className="tracking-wide uppercase text-[11px]">{b.category}</span>
                <span className="text-muted text-[11px]">{b.count} {b.count === 1 ? 'piece' : 'pieces'}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--border)/60">
                <div
                  className="h-full rounded-full bg-(--ink) transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(b.count > 0 ? 6 : 0, b.percentage))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

