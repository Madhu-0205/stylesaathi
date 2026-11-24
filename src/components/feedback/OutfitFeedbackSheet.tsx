import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  X,
  RotateCcw,
  Thermometer,
  Briefcase,
  Coffee,
  Palette,
  Clock,
  Shuffle,
  ThumbsDown,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { GeneratedOutfit, RecommendedOutfit, Occasion, RejectionReason, StyleSignalEvent } from '../../types';
import { styleSignalsRepository } from '../../repositories/LocalStorageStyleSignalsRepository';

export interface OutfitFeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  outfit: GeneratedOutfit | RecommendedOutfit;
  occasion: Occasion;
  onFeedbackApplied?: (signal: StyleSignalEvent) => void;
  onFeedbackUndone?: (signalId: string) => void;
}

interface FeedbackOption {
  reason: RejectionReason;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const REJECTION_OPTIONS: FeedbackOption[] = [
  {
    reason: 'too_formal',
    label: 'Too formal',
    description: 'Feels overdressed or rigid for this setting',
    icon: <Briefcase className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'too_casual',
    label: 'Too casual',
    description: 'Needs more structure or elevated pieces',
    icon: <Coffee className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'wrong_color',
    label: 'Wrong color palette',
    description: 'Colours clash or do not match my mood',
    icon: <Palette className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'too_hot',
    label: 'Not weather appropriate',
    description: 'Too warm, too cold, or unsuitable for current climate',
    icon: <Thermometer className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'too_repetitive',
    label: 'Already worn recently',
    description: 'I wore these pieces in the last few days',
    icon: <Clock className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'dislike_combination',
    label: 'Change a garment',
    description: 'One piece does not work with the rest',
    icon: <Shuffle className="h-4 w-4 text-stone-500" />,
  },
  {
    reason: 'not_my_style',
    label: 'Not my personal style',
    description: 'Does not reflect my aesthetic affinity',
    icon: <ThumbsDown className="h-4 w-4 text-stone-500" />,
  },
];

export const OutfitFeedbackSheet: React.FC<OutfitFeedbackSheetProps> = ({
  isOpen,
  onClose,
  outfit,
  occasion,
  onFeedbackApplied,
  onFeedbackUndone,
}) => {
  const [submittedSignal, setSubmittedSignal] = useState<StyleSignalEvent | null>(null);
  const [submittedReason, setSubmittedReason] = useState<RejectionReason | 'liked' | null>(null);

  // Reset confirmation state when modal opens with a new outfit
  useEffect(() => {
    if (isOpen) {
      setSubmittedSignal(null);
      setSubmittedReason(null);
    }
  }, [isOpen, outfit]);

  // Handle ESC key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submittedSignal && onFeedbackApplied) {
          onFeedbackApplied(submittedSignal);
        }
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, submittedSignal, onFeedbackApplied]);

  const handleDismiss = useCallback(() => {
    if (submittedSignal && onFeedbackApplied) {
      onFeedbackApplied(submittedSignal);
    }
    onClose();
  }, [submittedSignal, onFeedbackApplied, onClose]);

  if (!isOpen || !outfit) return null;

  const allItems = Object.values(outfit.slots || {}).flat();
  const itemIds = allItems.map((i) => i.id);

  const handlePositiveFeedback = async () => {
    const signal: StyleSignalEvent = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: 'local_user',
      createdAt: Date.now(),
      signalType: 'liked',
      itemIds,
      occasion,
      outfitId: outfit.id,
    };

    await styleSignalsRepository.addSignal(signal);
    setSubmittedSignal(signal);
    setSubmittedReason('liked');
  };

  const handleRejection = async (reason: RejectionReason) => {
    const signal: StyleSignalEvent = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: 'local_user',
      createdAt: Date.now(),
      signalType: 'rejected',
      itemIds,
      occasion,
      rejectionReason: reason,
      outfitId: outfit.id,
    };

    await styleSignalsRepository.addSignal(signal);
    setSubmittedSignal(signal);
    setSubmittedReason(reason);
  };

  const handleUndo = async () => {
    if (submittedSignal) {
      if (styleSignalsRepository.removeSignal) {
        await styleSignalsRepository.removeSignal(submittedSignal.id);
      }
      if (onFeedbackUndone) {
        onFeedbackUndone(submittedSignal.id);
      }
      setSubmittedSignal(null);
      setSubmittedReason(null);
    }
  };

  const selectedOpt = REJECTION_OPTIONS.find((o) => o.reason === submittedReason);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Styling Feedback"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-t-3xl bg-(--card) p-5 shadow-2xl sm:rounded-3xl border border-border max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div>
            <h3 className="font-serif text-base font-bold text-(--ink)">
              {submittedSignal ? 'Feedback Recorded' : 'Styling Feedback'}
            </h3>
            <p className="text-xs text-muted">
              {submittedSignal
                ? 'Your Bayesian Style Brain has been calibrated'
                : 'Fine-tune your personal Style Brain with real-time feedback'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full p-1 text-muted hover:bg-(--ivory) hover:text-(--ink) transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Confirmation State with Undo */}
        {submittedSignal ? (
          <div className="py-6 space-y-5 animate-in fade-in duration-150">
            <div className="rounded-2xl border border-border bg-(--ivory) p-4 flex items-start gap-3.5">
              <div className="rounded-full p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--burnished-gold)">
                  {submittedReason === 'liked' ? 'Affinity Reinforced' : 'Rejection Recorded'}
                </span>
                <h4 className="font-serif text-sm font-semibold text-(--ink) mt-0.5">
                  {submittedReason === 'liked' ? 'Saved your positive affinity for this look' : selectedOpt?.label || submittedReason}
                </h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {submittedReason === 'liked'
                    ? `StyleSaathi will prioritize companion piece harmonies from this look for ${occasion}.`
                    : selectedOpt?.description || 'Your style weights have been updated.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUndo}
                className="flex-1 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-(--card) px-4 py-2.5 text-xs font-semibold text-(--ink) hover:bg-(--ivory) active:scale-95 transition-all tactile-press-sm"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                <span>Undo Feedback</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-(--ink) px-4 py-2.5 text-xs font-semibold text-(--paper) hover:opacity-95 active:scale-95 transition-all shadow-xs tactile-press-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Positive Action */}
            <div className="mt-4 shrink-0">
              <button
                type="button"
                onClick={handlePositiveFeedback}
                className="flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 tactile-press"
              >
                <Heart className="h-4 w-4 fill-white" />
                <span>I Love This Look (Reinforce Affinity)</span>
              </button>
            </div>

            {/* Granular Rejection Reasons */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Not working today? Tell us why:
              </p>
              <div className="space-y-2 pb-4">
                {REJECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.reason}
                    type="button"
                    onClick={() => handleRejection(opt.reason)}
                    className="flex w-full min-h-11 items-center gap-3 rounded-2xl border border-border/80 bg-(--ivory)/60 p-3 text-left transition-colors hover:border-(--kumkum)/40 hover:bg-(--ivory) dark:border-stone-800 dark:bg-stone-800 dark:hover:bg-stone-750 active:scale-[0.98] tactile-press-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--paper) border border-border/60 shadow-2xs dark:bg-stone-900">
                      {opt.icon}
                    </span>
                    <div className="flex-1">
                      <span className="block text-xs font-semibold text-(--ink)">
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {opt.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
