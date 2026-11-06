import React, { useState, useMemo } from 'react';
import { Bookmark, Calendar, Check, Trash2, Layers, Sparkles, Filter } from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { GeneratedOutfit, Occasion } from '../../types';
import { Button } from '@/components/ui/button';

interface SavedOutfitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanLook: (outfit: GeneratedOutfit, occasion: Occasion) => void;
  onOpenInAtelier?: (outfit: GeneratedOutfit) => void;
}

export const SavedOutfitsModal: React.FC<SavedOutfitsModalProps> = ({
  isOpen,
  onClose,
  onPlanLook,
  onOpenInAtelier,
}) => {
  const { savedOutfits, deleteSavedOutfit, markOutfitWornOnDate, showToast } = useWardrobeContext();
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filter categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    savedOutfits.forEach((s) => {
      const template = s.outfit.template;
      if (template) cats.add(template);
    });
    return ['all', ...Array.from(cats)];
  }, [savedOutfits]);

  const filteredOutfits = useMemo(() => {
    if (filterCategory === 'all') return savedOutfits;
    return savedOutfits.filter((s) => s.outfit.template === filterCategory);
  }, [savedOutfits, filterCategory]);

  if (!isOpen) return null;

  const handleWearToday = async (outfit: GeneratedOutfit) => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      await markOutfitWornOnDate(outfit, todayStr);
      showToast('LOOK WORN · Logged into your wear history');
    } catch {
      // Rejection handled by markOutfitWornOnDate safeguard toast
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedOutfit(id);
    showToast('LOOK REMOVED · Removed from Saved Ensembles');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="SPATIAL LOOKBOOK">
      <div className="space-y-4 pb-8 max-w-2xl mx-auto">
        {/* Editorial Introduction */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="editorial-kicker text-(--burnished-gold)">
              PERSONAL ARCHIVE
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-(--burnished-gold)/10 text-(--burnished-gold) border border-(--burnished-gold)/20">
              {savedOutfits.length} {savedOutfits.length === 1 ? 'Look' : 'Looks'}
            </span>
          </div>
          <p className="text-xs text-muted font-sans leading-relaxed">
            Your curated repository of approved silhouettes, layered coordination, and personal styling formulas. Wear today, schedule for upcoming engagements, or explore in the 3D Atelier.
          </p>
        </div>

        {/* Filter Chips if multiple templates exist */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <Filter className="h-3.5 w-3.5 text-muted shrink-0 mr-1" />
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`min-h-8 px-3 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap tactile-press-sm ${
                  filterCategory === cat
                    ? 'bg-(--ink) text-(--paper) shadow-2xs'
                    : 'bg-(--ivory) text-muted border border-border hover:text-(--ink)'
                }`}
              >
                {cat === 'all' ? 'All Silhouettes' : cat}
              </button>
            ))}
          </div>
        )}

        {/* Saved Outfits List or Empty State */}
        {savedOutfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-border bg-(--ivory)/50 my-4 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--paper) border border-border text-muted shadow-2xs">
              <Bookmark className="h-5 w-5 text-(--burnished-gold)" />
            </div>
            <div>
              <h4 className="font-serif text-lg font-normal text-(--ink)">
                Your Lookbook is Empty
              </h4>
              <p className="text-xs text-muted max-w-sm mt-1 leading-relaxed">
                When you discover an outfit you love in Dress Me or compose a combination in the 3D Atelier, tap &quot;Save&quot; to bookmark it here for effortless re-wearing.
              </p>
            </div>
          </div>
        ) : filteredOutfits.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted">
            No looks found matching &quot;{filterCategory}&quot;.
          </div>
        ) : (
          <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
            {filteredOutfits.map((saved) => {
              const outfit = saved.outfit;
              const pieces = Object.values(outfit.slots).flat();
              const savedDateStr = new Date(saved.savedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={saved.id}
                  className="rounded-3xl border border-border bg-(--paper) p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-3.5 specular-border relative"
                >
                  {/* Card Header: Title & Occasion */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-(--ivory) px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--burnished-gold)/20">
                          {outfit.template}
                        </span>
                        <span className="text-[10px] text-muted font-sans font-medium">
                          Saved on {savedDateStr}
                        </span>
                      </div>
                      <h4 className="font-serif text-base sm:text-lg font-normal text-(--ink) mt-1.5">
                        {saved.name || outfit.explanation?.headline || 'Curated Ensemble'}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(saved.id)}
                      aria-label="Remove saved look"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors tactile-press-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Layered Garments Visual Exhibition */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {pieces.map((piece, pIdx) => (
                      <div
                        key={`${saved.id}-${piece.id}-${pIdx}`}
                        className="group relative aspect-4/5 overflow-hidden rounded-2xl border border-border/80 bg-(--ivory) shadow-2xs transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <ItemImage item={piece} className="h-full w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 text-white">
                          <span className="block text-[8px] font-bold uppercase tracking-wider text-(--burnished-gold)/90">
                            {piece.category}
                          </span>
                          <span className="block truncate text-[10px] font-sans font-medium leading-tight">
                            {piece.name || piece.subcategory}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Editorial Storytelling Excerpt */}
                  {(outfit.why || outfit.explanation?.headline) && (
                    <div className="rounded-2xl bg-(--ivory)/70 border border-border/50 p-3 text-xs text-muted leading-relaxed">
                      <p className="italic font-serif text-[13px] text-(--ink)">
                        &ldquo;{outfit.why || outfit.explanation?.headline}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Card Actions: Open in 3D Atelier / Wear Today / Schedule */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                    {onOpenInAtelier && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenInAtelier(outfit);
                        }}
                        className="min-h-11 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-wider gap-1.5 tactile-press"
                      >
                        <Layers className="h-3.5 w-3.5 text-(--burnished-gold)" />
                        <span>3D Atelier</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWearToday(outfit)}
                      className="min-h-11 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-wider gap-1.5 tactile-press"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Wear Today</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onPlanLook(outfit, 'college');
                      }}
                      className="min-h-11 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-wider gap-1.5 tactile-press"
                    >
                      <Calendar className="h-3.5 w-3.5 text-(--burnished-gold)" />
                      <span>Schedule</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
