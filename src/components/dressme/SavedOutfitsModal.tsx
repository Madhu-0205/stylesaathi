import React from 'react';
import { Bookmark, Calendar, Check, Trash2, Sparkles, Layers } from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { GeneratedOutfit, Occasion } from '../../types';
import { Button } from '@/components/ui/button';

interface SavedOutfitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanLook: (outfit: GeneratedOutfit, occasion: Occasion) => void;
}

export const SavedOutfitsModal: React.FC<SavedOutfitsModalProps> = ({
  isOpen,
  onClose,
  onPlanLook,
}) => {
  const { savedOutfits, deleteSavedOutfit, markOutfitWornOnDate, showToast } = useWardrobeContext();

  if (!isOpen) return null;

  const handleWearToday = async (outfit: GeneratedOutfit) => {
    const todayStr = new Date().toISOString().split('T')[0];
    await markOutfitWornOnDate(outfit, todayStr);
    showToast('LOOK WORN · Logged into your wear history');
  };

  const handleDelete = async (id: string) => {
    await deleteSavedOutfit(id);
    showToast('LOOK REMOVED · Removed from Saved Ensembles');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="SAVED ENSEMBLES">
      <div className="space-y-4 pb-8 max-w-xl mx-auto">
        <div className="space-y-1">
          <span className="editorial-kicker text-(--burnished-gold)">
            PERSONAL LOOKBOOK
          </span>
          <p className="text-xs text-muted font-sans leading-relaxed">
            Your curated repository of approved silhouettes and styling combinations. Wear today or schedule for upcoming engagements.
          </p>
        </div>

        {savedOutfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-border bg-(--ivory)/50 my-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--paper) border border-border text-muted mb-3 shadow-2xs">
              <Bookmark className="h-5 w-5 text-(--burnished-gold)" />
            </div>
            <h4 className="font-serif text-lg font-normal text-(--ink)">
              No Saved Looks Yet
            </h4>
            <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed">
              When you discover an outfit you love in Dress Me or Style This Item, tap &quot;Save&quot; to bookmark it here for effortless repetition.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {savedOutfits.map((saved) => {
              const outfit = saved.outfit;
              const pieces = Object.values(outfit.slots).flat();
              const savedDateStr = new Date(saved.savedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={saved.id}
                  className="rounded-3xl border border-border bg-(--paper) p-4 shadow-2xs hover:shadow-xs transition-shadow space-y-3 specular-border"
                >
                  {/* Card Header: Title & Occasion */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-(--ivory) px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--burnished-gold) border border-(--burnished-gold)/20">
                          {outfit.template}
                        </span>
                        <span className="text-[10px] text-muted font-sans font-medium">
                          Saved {savedDateStr}
                        </span>
                      </div>
                      <h4 className="font-serif text-base sm:text-lg font-normal text-(--ink) mt-1">
                        {saved.name || outfit.explanation?.headline || 'Curated Ensemble'}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(saved.id)}
                      aria-label="Remove saved look"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Composite Garments Strip */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pieces.map((piece, pIdx) => (
                      <div
                        key={`${saved.id}-${piece.id}-${pIdx}`}
                        className="group relative aspect-4/5 overflow-hidden rounded-xl border border-border bg-(--ivory)"
                      >
                        <ItemImage item={piece} className="h-full w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1.5 text-white">
                          <span className="block truncate text-[9px] font-sans font-medium leading-tight">
                            {piece.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Actions: Wear Today & Plan */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWearToday(outfit)}
                      className="flex-1 min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider gap-1.5 tactile-press"
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
                      className="flex-1 min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider gap-1.5 tactile-press"
                    >
                      <Calendar className="h-3.5 w-3.5 text-(--burnished-gold)" />
                      <span>Schedule Look</span>
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
