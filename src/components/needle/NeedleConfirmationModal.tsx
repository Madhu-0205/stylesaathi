import React from 'react';
import { AlertTriangle, Sparkles, X, Check, ShieldAlert } from 'lucide-react';
import { PendingAction } from '../../services/needle/needleTypes';

interface NeedleConfirmationModalProps {
  pendingAction: PendingAction | null;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}

export const NeedleConfirmationModal: React.FC<NeedleConfirmationModalProps> = ({
  pendingAction,
  onConfirm,
  onCancel,
}) => {
  if (!pendingAction) return null;

  const { toolCall, query, explanation, id } = pendingAction;
  const isDestructive = toolCall.isDestructive;
  const confidencePercent = Math.round(toolCall.confidence * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="needle-confirmation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isDestructive
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {isDestructive ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2
                id="needle-confirmation-title"
                className="font-serif text-lg font-bold tracking-tight text-foreground"
              >
                {isDestructive ? 'Confirm Destructive Action' : 'Action Confirmation'}
              </h2>
              <p className="text-xs text-muted-foreground">
                On-device intent verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCancel(id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="my-5 space-y-4">
          {/* Query context */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Command Entered
            </span>
            <p className="font-medium text-foreground italic">"{query}"</p>
          </div>

          {/* Explanation */}
          <p className="text-sm text-foreground/90 leading-relaxed">
            {explanation}
          </p>

          {/* Gating Reason Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isDestructive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Destructive Mutation Guard
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              Confidence: {confidencePercent}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Tool: {toolCall.name}
            </span>
          </div>

          {/* Arguments breakdown */}
          <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-xs space-y-1.5">
            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
              Extracted Parameters
            </div>
            {Object.entries(toolCall.arguments).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground font-mono">{key}:</span>
                <span className="font-semibold text-foreground font-mono">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onCancel(id)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            Cancel & Dismiss
          </button>
          <button
            type="button"
            onClick={() => onConfirm(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition-transform active:scale-95 ${
              isDestructive
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-primary hover:opacity-90'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>Confirm & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
