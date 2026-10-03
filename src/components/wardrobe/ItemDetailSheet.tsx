import React, { useState } from 'react';
import { Heart, Trash2, Plus } from 'lucide-react';
import { WardrobeItem, Status } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { ItemImage } from '../common/ItemImage';

interface ItemDetailSheetProps {
  item: WardrobeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  if (!item) return null;

  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note);
  const [status, setStatus] = useState<Status>(item.status);
  const [favorite, setFavorite] = useState(item.favorite);
  const [timesWorn, setTimesWorn] = useState(item.timesWorn);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    await onUpdate(item.id, {
      name,
      note,
      status,
      favorite,
      timesWorn,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Remove "${item.name}" from your wardrobe?`)) {
      setIsDeleting(true);
      await onDelete(item.id);
      setIsDeleting(false);
      onClose();
    }
  };

  const handleWearIncrement = async () => {
    const next = timesWorn + 1;
    setTimesWorn(next);
    await onUpdate(item.id, { timesWorn: next });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="GARMENT PROFILE">
      <div className="space-y-5">
        {/* Large Garment Photograph */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-(--border) bg-(--ivory)">
          <ItemImage
            item={item}
            className="h-full w-full object-contain p-2"
            isHero
          />
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-(--paper)/90 backdrop-blur-xs text-(--muted) shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                favorite
                  ? 'fill-(--kumkum) stroke-(--kumkum)'
                  : 'stroke-(--ink)'
              }`}
            />
          </button>
        </div>

        {/* Garment Title & Metadata */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            {item.category} · {item.subcategory || 'staple'}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-(--border) bg-(--paper) px-3.5 py-2.5 font-serif text-xl font-normal text-(--ink) outline-none focus:border-(--ink)"
          />
        </div>

        {/* Colors & Formality row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-(--border) pb-3.5">
          {item.colors.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md bg-(--ivory) px-2.5 py-1 text-xs font-medium capitalize text-(--ink) border border-(--border)"
            >
              <span
                className="h-2 w-2 rounded-full border border-black/10"
                style={{ backgroundColor: c }}
              />
              {c}
            </span>
          ))}
          <span className="ml-auto text-xs text-(--muted) font-medium">
            Formality: <strong className="text-(--ink)">{item.formality}/5</strong>
          </span>
        </div>

        {/* Physical Wardrobe State (Laundry) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted)">
            WARDROBE STATE
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'clean', label: 'Clean & Ready' },
                { id: 'needs_washing', label: 'Needs Wash' },
                { id: 'in_laundry', label: 'In Laundry' },
              ] as { id: Status; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`min-h-11 rounded-xl px-2 py-2 text-xs font-semibold transition-all ${
                  status === s.id
                    ? s.id === 'clean'
                      ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                      : s.id === 'needs_washing'
                      ? 'border border-amber-600 bg-amber-600 text-white shadow-2xs'
                      : 'border border-stone-600 bg-stone-700 text-white shadow-2xs'
                    : 'border border-(--border) bg-(--card) text-(--muted) hover:border-(--ink)'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wear History */}
        <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--ivory) p-3.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted)">
              WEAR HISTORY
            </span>
            <p className="font-serif text-sm italic text-(--ink)">
              Worn {timesWorn} {timesWorn === 1 ? 'time' : 'times'} so far
            </p>
          </div>
          <button
            type="button"
            onClick={handleWearIncrement}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-(--ink) bg-(--paper) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-(--ink) transition-colors hover:bg-(--ink) hover:text-(--paper) active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span>Log Wear</span>
          </button>
        </div>

        {/* Styling or Care Note */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--muted)">
            STYLING OR FABRIC CARE NOTE
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Dry clean recommended, pairs elegantly with tan Kolhapuris"
            className="mt-1.5 w-full rounded-xl border border-(--border) bg-(--paper) p-3 text-xs text-(--ink) outline-none focus:border-(--ink)"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Remove item from wardrobe"
            className="flex min-h-12 w-12 items-center justify-center rounded-xl border border-red-200 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 active:scale-95"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-12 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs font-semibold uppercase tracking-wider text-(--paper) shadow-sm transition-all hover:bg-(--ink)/90 active:scale-98"
          >
            Save Changes
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

