import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  X,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Shirt,
} from 'lucide-react';
import { useNeedle } from '../../services/needle/useNeedle';
import { NeedleConfirmationModal } from './NeedleConfirmationModal';
import { NavTab } from '../navigation/BottomNav';

interface NeedleCommandBarProps {
  onNavigateTab?: (tab: NavTab) => void;
}

const SUGGESTIONS = [
  'Show me something casual for college.',
  'Find my black jeans',
  'I wore my blue kurta today',
  'Plan look for office tomorrow',
  'Show my styling aesthetic preferences',
];

export const NeedleCommandBar: React.FC<NeedleCommandBarProps> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, execute, confirm, cancel, initialize } = useNeedle();

  // Keyboard shortcut listener: ⌘K or Ctrl+K to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-needle-command', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-needle-command', handleOpenEvent);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (state.modelStatus === 'uninitialized') {
        initialize().catch(() => {});
      }
    }
  }, [isOpen, state.modelStatus, initialize]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || state.serviceStatus === 'inferring') return;

    await execute(query);
  };

  const handleSelectSuggestion = (s: string) => {
    setQuery(s);
    inputRef.current?.focus();
  };

  const lastResult = state.lastResult;
  const isInferring = state.serviceStatus === 'inferring' || state.serviceStatus === 'executing';

  return (
    <>
      {/* 1. Global Editorial Triggers */}
      {/* Desktop Top Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs backdrop-blur-sm transition-all hover:border-primary/40 hover:text-foreground active:scale-98"
        aria-label="Open AI Stylist (Command + K)"
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
        <span className="font-serif tracking-wide">Ask Stylist…</span>
        <kbd className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Mobile Floating Action Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-amber-500/30 bg-card/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-transform active:scale-95"
        aria-label="Open on-device Stylist"
      >
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="font-serif">Stylist</span>
      </button>

      {/* 2. Command Palette Modal Overlay */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-all">
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="relative flex items-center border-b border-border p-4">
              <Search className="h-5 w-5 text-muted-foreground ml-1 mr-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask StyleSaathi (e.g. 'Show me something casual for college.')..."
                className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-muted-foreground hover:text-foreground mr-2"
                  aria-label="Clear query"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || isInferring}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-40 transition-transform active:scale-95 shrink-0"
              >
                {isInferring ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Ask</span>
              </button>
            </form>

            {/* Model & Download Status */}
            {state.downloadProgress > 0 && state.downloadProgress < 100 && (
              <div className="bg-amber-500/10 px-4 py-2 border-b border-border text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                <span>Caching on-device model for offline use...</span>
                <span className="font-mono font-bold">{state.downloadProgress}%</span>
              </div>
            )}

            {/* Content Area */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {/* Quick Suggestions (Shown if no result or empty query) */}
              {!lastResult && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Try asking
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-foreground/80 hover:border-primary/40 hover:bg-muted transition-colors text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Feedback / Result Card */}
              {lastResult && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      {lastResult.executionStatus === 'executed' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-serif text-sm font-bold text-foreground">
                        {lastResult.executionStatus === 'executed'
                          ? 'Action Executed'
                          : 'Intent Interpretation'}
                      </span>
                    </div>

                    {lastResult.toolCall && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                          {lastResult.toolCall.name}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-secondary-foreground">
                          {Math.round(lastResult.toolCall.confidence * 100)}%
                        </span>
                        {(lastResult.engine || lastResult.toolCall.engine) && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                              (lastResult.engine || lastResult.toolCall.engine) === 'needle_wasm'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {(lastResult.engine || lastResult.toolCall.engine) === 'needle_wasm'
                              ? 'Needle 3 On-Device'
                              : 'Semantic Fallback'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                    {lastResult.message}
                  </p>

                  {/* Outfits Action Link */}
                  {lastResult.data?.outfits && lastResult.data.outfits.length > 0 && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {lastResult.data.outfits.length} look{lastResult.data.outfits.length === 1 ? '' : 's'} available
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onNavigateTab?.('Dress');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>View Outfits</span>
                      </button>
                    </div>
                  )}

                  {/* Wardrobe Items Action Link */}
                  {lastResult.data?.items && lastResult.data.items.length > 0 && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {lastResult.data.items.length} item{lastResult.data.items.length === 1 ? '' : 's'} matched
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onNavigateTab?.('Wardrobe');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-opacity hover:opacity-90"
                      >
                        <Shirt className="h-3 w-3" />
                        <span>View in Wardrobe</span>
                      </button>
                    </div>
                  )}

                  {/* Calendar Plan Action Link */}
                  {lastResult.data?.plan && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Scheduled for {lastResult.data.plan.date}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onNavigateTab?.('Calendar');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>View in Calendar</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/20 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Needle 3 on-device • Offline capable
              </span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Gated Action Confirmation Modal */}
      <NeedleConfirmationModal
        pendingAction={state.pendingConfirmation}
        onConfirm={async (id) => {
          await confirm(id);
        }}
        onCancel={(id) => {
          cancel(id);
        }}
      />
    </>
  );
};
