import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  ShieldCheck,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { useSaathi } from '../../hooks/useSaathi';
import { SaathiMessageItem } from './SaathiMessageItem';
import { ClarificationOption } from '../../engine/saathi/types';

interface AISaathiChatViewProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanLook?: (outfit: any) => void;
}

const QUICK_PROMPTS = [
  'What should I wear today?',
  'Do I need to buy anything?',
  'Style my blue kurta',
  'What do I wear most often?',
  'What is the weather outside today?',
];

export const AISaathiChatView: React.FC<AISaathiChatViewProps> = ({
  isOpen,
  onClose,
  onPlanLook,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    cancelAction,
    selectClarificationOption,
    resetConversation,
  } = useSaathi();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (isLoading) return;
    await sendMessage(prompt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="AI Saathi Conversation"
    >
      <div className="w-full h-full sm:h-[85vh] sm:max-h-180 max-w-xl bg-background rounded-none sm:rounded-2xl border-0 sm:border border-border flex flex-col overflow-hidden shadow-2xl">
        {/* Editorial Header */}
        <header className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border bg-(--card)/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-(--ivory) border border-border flex items-center justify-center text-(--burnished-gold)">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold tracking-tight text-(--text)">AI SAATHI</h2>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Privacy-First Orchestrator
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Zero Cloud Tracking • Local Domain Engines</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetConversation}
              title="Reset conversation"
              aria-label="Reset conversation"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-muted hover:text-(--text) hover:bg-(--ivory)/60 transition-colors active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close chat"
              aria-label="Close chat"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-muted hover:text-(--text) hover:bg-(--ivory)/60 transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Conversation Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-(--ivory) border border-border flex items-center justify-center text-(--burnished-gold) shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-serif text-lg font-medium text-(--text)">
                  Namaste! How can I style your day?
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  I coordinate your wardrobe, verified weather, style brain, and gap intelligence to provide conversational decision support.
                </p>
              </div>

              {/* Quick Prompts */}
              <div className="w-full pt-3 space-y-2 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block text-center">
                  Try asking
                </span>
                <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleQuickPrompt(prompt)}
                      className="min-h-11 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-(--ivory) text-xs text-(--text) text-left transition-all active:scale-98 shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <SaathiMessageItem
                key={msg.id}
                message={msg}
                isLatest={index === messages.length - 1}
                disabled={isLoading}
                onSelectClarification={(opt: ClarificationOption) =>
                  selectClarificationOption(opt)
                }
                onConfirmAction={confirmAction}
                onCancelAction={cancelAction}
                onPlanLook={onPlanLook}
              />
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border text-xs text-muted w-fit animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-(--burnished-gold)" />
              <span>Consulting domain intelligence...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <footer className="border-t border-border bg-(--card)/90 backdrop-blur-md shrink-0">
          {/* Quick Prompts Carousel */}
          <div className="px-3 sm:px-4 py-2 border-b border-border/40 flex gap-2 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleQuickPrompt(prompt)}
                className="shrink-0 min-h-11 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-(--ivory) text-[11px] text-(--text) transition-all active:scale-95 shadow-2xs whitespace-nowrap flex items-center"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-3 sm:p-4 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask AI Saathi about your closet, looks, or gaps…"
              className="flex-1 min-h-11 px-4 rounded-xl border border-border bg-background text-base sm:text-xs text-(--text) placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-(--burnished-gold) transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              aria-label="Send message"
              className="min-h-11 min-w-11 px-4 rounded-xl bg-(--ink) text-white flex items-center justify-center hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};
