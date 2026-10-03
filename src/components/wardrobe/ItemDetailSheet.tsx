import React, { useState } from 'react';
import { Heart, Trash2, Plus, Sparkles } from 'lucide-react';
import { WardrobeItem, Status } from '../../types';
import { BottomSheet } from '../common/BottomSheet';
import { LazyImage } from '../common/LazyImage';

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
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Item Details">
      <div className="space-y-5">
        {/* Large photo container */}
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background)]">
          <LazyImage
            src={item.photo}
            alt={name}
            category={item.category}
            subcategory={item.subcategory}
            colors={item.colors}
            className="h-full w-full"
            isHero
          />
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs text-[var(--muted)] shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-black/70"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                favorite
                  ? 'fill-[var(--accent)] stroke-[var(--accent)]'
                  : 'stroke-[var(--text)]'
              }`}
            />
          </button>
        </div>

        {/* Name input */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Item Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Categories and colors badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--background)] px-3 py-1 text-xs font-semibold text-[var(--text)] border border-[var(--border)]">
            {item.category} · {item.subcategory || 'piece'}
          </span>
          {item.colors.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--background)] px-3 py-1 text-xs font-semibold capitalize text-[var(--muted)] border border-[var(--border)]"
            >
              <span
                className="h-2 w-2 rounded-full border border-black/20"
                style={{ backgroundColor: c }}
              />
              {c}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
            Formality:
            <span className="font-bold text-[var(--text)]">{item.formality}/5</span>
          </span>
        </div>

        {/* Status switcher */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Laundry & Cleanliness
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'clean', label: 'Ready (Clean)' },
                { id: 'needs_washing', label: 'Needs Wash' },
                { id: 'in_laundry', label: 'In Laundry' },
              ] as { id: Status; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`min-h-[44px] rounded-2xl px-2 py-2 text-xs font-bold transition-all ${
                  status === s.id
                    ? s.id === 'clean'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : s.id === 'needs_washing'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-stone-600 text-white shadow-xs'
                    : 'border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--muted)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Times worn tracker */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3">
          <div>
            <span className="text-xs font-bold text-[var(--text)]">Wear History</span>
            <p className="text-[11px] text-[var(--muted)]">
              Worn <strong className="text-[var(--text)]">{timesWorn}</strong> times so far
            </p>
          </div>
          <button
            type="button"
            onClick={handleWearIncrement}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--text)] border border-[var(--border)] shadow-2xs hover:border-[var(--accent)] active:scale-95"
          >
            <Plus className="h-4 w-4 text-[var(--accent)]" />
            Log Wear
          </button>
        </div>

        {/* Note input */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Styling or Care Note
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Dry clean only, shrinks slightly, great with sneakers"
            className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete item"
            className="flex min-h-[48px] w-12 items-center justify-center rounded-2xl border border-red-200 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 active:scale-95"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-[48px] rounded-2xl bg-[var(--accent)] px-4 py-3 text-xs font-bold text-white shadow-xs transition-transform hover:opacity-95 active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
