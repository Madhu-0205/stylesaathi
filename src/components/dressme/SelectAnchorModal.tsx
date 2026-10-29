import React, { useState, useMemo } from 'react';
import { Search, Pin, X } from 'lucide-react';
import { WardrobeItem, Category } from '../../types';
import { CATEGORIES } from '../../data/taxonomy';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';
import { Chip } from '../common/Chip';

interface SelectAnchorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WardrobeItem[];
  selectedAnchor: WardrobeItem | null;
  onSelectAnchor: (item: WardrobeItem) => void;
  onClearAnchor: () => void;
}

export const SelectAnchorModal: React.FC<SelectAnchorModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedAnchor,
  onSelectAnchor,
  onClearAnchor,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<'All' | Category>('All');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCat !== 'All' && item.category !== selectedCat) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchColor = item.colors.some((c) => c.toLowerCase().includes(q));
        const matchFabric = item.fabric?.toLowerCase().includes(q);
        const matchSub = item.subcategory?.toLowerCase().includes(q);
        if (!matchName && !matchColor && !matchFabric && !matchSub) return false;
      }
      return true;
    });
  }, [items, selectedCat, search]);

  if (!isOpen) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="SELECT ANCHOR PIECE">
      <div className="space-y-4 pb-6 max-w-xl mx-auto">
        <div className="space-y-1">
          <span className="editorial-kicker text-(--burnished-gold)">
            INTENTIONAL STYLING
          </span>
          <p className="text-xs text-muted font-sans leading-relaxed">
            Select a piece you are eager to wear today. StyleSaathi will lock this garment and curate harmonized ensemble combinations around it.
          </p>
        </div>

        {/* Current Active Anchor Indicator */}
        {selectedAnchor && (
          <div className="flex items-center justify-between p-3 rounded-2xl border border-(--burnished-gold)/40 bg-(--burnished-gold)/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-(--paper)">
                <ItemImage item={selectedAnchor} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-bold text-(--burnished-gold) block">
                  Currently Locked
                </span>
                <h4 className="font-serif text-sm font-normal text-(--ink) truncate">
                  {selectedAnchor.name}
                </h4>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClearAnchor();
                onClose();
              }}
              className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-(--kumkum) hover:bg-(--kumkum)/10 rounded-full transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Unlock</span>
            </button>
          </div>
        )}

        {/* Minimalist Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search piece to style around..."
            className="w-full min-h-11 rounded-2xl border border-border bg-card/70 pl-10 pr-10 text-base md:text-xs font-medium text-(--text) outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center text-[11px] font-bold text-muted hover:text-(--ink)"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Chips */}
        <div className="no-scrollbar -mx-2 flex gap-1.5 overflow-x-auto px-2 py-0.5">
          <Chip
            label="All"
            active={selectedCat === 'All'}
            onClick={() => setSelectedCat('All')}
          />
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={selectedCat === cat}
              onClick={() => setSelectedCat(cat)}
            />
          ))}
        </div>

        {/* Garment Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isSelected = selectedAnchor?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectAnchor(item);
                  onClose();
                }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left p-2 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-(--burnished-gold) bg-(--burnished-gold)/10 ring-2 ring-(--burnished-gold)/40'
                    : 'border-border bg-(--paper) hover:border-muted/80'
                }`}
              >
                <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl bg-(--ivory) mb-1.5">
                  <ItemImage item={item} className="h-full w-full object-cover" />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-(--ink) text-(--paper) shadow-2xs">
                      <Pin className="h-3 w-3 fill-(--burnished-gold) text-(--burnished-gold)" />
                    </div>
                  )}
                </div>
                <h5 className="font-serif text-xs font-normal text-(--ink) line-clamp-1">
                  {item.name}
                </h5>
                <span className="text-[10px] text-muted capitalize truncate font-sans">
                  {item.fabric ? `${item.fabric} · ` : ''}{item.subcategory || item.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};

