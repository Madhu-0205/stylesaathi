import React, { useState } from 'react';
import { Calendar as CalendarIcon, X, Check, ArrowRight } from 'lucide-react';
import { GeneratedOutfit, WardrobeItem, Occasion } from '../../types';
import { useWardrobeContext } from '../../context/WardrobeContext';
import { ItemImage } from '../common/ItemImage';

interface PlanLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfit: GeneratedOutfit;
  accessory?: WardrobeItem | null;
  occasion: Occasion;
}

export const PlanLookModal: React.FC<PlanLookModalProps> = ({
  isOpen,
  onClose,
  outfit,
  accessory,
  occasion,
}) => {
  const { savePlan, showToast } = useWardrobeContext();

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const todayStr = formatDate(today);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = formatDate(dayAfter);

  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const pieces = Object.values(outfit.slots).flat();
  if (accessory) pieces.push(accessory);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await savePlan({
        date: selectedDate,
        outfit,
        accessory,
        occasion,
        status: 'planned',
      });
      showToast('LOOK PLANNED · Added to Style Calendar');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-(--ink) hover:bg-(--ivory)"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-1">
          <CalendarIcon className="h-4 w-4 text-(--burnished-gold)" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
            STYLE CALENDAR
          </span>
        </div>
        <h2 className="font-serif text-2xl font-normal text-(--ink) tracking-tight">
          Plan This Look
        </h2>
        <p className="mt-1 text-xs text-muted">
          Schedule this outfit in your Style Calendar so you are ready ahead of time.
        </p>

        {/* Outfit Preview */}
        <div className="my-4 rounded-xl border border-border bg-(--ivory) p-3 flex items-center gap-3">
          <div className="flex -space-x-3 overflow-hidden shrink-0">
            {pieces.slice(0, 3).map((p, idx) => (
              <div
                key={p.id || idx}
                className="h-12 w-10 rounded-lg border border-border bg-card overflow-hidden shadow-2xs"
              >
                <ItemImage item={p} className="h-full w-full object-contain p-0.5" />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-serif font-medium text-(--ink) truncate block">
              {outfit.template}
            </span>
            <span className="text-[10px] font-sans text-muted uppercase tracking-wider block">
              {occasion} · {pieces.length} pieces
            </span>
          </div>
        </div>

        {/* Quick Date Shortcuts */}
        <div className="space-y-1.5 mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
            WHEN DO YOU WANT TO WEAR THIS?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`rounded-xl border p-2 text-center transition-all ${
                selectedDate === todayStr
                  ? 'border-(--ink) bg-(--ink) text-(--paper) font-bold shadow-2xs'
                  : 'border-border bg-card text-muted hover:border-(--ink)'
              }`}
            >
              <span className="block text-[10px] uppercase font-semibold">Today</span>
              <span className="text-xs">{today.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowStr)}
              className={`rounded-xl border p-2 text-center transition-all ${
                selectedDate === tomorrowStr
                  ? 'border-(--ink) bg-(--ink) text-(--paper) font-bold shadow-2xs'
                  : 'border-border bg-card text-muted hover:border-(--ink)'
              }`}
            >
              <span className="block text-[10px] uppercase font-semibold text-(--burnished-gold)">Tomorrow</span>
              <span className="text-xs">{tomorrow.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(dayAfterStr)}
              className={`rounded-xl border p-2 text-center transition-all ${
                selectedDate === dayAfterStr
                  ? 'border-(--ink) bg-(--ink) text-(--paper) font-bold shadow-2xs'
                  : 'border-border bg-card text-muted hover:border-(--ink)'
              }`}
            >
              <span className="block text-[9px] uppercase font-semibold">Day After</span>
              <span className="text-xs">{dayAfter.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
            </button>
          </div>
        </div>

        {/* Custom Date Input */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
            CHOOSE A DATE:
          </label>
          <input
            type="date"
            value={selectedDate}
            min={todayStr}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-(--ink) focus:border-(--ink) focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedDate}
            className="w-full flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs disabled:opacity-50"
          >
            <span>Plan This Look</span>
            <ArrowRight className="h-3.5 w-3.5 text-(--burnished-gold)" />
          </button>
        </div>
      </div>
    </div>
  );
};
