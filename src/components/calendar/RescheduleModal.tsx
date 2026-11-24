import React, { useState } from 'react';
import { Calendar as CalendarIcon, X, Check, ArrowRight } from 'lucide-react';
import { OutfitPlan } from '../../types';
import { Button } from '@/components/ui/button';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: OutfitPlan | null;
  onReschedule: (plan: OutfitPlan, newDateStr: string) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  plan,
  onReschedule,
}) => {
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

  if (!isOpen || !plan) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onReschedule(plan, selectedDate);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xl text-left space-y-4 specular-border">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:text-(--ink) hover:bg-(--ivory) active:scale-95 transition-transform"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarIcon className="h-4 w-4 text-(--burnished-gold)" />
            <span className="editorial-kicker text-(--kumkum)">
              STYLE CALENDAR · RESCHEDULE
            </span>
          </div>
          <h2 className="editorial-headline text-xl sm:text-2xl text-(--ink)">
            Reschedule Planned Look
          </h2>
          <p className="mt-1 text-xs text-muted font-sans">
            Move &ldquo;{plan.outfit.template}&rdquo; from {plan.date} to a new calendar date.
          </p>
        </div>

        {/* Date Selector Options */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
            Choose New Date:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`rounded-xl border p-2.5 text-center min-h-11 transition-all tactile-press ${
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
              className={`rounded-xl border p-2.5 text-center min-h-11 transition-all tactile-press ${
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
              className={`rounded-xl border p-2.5 text-center min-h-11 transition-all tactile-press ${
                selectedDate === dayAfterStr
                  ? 'border-(--ink) bg-(--ink) text-(--paper) font-bold shadow-2xs'
                  : 'border-border bg-card text-muted hover:border-(--ink)'
              }`}
            >
              <span className="block text-[10px] uppercase font-semibold">Day After</span>
              <span className="text-xs">{dayAfter.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
            </button>
          </div>

          {/* Custom Date Input */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
              Or pick specific date:
            </label>
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-border bg-(--ivory) px-3 py-2 text-xs font-medium text-(--ink) focus-editorial"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider tactile-press"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedDate}
            className="flex-1 min-h-11 rounded-full text-xs font-semibold uppercase tracking-wider gap-1.5 tactile-press"
          >
            <Check className="h-4 w-4 text-(--burnished-gold)" />
            <span>Confirm Reschedule</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

