import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  X,
  RotateCcw,
  Sparkles,
  Thermometer,
  Briefcase,
  Coffee,
  Palette,
  Clock,
  Shuffle,
  ThumbsDown,
  Check,
} from 'lucide-react';
import { GeneratedOutfit, Occasion, RejectionReason, StyleSignalEvent } from '../../types';
import { styleSignalsRepository } from '../../repositories/LocalStorageStyleSignalsRepository';

export interface OutfitFeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  outfit: GeneratedOutfit;
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
  const [selectedReason, setSelectedReason] = useState<RejectionReason | null>(null);
  const [lastSignalId, setLastSignalId] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  if (!isOpen) return null;

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
    setLastSignalId(signal.id);
    setToastMessage('Saved your positive affinity for this look.');
    setShowUndoToast(true);
    if (onFeedbackApplied) onFeedbackApplied(signal);
    onClose();
  };

  const handleRejection = async (reason: RejectionReason) => {
    setSelectedReason(reason);
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
    setLastSignalId(signal.id);
    const opt = REJECTION_OPTIONS.find((o) => o.reason === reason);
    setToastMessage(`Feedback recorded (${opt?.label || reason}). Bayesian profile updated.`);
    setShowUndoToast(true);
    if (onFeedbackApplied) onFeedbackApplied(signal);
    onClose();
  };

  const handleUndo = async () => {
    if (lastSignalId && styleSignalsRepository.removeSignal) {
      await styleSignalsRepository.removeSignal(lastSignalId);
      if (onFeedbackUndone) onFeedbackUndone(lastSignalId);
      setLastSignalId(null);
      setShowUndoToast(false);
    }
  };

  const content = (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Styling Feedback"
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-stone-900 sm:rounded-3xl border border-stone-200 dark:border-stone-800 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h3 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                Styling Feedback
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Fine-tune your personal Style Brain with real-time feedback
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Positive Action */}
          <div className="mt-4 shrink-0">
            <button
              onClick={handlePositiveFeedback}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 tactile-press"
            >
              <Heart className="h-4 w-4 fill-white" />
              I Love This Look (Reinforce Affinity)
            </button>
          </div>

          {/* Granular Rejection Reasons */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Not working today? Tell us why:
            </p>
            <div className="space-y-2 pb-4">
              {REJECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.reason}
                  onClick={() => handleRejection(opt.reason)}
                  className="flex w-full min-h-11 items-center gap-3 rounded-2xl border border-border/80 bg-(--ivory)/60 p-3 text-left transition-colors hover:border-(--kumkum)/40 hover:bg-(--ivory) dark:border-stone-800 dark:bg-stone-850 dark:hover:bg-stone-800 active:scale-[0.98] tactile-press-sm"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-(--paper) border border-border/60 shadow-2xs dark:bg-stone-800">
                    {opt.icon}
                  </span>
                  <div className="flex-1">
                    <span className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {opt.label}
                    </span>
                    <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                      {opt.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Undo Toast */}
      {showUndoToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-stone-700 bg-stone-900 px-4 py-2 text-xs text-white shadow-lg dark:border-stone-600 dark:bg-stone-800"
        >
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            {toastMessage}
          </span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 font-bold text-amber-300 hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
