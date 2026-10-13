import React from 'react';
import { SaathiMessage, ClarificationOption } from '../../engine/saathi/types';
import { SaathiRecommendationCard } from './SaathiRecommendationCard';
import { SaathiSmartBuyCard } from './SaathiSmartBuyCard';
import { SaathiClarificationPrompt } from './SaathiClarificationPrompt';
import { Sparkles, Check, X, ShieldAlert } from 'lucide-react';

interface SaathiMessageItemProps {
  message: SaathiMessage;
  onSelectClarification?: (option: ClarificationOption) => void;
  onConfirmAction?: () => void;
  onCancelAction?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onPlanLook?: (outfit: any) => void;
  isLatest?: boolean;
  disabled?: boolean;
}

export const SaathiMessageItem: React.FC<SaathiMessageItemProps> = ({
  message,
  onSelectClarification,
  onConfirmAction,
  onCancelAction,
  onConfirm,
  onCancel,
  onPlanLook,
  isLatest = true,
  disabled = false,
}) => {
  const isUser = message.sender === 'user';
  const handleConfirm = onConfirmAction || onConfirm;
  const handleCancel = onCancelAction || onCancel;

  return (
    <div
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
      data-testid={`saathi-message-${message.id}`}
    >
      <div className="flex items-center gap-1 px-1">
        {!isUser && <Sparkles className="w-3 h-3 text-(--burnished-gold)" />}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {isUser ? 'You' : 'AI Saathi'}
        </span>
      </div>

      <div
        className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-colors ${
          isUser
            ? 'bg-(--ink) text-white rounded-br-xs'
            : 'bg-card border border-(--border) text-(--ink) rounded-bl-xs shadow-2xs'
        }`}
      >
        <p className="whitespace-pre-line">{message.text}</p>

        {/* Embedded Domain Recommendation Cards */}
        {message.domainResult?.outfits && message.domainResult.outfits.length > 0 && (
          <SaathiRecommendationCard
            outfit={message.domainResult.outfits[0]}
            onPlanLook={onPlanLook}
          />
        )}

        {/* Embedded Smart Buy Report Cards */}
        {message.domainResult?.gapReport && (
          <SaathiSmartBuyCard report={message.domainResult.gapReport} />
        )}

        {/* Clarification Request Options */}
        {message.clarification && isLatest && onSelectClarification && (
          <SaathiClarificationPrompt
            clarification={message.clarification}
            onSelectOption={onSelectClarification}
            disabled={disabled}
          />
        )}

        {/* Mutation Confirmation Prompt */}
        {message.confirmation && handleConfirm && handleCancel && (
          <div
            className="mt-3 p-3.5 rounded-xl border border-(--burnished-gold)/30 bg-(--burnished-gold)/5 space-y-2.5"
            role="region"
            aria-label="Action confirmation"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-(--ink)">
              <ShieldAlert className="w-4 h-4 text-(--burnished-gold)" />
              <span>{message.confirmation.title || 'Schedule Look'}</span>
            </div>
            <p className="text-[11px] text-muted">{message.confirmation.description}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={disabled}
                onClick={handleConfirm}
                className="min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-(--ink) text-white text-xs font-semibold uppercase tracking-wider hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm &amp; Execute</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleCancel}
                className="min-h-11 px-4 flex items-center justify-center gap-1 rounded-lg border border-(--border) bg-card text-(--ink) text-xs font-semibold uppercase tracking-wider hover:bg-(--ivory) active:scale-95 disabled:opacity-50 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
